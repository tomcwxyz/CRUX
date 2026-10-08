import { compareDeclaredAndObservedModels, hasDeclaredObservedDivergence } from "@crux/core/observed";
import { parsePortableBundle, validateBundleReferences, type CruxPortableBundle } from "@crux/formats";
import { createInstrumentationSession, proposeReceiptFromObservedRun, recordAISdkStep } from "@crux/instrumentation";
import { receiptSchema, traceSchema } from "@crux/schemas";
import fundingReviewJson from "../../../examples/funding-review/crux.json";

/**
 * A preview-only fallback. It reuses canonical CRUX instrumentation, model
 * comparison and disclosure data, but never talks to the server or a database.
 * It is intentionally not an alternative to durable ingestion.
 */
const versionRef = "system-version:funding-assistant:2.3";
const key = "crux:browser-runtime-demo:v1";
const maxBytes = 500_000;

export type BrowserDemoReview = {
  aiSummary: string;
  effectOfAi: string;
  humanInvolvement: string;
  finalAuthority: "human" | "rule" | "ai" | "hybrid" | "external";
  outcome: string;
  challengeDescription: string;
};
export type BrowserDemoState = {
  revision: number;
  bundle: CruxPortableBundle;
  browser_only: true;
  run_mode?: "demo";
  runtime: {
    live_provider_enabled: false;
    run_count: number;
    event_count: number;
    latest_run_ref: string | null;
    latest_run_status: string | null;
    latest_event_types: string[];
    observed_provider: string | null;
    observed_model: string | null;
    comparisons: ReturnType<typeof compareDeclaredAndObservedModels>;
    divergence_count: number;
    comparable_count: number;
    pending_case: ReturnType<typeof proposeReceiptFromObservedRun>["proposal"] | null;
    reviewed_case: { receipt_ref: string; run_ref: string; outcome: string } | null;
  };
};

const seed = () => {
  const base = parsePortableBundle(fundingReviewJson as unknown);
  return parsePortableBundle({
    ...base,
    runs: [], events: [], traces: [], receipts: [], observations: [],
  });
};

export function prepareBrowserDemo(bundle = seed(), revision = 0): BrowserDemoState {
  const version = bundle.system_versions.find((item) => item.id === versionRef);
  if (!version) throw new Error("The example's system version could not be found.");
  const runs = bundle.runs.filter((run) => run.system_version_ref === versionRef)
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
  const latest = runs.at(-1);
  const events = bundle.events.filter((event) => runs.some((run) => run.id === event.run_ref));
  const latestEvents = latest ? events.filter((event) => event.run_ref === latest.id).sort((a, b) => a.sequence - b.sequence) : [];
  const invocation = latestEvents.find((event) => event.type === "ai_invocation");
  const comparison = compareDeclaredAndObservedModels(version, events);
  const receipt = latest ? bundle.receipts.find((item) => item.run_ref === latest.id) : undefined;
  const pending = latest && !receipt && invocation
    ? proposeReceiptFromObservedRun(latest, latestEvents).proposal : null;

  return {
    revision,
    bundle,
    browser_only: true,
    ...(latest ? { run_mode: "demo" as const } : {}),
    runtime: {
      live_provider_enabled: false,
      run_count: runs.length,
      event_count: events.length,
      latest_run_ref: latest?.id ?? null,
      latest_run_status: latest?.status ?? null,
      latest_event_types: latestEvents.map((event) => event.type),
      observed_provider: typeof invocation?.attributes.provider === "string" ? invocation.attributes.provider : null,
      observed_model: typeof invocation?.attributes.response_model === "string" ? invocation.attributes.response_model
        : typeof invocation?.attributes.request_model === "string" ? invocation.attributes.request_model : null,
      comparisons: comparison,
      divergence_count: comparison.filter(hasDeclaredObservedDivergence).length,
      comparable_count: comparison.filter((item) => item.comparable).length,
      pending_case: pending,
      reviewed_case: receipt ? { receipt_ref: receipt.id, run_ref: receipt.run_ref, outcome: receipt.outcome } : null,
    },
  };
}

