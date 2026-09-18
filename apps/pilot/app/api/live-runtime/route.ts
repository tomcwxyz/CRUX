import { generateText } from "ai";
import { NextResponse } from "next/server";
import { parsePortableBundle, type CruxPortableBundle } from "@crux/formats";
import {
  createAISdkOnStepFinish,
  createInstrumentationSession,
  proposeReceiptFromObservedRun,
  recordAISdkStep,
} from "@crux/instrumentation";
import { receiptSchema, traceSchema } from "@crux/schemas";
import {
  createMetadataOnlyRuntimeBatch,
  ingestCruxBatchDurably,
} from "@crux/transport";
import fundingReviewJson from "../../../../../examples/funding-review/crux.json";
import { observedBehaviourForVersion } from "../../../lib/observed";
import { createPilotPostgresStore } from "../../../lib/postgres-store";
import { replacePilotScopeBundle } from "../../../lib/pilot-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const scopeRef = "scope:pilot-live:funding-review:v1";
const systemVersionRef = "system-version:funding-assistant:2.3";
const componentRef = "component:eligibility-extractor";
const aiNodeRef = "node:eligibility-extraction";
const humanNodeRef = "node:funding-officer-review";
const decisionNodeRef = "node:eligibility-decision";
const decisionRef = "decision:eligibility";
const humanRoleRef = "role:funding-officer";

const producer = {
  id: "producer:crux-live-pilot",
  kind: "application" as const,
  name: "CRUX live runtime pilot",
  version: "0.1",
};

const context = {
  principal_ref: "principal:crux-live-pilot",
  scope_ref: scopeRef,
  allowed_producer_refs: [producer.id],
  capabilities: ["runtime:write" as const],
};

const cleanFundingSeed = (): CruxPortableBundle => {
  const base = parsePortableBundle(fundingReviewJson as unknown);
  return parsePortableBundle({
    ...base,
    runs: [],
    events: [],
    traces: [],
    receipts: [],
    observations: [],
  });
};

const response = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const ensureScope = async () => {
  const store = createPilotPostgresStore();
  await store.initialiseScope(scopeRef, cleanFundingSeed());
  const snapshot = await store.loadScope(scopeRef);
  if (!snapshot) throw new Error("CRUX live pilot scope could not be loaded after initialisation.");
  return { store, snapshot };
};

const eventWithoutSummary = <T extends { summary?: string | undefined }>(event: T) => {
  const copy = { ...event };
  delete copy.summary;
  return copy;
};

const latestRunFor = (bundle: CruxPortableBundle) =>
  [...bundle.runs]
    .filter((run) => run.system_version_ref === systemVersionRef)
    .sort((left, right) => Date.parse(left.started_at) - Date.parse(right.started_at))
    .at(-1);

const runtimePayload = (bundle: CruxPortableBundle, revision: number) => {
  const observed = observedBehaviourForVersion(bundle, systemVersionRef);
  const latestRun = latestRunFor(bundle);
  const latestEvents = latestRun
    ? bundle.events
        .filter((event) => event.run_ref === latestRun.id)
        .sort((left, right) => left.sequence - right.sequence)
    : [];
  const reviewedReceipt = latestRun
    ? bundle.receipts.find((receipt) => receipt.run_ref === latestRun.id)
    : undefined;

  let pendingCase: ReturnType<typeof proposeReceiptFromObservedRun>["proposal"] | null = null;
  if (latestRun && !reviewedReceipt && latestEvents.some((event) => event.type === "ai_invocation")) {
    try {
      pendingCase = proposeReceiptFromObservedRun(latestRun, latestEvents).proposal;
    } catch {
      pendingCase = null;
    }
  }

  const invocation = latestEvents.find((event) => event.type === "ai_invocation");

  return {
    ok: true,
    scope_ref: scopeRef,
    revision,
    bundle,
    runtime: {
      run_count: bundle.runs.filter((run) => run.system_version_ref === systemVersionRef).length,
      event_count: bundle.events.filter((event) =>
        bundle.runs.some(
          (run) => run.id === event.run_ref && run.system_version_ref === systemVersionRef,
        )
      ).length,
      latest_run_ref: latestRun?.id ?? null,
      latest_run_status: latestRun?.status ?? null,
      latest_event_types: latestEvents.map((event) => event.type),
      observed_provider:
        typeof invocation?.attributes.provider === "string"
          ? invocation.attributes.provider
          : null,
      observed_model:
        typeof invocation?.attributes.response_model === "string"
          ? invocation.attributes.response_model
          : typeof invocation?.attributes.request_model === "string"
            ? invocation.attributes.request_model
            : null,
      comparisons: observed.comparisons,
      divergence_count: observed.divergenceCount,
      comparable_count: observed.comparableCount,
      pending_case: pendingCase,
      reviewed_case: reviewedReceipt
        ? {
            receipt_ref: reviewedReceipt.id,
            run_ref: reviewedReceipt.run_ref,
            outcome: reviewedReceipt.outcome,
          }
        : null,
    },
  };
};

