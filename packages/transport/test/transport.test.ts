import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createMetadataOnlyRuntimeBatch,
  ingestCruxBatch,
  otlpHttpJsonToCruxBatch,
} from "../src/index.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../examples/observed-divergence/crux.json", import.meta.url),
    "utf8",
  ),
);

const baseBundle = () => ({
  ...fixture,
  generated_at: "2026-09-16T10:00:00+00:00",
  runs: [],
  events: [],
  traces: [],
  receipts: [],
  observations: [],
  evidence: [],
  evidence_links: [],
});

const versionRef = "system-version:support-routing:1.0";
const run = {
  schema_version: "0.1" as const,
  id: "run:transport-test:001",
  system_version_ref: versionRef,
  started_at: "2026-09-16T10:10:00+00:00",
  completed_at: "2026-09-16T10:10:01+00:00",
  status: "completed" as const,
  capture_mode: "metadata_only" as const,
  disclosure: "internal" as const,
  external_refs: [],
};

const event = {
  schema_version: "0.1" as const,
  id: "event:transport-test:001",
  run_ref: run.id,
  sequence: 1,
  occurred_at: "2026-09-16T10:10:00.500+00:00",
  type: "ai_invocation" as const,
  process_node_ref: "node:support-model",
  component_ref: "component:support-model",
  attributes: {
    provider: "gateway",
    request_model: "anthropic/claude-3-haiku",
    response_model: "anthropic/claude-3-haiku",
    input_tokens: 21,
    output_tokens: 13,
  },
  disclosure: "internal" as const,
};

const producer = {
  id: "producer:test-app",
  kind: "application" as const,
  name: "Transport contract test",
  version: "0.1",
};

const runtimeBatch = () =>
  createMetadataOnlyRuntimeBatch({
    requestId: "request:transport:001",
    producer,
    systemVersionRef: versionRef,
    runs: [run],
    events: [event],
  });

const evidenceEnvelope = {
  schema_version: "0.1",
  generated_at: "2026-09-16T10:11:00+00:00",
  producer: {
    name: "transport-test-ci",
    version: "1.0.0",
    uri: "https://example.org/transport-test",
  },
  evidence: {
    schema_version: "0.1",
    id: "evidence:transport-test:001",
    kind: "evaluation",
    title: "Transport ingestion regression suite",
    summary: "The bounded regression suite completed successfully.",
    source: {
      kind: "external_tool",
      producer: {
        name: "transport-test-ci",
        version: "1.0.0",
        uri: "https://example.org/transport-test",
      },
      source_ref: "https://example.org/transport-test/runs/1",
    },
    targets: [{ kind: "system_version", ref: versionRef }],
    freshness: { observed_at: "2026-09-16T10:10:59+00:00" },
    result: {
      outcome: "pass",
      summary: "The transport contract checks passed.",
      metrics: [{ name: "checks_passed", value: 8, unit: "checks" }],
    },
    limitations: ["Synthetic transport-contract evidence only."],
    external_refs: ["https://example.org/transport-test/runs/1"],
    disclosure: "trusted",
  },
  external_refs: ["https://example.org/transport-test/runs/1"],
};

