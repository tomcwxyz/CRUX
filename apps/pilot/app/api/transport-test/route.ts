import {
  createMetadataOnlyRuntimeBatch,
  ingestCruxBatch,
  otlpHttpJsonToCruxBatch,
} from "@crux/transport";
import { createStarterBundle } from "../../../lib/starter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addMilliseconds = (timestamp: string, ms: number) =>
  new Date(Date.parse(timestamp) + ms).toISOString();

export async function POST() {
  const now = new Date().toISOString();
  const versionRef = "system-version:primary:0.1";
  const runId = `run:transport-browser:${Date.now()}`;
  const eventId = `event:transport-browser:${Date.now()}`;
  const base = createStarterBundle(now);

  const run = {
    schema_version: "0.1" as const,
    id: runId,
    system_version_ref: versionRef,
    started_at: now,
    completed_at: addMilliseconds(now, 1),
    status: "completed" as const,
    capture_mode: "metadata_only" as const,
    disclosure: "internal" as const,
    external_refs: [],
  };

  const event = {
    schema_version: "0.1" as const,
    id: eventId,
    run_ref: runId,
    sequence: 1,
    occurred_at: now,
    type: "ai_invocation" as const,
    process_node_ref: "node:ai",
    component_ref: "component:primary-model",
    attributes: {
      provider: "browser-demo",
      request_model: "demo-model",
      response_model: "demo-model",
      input_tokens: 12,
      output_tokens: 4,
    },
    disclosure: "internal" as const,
  };

  const batch = createMetadataOnlyRuntimeBatch({
    requestId: `request:transport-browser:${Date.now()}`,
    producer: {
      id: "producer:browser-transport-demo",
      kind: "application",
      name: "CRUX browser transport demo",
      version: "0.1",
    },
    systemVersionRef: versionRef,
    runs: [run],
    events: [event],
  });

  const first = ingestCruxBatch(base, batch, { now: addMilliseconds(now, 2) });
  const replay = ingestCruxBatch(first.bundle, batch, { now: addMilliseconds(now, 3) });

  let conflictMessage = "Conflict was not rejected.";
  let conflictRejected = false;
  try {
    const conflictBatch = structuredClone(batch);
    conflictBatch.runs[0] = {
      ...conflictBatch.runs[0]!,
      completed_at: addMilliseconds(now, 25),
    };
    ingestCruxBatch(first.bundle, conflictBatch, { now: addMilliseconds(now, 4) });
  } catch (error) {
    conflictRejected = true;
    conflictMessage = error instanceof Error ? error.message : "Conflicting ID rejected.";
  }

  let policyMessage = "Free-text summary was not rejected.";
  let policyRejected = false;
  try {
    const unsafeBatch = structuredClone(batch);
    unsafeBatch.runs[0] = {
      ...unsafeBatch.runs[0]!,
      id: `${runId}:unsafe`,
    };
    unsafeBatch.events[0] = {
      ...unsafeBatch.events[0]!,
      id: `${eventId}:unsafe`,
      run_ref: `${runId}:unsafe`,
      summary: "This free-text runtime summary should not cross the default HTTP boundary.",
    };
    ingestCruxBatch(base, unsafeBatch, { now: addMilliseconds(now, 5) });
  } catch (error) {
    policyRejected = true;
    policyMessage = error instanceof Error ? error.message : "Unsafe runtime field rejected.";
  }

  const sensitivePrompt = "OTLP_BROWSER_PRIVATE_INPUT_MUST_NOT_ENTER_CRUX";
  const sensitiveOutput = "OTLP_BROWSER_PRIVATE_OUTPUT_MUST_NOT_ENTER_CRUX";
  const otlpPayload = {
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              {
                name: "chat demo-model",
                startTimeUnixNano: `${BigInt(Date.parse(now)) * 1_000_000n}`,
                attributes: [
                  { key: "gen_ai.operation.name", value: { stringValue: "chat" } },
                  { key: "gen_ai.provider.name", value: { stringValue: "browser-otel" } },
                  { key: "gen_ai.request.model", value: { stringValue: "demo-model" } },
                  { key: "gen_ai.response.model", value: { stringValue: "demo-model" } },
                  { key: "gen_ai.usage.input_tokens", value: { intValue: "17" } },
                  { key: "gen_ai.usage.output_tokens", value: { intValue: "5" } },
                  { key: "gen_ai.input.messages", value: { stringValue: sensitivePrompt } },
                  { key: "gen_ai.output.messages", value: { stringValue: sensitiveOutput } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const otlpBatch = otlpHttpJsonToCruxBatch(otlpPayload, {
    requestId: `request:transport-otlp:${Date.now()}`,
    runId: `run:transport-otlp:${Date.now()}`,
    systemVersionRef: versionRef,
    refs: {
      componentRef: "component:primary-model",
      processNodeRef: "node:ai",
    },
  });
  const otlpSerialised = JSON.stringify(otlpBatch);
  const otlp = ingestCruxBatch(base, otlpBatch, { now: addMilliseconds(now, 6) });

  return Response.json({
    ok: true,
    format: "crux-transport-browser-test/0.1",
    direct: {
      first: first.acceptances,
      replay: replay.acceptances,
      conflict_rejected: conflictRejected,
      conflict_message: conflictMessage,
      content_policy_rejected: policyRejected,
      content_policy_message: policyMessage,
    },
    otlp: {
      producer: otlpBatch.producer,
      event_count: otlpBatch.events.length,
      event_attributes: otlpBatch.events[0]?.attributes ?? {},
      prompt_captured: otlpSerialised.includes(sensitivePrompt),
      response_captured: otlpSerialised.includes(sensitiveOutput),
      acceptances: otlp.acceptances,
    },
  });
}