export function runBrowserDemo(
  state: BrowserDemoState,
  runId = `run:browser-preview:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
): BrowserDemoState {
  const now = new Date().toISOString();
  if (state.bundle.runs.some((run) => run.id === runId)) throw new Error("This example run already exists.");
  const session = createInstrumentationSession({
    runId,
    systemVersionRef: versionRef,
    startedAt: now,
    captureMode: "metadata_only",
    disclosure: "internal",
  });
  recordAISdkStep(session, {
    finishReason: "stop",
    usage: { inputTokens: 18, outputTokens: 4, totalTokens: 22 },
    model: { provider: "demo-provider", modelId: "demo-model-b" },
    response: { id: `fictional-${runId.slice(4)}`, model: "demo-model-b" },
  }, {
    componentRef: "component:eligibility-extractor",
    processNodeRef: "node:eligibility-extraction",
    disclosure: "internal",
  });
  session.record({
    type: "human_review",
    processNodeRef: "node:funding-officer-review",
    humanRoleRef: "role:funding-officer",
    disclosure: "affected_party",
  });
  session.record({
    type: "decision",
    processNodeRef: "node:eligibility-decision",
    decisionRef: "decision:eligibility",
    humanRoleRef: "role:funding-officer",
    disclosure: "affected_party",
  });
  session.finish("completed", now);
  const result = session.snapshot();
  // Carry only bounded metadata, not synthetic prompt/output content.
  const events = result.events.map(({ summary: _summary, ...event }) => event);
  const next = parsePortableBundle({
    ...state.bundle,
    generated_at: now,
    runs: [...state.bundle.runs, result.run],
    events: [...state.bundle.events, ...events],
  });
  if (!validateBundleReferences(next).valid) throw new Error("The test event references are invalid.");
  return prepareBrowserDemo(next, state.revision + 1);
}

const requiredText = (value: string, label: string) => {
  const text = value.trim();
  if (!text) throw new Error(`Please confirm ${label}.`);
  return text.slice(0, 4000);
};

export function reviewBrowserDemo(
  state: BrowserDemoState,
  runRef: string,
  draft: BrowserDemoReview,
): BrowserDemoState {
  if (!state.runtime.pending_case || state.runtime.latest_run_ref !== runRef || state.runtime.pending_case.run_ref !== runRef) {
    throw new Error("This example case is no longer awaiting review.");
  }
  const run = state.bundle.runs.find((item) => item.id === runRef && item.system_version_ref === versionRef);
  if (!run) throw new Error("The example run is missing.");
  const events = state.bundle.events.filter((event) => event.run_ref === runRef);
  const proposed = proposeReceiptFromObservedRun(run, events);
  const trace = traceSchema.parse({ ...proposed.trace, disclosure: "affected_party" });
  const receipt = receiptSchema.parse({
    schema_version: "0.1",
    id: `receipt:reviewed:${runRef.slice(4)}`,
    run_ref: runRef,
    trace_ref: trace.id,
    system_version_ref: versionRef,
    occurred_at: run.completed_at ?? run.started_at,
    ai_involvement: ["informational"],
    ai_summary: requiredText(draft.aiSummary, "the AI contribution"),
    effect_of_ai: requiredText(draft.effectOfAi, "the effect of AI"),
    ...(draft.humanInvolvement.trim() ? { human_involvement: draft.humanInvolvement.trim().slice(0, 4000) } : {}),
    final_authority: draft.finalAuthority,
    outcome: requiredText(draft.outcome, "the outcome"),
    challenge: draft.challengeDescription.trim()
      ? { available: true, description: draft.challengeDescription.trim().slice(0, 4000) }
      : { available: false },
    source_content_included: false,
    disclosure: "affected_party",
    external_refs: [],
  });
  const next = parsePortableBundle({
    ...state.bundle,
    traces: [...state.bundle.traces, trace],
    receipts: [...state.bundle.receipts, receipt],
  });
  const check = validateBundleReferences(next);
  if (!check.valid) throw new Error("The reviewed example has broken references.");
  return prepareBrowserDemo(next, state.revision + 1);
}

/** Browser-session persistence is entirely optional and never shared across visitors. */
export function restoreBrowserDemo(): BrowserDemoState {
  if (typeof window === "undefined") return prepareBrowserDemo();
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw || raw.length > maxBytes) return prepareBrowserDemo();
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return prepareBrowserDemo();
    const candidate = value as Partial<BrowserDemoState>;
    if (candidate.browser_only !== true || !candidate.bundle ||
        typeof candidate.revision !== "number" || !Number.isSafeInteger(candidate.revision) ||
        candidate.revision < 0) return prepareBrowserDemo();
    const bundle = parsePortableBundle(candidate.bundle);
    if (!validateBundleReferences(bundle).valid) return prepareBrowserDemo();
    return prepareBrowserDemo(bundle, candidate.revision);
  } catch {
    return prepareBrowserDemo();
  }
}

export function storeBrowserDemo(state: BrowserDemoState): void {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify({
      bundle: state.bundle, revision: state.revision, browser_only: true,
    });
    if (raw.length <= maxBytes) window.sessionStorage.setItem(key, raw);
  } catch {
    // A blocked/limited session store must never prevent using the demo.
  }
}

export function resetBrowserDemo(): BrowserDemoState {
  if (typeof window !== "undefined") {
    try { window.sessionStorage.removeItem(key); } catch { /* optional */ }
  }
  return prepareBrowserDemo();
}