const requiredText = (value: unknown, label: string, max = 4_000) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required before this case can be published.`);
  }
  return value.trim().slice(0, max);
};

const optionalText = (value: unknown, max = 4_000) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return response({ ok: false, code: "database_not_configured" }, 503);
  }

  try {
    const { snapshot } = await ensureScope();
    return response(runtimePayload(snapshot.bundle, snapshot.revision));
  } catch (error) {
    return response(
      {
        ok: false,
        code: "live_runtime_load_failed",
        message: error instanceof Error ? error.message : "Could not load the live CRUX pilot scope.",
      },
      500,
    );
  }
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return response({ ok: false, code: "database_not_configured" }, 503);
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "run";

  try {
    const { store, snapshot } = await ensureScope();

    if (action === "reset") {
      const revision = await replacePilotScopeBundle({
        scopeRef,
        expectedRevision: snapshot.revision,
        bundle: cleanFundingSeed(),
      });
      const current = await store.loadScope(scopeRef);
      if (!current) throw new Error("CRUX live pilot scope disappeared after reset.");
      return response(runtimePayload(current.bundle, revision));
    }

    if (action === "review") {
      const runRef = requiredText(body.runRef, "Run reference", 240);
      const currentRun = snapshot.bundle.runs.find((run) => run.id === runRef);
      if (!currentRun) {
        return response({ ok: false, code: "run_not_found" }, 404);
      }

      const events = snapshot.bundle.events
        .filter((event) => event.run_ref === currentRun.id)
        .sort((left, right) => left.sequence - right.sequence);
      const proposal = proposeReceiptFromObservedRun(currentRun, events);
      const trace = traceSchema.parse({
        ...proposal.trace,
        disclosure: "affected_party",
      });

      const finalAuthority = body.finalAuthority;
      if (
        finalAuthority !== "human" &&
        finalAuthority !== "rule" &&
        finalAuthority !== "ai" &&
        finalAuthority !== "hybrid" &&
        finalAuthority !== "external"
      ) {
        throw new Error("Final authority must be explicitly confirmed.");
      }

      const challengeDescription = optionalText(body.challengeDescription);
      const suffix = currentRun.id
        .slice("run:".length)
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .toLowerCase();
      const humanInvolvement = optionalText(body.humanInvolvement);
      const receipt = receiptSchema.parse({
        schema_version: "0.1",
        id: `receipt:reviewed:${suffix}`,
        run_ref: currentRun.id,
        trace_ref: trace.id,
        system_version_ref: currentRun.system_version_ref,
        occurred_at: currentRun.completed_at ?? new Date().toISOString(),
        ai_involvement: ["informational"],
        ai_summary: requiredText(body.aiSummary, "AI contribution"),
        effect_of_ai: requiredText(body.effectOfAi, "Effect of AI"),
        ...(humanInvolvement ? { human_involvement: humanInvolvement } : {}),
        final_authority: finalAuthority,
        outcome: requiredText(body.outcome, "Outcome"),
        ...(challengeDescription
          ? { challenge: { available: true, description: challengeDescription } }
          : { challenge: { available: false } }),
        source_content_included: false,
        disclosure: "affected_party",
        external_refs: [],
      });

      const nextBundle = parsePortableBundle({
        ...snapshot.bundle,
        traces: [
          ...snapshot.bundle.traces.filter((item) => item.run_ref !== currentRun.id),
          trace,
        ],
        receipts: [
          ...snapshot.bundle.receipts.filter((item) => item.run_ref !== currentRun.id),
          receipt,
        ],
      });

      const revision = await replacePilotScopeBundle({
        scopeRef,
        expectedRevision: snapshot.revision,
        bundle: nextBundle,
      });
      const current = await store.loadScope(scopeRef);
      if (!current) throw new Error("CRUX live pilot scope disappeared after case review.");
      return response(runtimePayload(current.bundle, revision));
    }

    if (action !== "run") {
      return response({ ok: false, code: "unknown_action" }, 400);
    }

    const mode = body.mode === "demo" ? "demo" : "live";
    const startedAt = new Date();
    const runId = `run:pilot-live:${startedAt.getTime()}`;
    const crux = createInstrumentationSession({
      runId,
      systemVersionRef,
      disclosure: "internal",
      captureMode: "metadata_only",
    });

    if (mode === "live") {
      const model =
        typeof process.env.CRUX_SMOKE_MODEL === "string" && process.env.CRUX_SMOKE_MODEL
          ? process.env.CRUX_SMOKE_MODEL
          : "anthropic/claude-3-haiku";
      await generateText({
        model,
        prompt:
          "Reply with exactly CRUX_LIVE_RUNTIME_OK. This is a synthetic CRUX runtime test and contains no real applicant data.",
        maxOutputTokens: 30,
        onStepFinish: createAISdkOnStepFinish(crux, {
          componentRef,
          processNodeRef: aiNodeRef,
          disclosure: "internal",
        }),
      });
    } else {
      recordAISdkStep(
        crux,
        {
          finishReason: "stop",
          usage: { inputTokens: 18, outputTokens: 4, totalTokens: 22 },
          model: { provider: "demo-provider", modelId: "demo-model-b" },
          response: { id: `demo-${startedAt.getTime()}`, model: "demo-model-b" },
        },
        { componentRef, processNodeRef: aiNodeRef, disclosure: "internal" },
      );
    }

    crux.record({
      type: "human_review",
      processNodeRef: humanNodeRef,
      humanRoleRef,
      disclosure: "affected_party",
    });
    crux.record({
      type: "decision",
      processNodeRef: decisionNodeRef,
      decisionRef,
      humanRoleRef,
      disclosure: "affected_party",
    });
    crux.finish("completed");

    const instrumented = crux.snapshot();
    const metadataEvents = instrumented.events.map((event) => eventWithoutSummary(event));
    const batch = createMetadataOnlyRuntimeBatch({
      requestId: `request:pilot-live:${startedAt.getTime()}`,
      producer,
      systemVersionRef,
      runs: [instrumented.run],
      events: metadataEvents,
    });

    const ingested = await ingestCruxBatchDurably(store, context, batch);
    return response({
      ...runtimePayload(ingested.bundle, ingested.revision),
      run_mode: mode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The live runtime pilot failed.";
    const status = message.includes("changed before") ? 409 : 500;
    return response({ ok: false, code: "live_runtime_failed", message }, status);
  }
}