describe("CRUX semantic ingestion", () => {
  it("accepts a metadata-only Run/Event batch and replays it idempotently", () => {
    const first = ingestCruxBatch(baseBundle(), runtimeBatch(), {
      now: "2026-09-16T10:12:00+00:00",
    });

    expect(first.bundle.runs).toHaveLength(1);
    expect(first.bundle.events).toHaveLength(1);
    expect(first.acceptances.map((item) => item.status)).toEqual(["accepted", "accepted"]);
    expect(first.acceptances.every((item) => item.producer_ref === producer.id)).toBe(true);

    const replay = ingestCruxBatch(first.bundle, runtimeBatch(), {
      now: "2026-09-16T10:13:00+00:00",
    });
    expect(replay.bundle.runs).toHaveLength(1);
    expect(replay.bundle.events).toHaveLength(1);
    expect(replay.acceptances.map((item) => item.status)).toEqual([
      "already_present",
      "already_present",
    ]);
  });

  it("rejects reuse of a stable ID for materially different runtime data", () => {
    const first = ingestCruxBatch(baseBundle(), runtimeBatch());
    const changed = runtimeBatch();
    changed.runs[0] = {
      ...changed.runs[0]!,
      completed_at: "2026-09-16T10:10:02+00:00",
    };

    expect(() => ingestCruxBatch(first.bundle, changed)).toThrow(/Run ID conflict/);
  });

  it("requires exact SystemVersion targeting", () => {
    const changed = runtimeBatch();
    changed.runs[0] = {
      ...changed.runs[0]!,
      system_version_ref: "system-version:other:1.0",
    };

    expect(() => ingestCruxBatch(baseBundle(), changed)).toThrow(/batch targets/);
  });

  it("rejects free-text runtime summaries and non-allow-listed attributes by default", () => {
    const withSummary = runtimeBatch();
    withSummary.events[0] = {
      ...withSummary.events[0]!,
      summary: "Potentially content-bearing runtime text.",
    };
    expect(() => ingestCruxBatch(baseBundle(), withSummary)).toThrow(/includes summary/);

    const withContentAttribute = runtimeBatch();
    withContentAttribute.events[0] = {
      ...withContentAttribute.events[0]!,
      attributes: {
        ...withContentAttribute.events[0]!.attributes,
        prompt: "THIS_MUST_NOT_ENTER_CRUX",
      },
    };
    expect(() => ingestCruxBatch(baseBundle(), withContentAttribute)).toThrow(
      /not allow-listed: prompt/,
    );
  });

  it("imports EvidenceEnvelope records through the same batch boundary without claim linkage", () => {
    const batch = {
      format: "crux-ingest/0.1" as const,
      request_id: "request:evidence:001",
      producer: {
        id: "producer:test-ci",
        kind: "ci" as const,
        name: "Transport CI",
      },
      runs: [],
      events: [],
      observations: [],
      evidence_envelopes: [evidenceEnvelope],
    };

    const first = ingestCruxBatch(baseBundle(), batch);
    expect(first.bundle.evidence).toHaveLength(1);
    expect(first.bundle.evidence_links).toEqual([]);
    expect(first.acceptances[0]?.status).toBe("accepted");

    const replay = ingestCruxBatch(first.bundle, batch);
    expect(replay.bundle.evidence).toHaveLength(1);
    expect(replay.acceptances[0]?.status).toBe("already_present");
  });
});

describe("OTLP/HTTP bridge", () => {
  it("maps GenAI metadata through the same ingestion contract without message content", () => {
    const sensitivePrompt = "OTLP_SENSITIVE_PROMPT_MUST_NOT_ENTER_CRUX";
    const sensitiveOutput = "OTLP_SENSITIVE_OUTPUT_MUST_NOT_ENTER_CRUX";
    const payload = {
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  traceId: "5B8EFFF798038103D269B633813FC60C",
                  spanId: "EEE19B7EC3C1B174",
                  name: "chat anthropic/claude-3-haiku",
                  startTimeUnixNano: "1789553400000000000",
                  attributes: [
                    { key: "gen_ai.operation.name", value: { stringValue: "chat" } },
                    { key: "gen_ai.provider.name", value: { stringValue: "gateway" } },
                    {
                      key: "gen_ai.request.model",
                      value: { stringValue: "anthropic/claude-3-haiku" },
                    },
                    {
                      key: "gen_ai.response.model",
                      value: { stringValue: "anthropic/claude-3-haiku" },
                    },
                    { key: "gen_ai.usage.input_tokens", value: { intValue: "21" } },
                    { key: "gen_ai.usage.output_tokens", value: { intValue: "13" } },
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

    const batch = otlpHttpJsonToCruxBatch(payload, {
      requestId: "request:otlp:001",
      runId: "run:otlp-test:001",
      systemVersionRef: versionRef,
      refs: {
        componentRef: "component:support-model",
        processNodeRef: "node:support-model",
      },
    });

    expect(batch.producer.kind).toBe("otel_bridge");
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]?.summary).toBeUndefined();
    expect(batch.events[0]?.attributes.provider).toBe("gateway");
    expect(batch.events[0]?.attributes.input_tokens).toBe(21);
    expect(JSON.stringify(batch)).not.toContain(sensitivePrompt);
    expect(JSON.stringify(batch)).not.toContain(sensitiveOutput);

    const ingested = ingestCruxBatch(baseBundle(), batch);
    expect(ingested.bundle.runs).toHaveLength(1);
    expect(ingested.bundle.events).toHaveLength(1);
    expect(ingested.acceptances.every((item) => item.status === "accepted")).toBe(true);
  });
});
