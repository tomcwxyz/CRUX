import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  InMemoryDurableIngestStore,
  createMetadataOnlyRuntimeBatch,
  ingestCruxBatchDurably,
  type AuthenticatedIngestContext,
} from "../src/index.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../examples/observed-divergence/crux.json", import.meta.url),
    "utf8",
  ),
);

const baseBundle = () => ({
  ...fixture,
  generated_at: "2026-09-16T14:00:00+00:00",
  runs: [],
  events: [],
  traces: [],
  receipts: [],
  observations: [],
  evidence: [],
  evidence_links: [],
});

const scopeRef = "scope:example-foundation";
const versionRef = "system-version:support-routing:1.0";
const producer = {
  id: "producer:durable-test-app",
  kind: "application" as const,
  name: "Durable transport test",
};

const batch = () =>
  createMetadataOnlyRuntimeBatch({
    requestId: "request:durable:001",
    producer,
    systemVersionRef: versionRef,
    runs: [
      {
        schema_version: "0.1",
        id: "run:durable-test:001",
        system_version_ref: versionRef,
        started_at: "2026-09-16T14:01:00+00:00",
        completed_at: "2026-09-16T14:01:01+00:00",
        status: "completed",
        capture_mode: "metadata_only",
        disclosure: "internal",
        external_refs: [],
      },
    ],
    events: [
      {
        schema_version: "0.1",
        id: "event:durable-test:001",
        run_ref: "run:durable-test:001",
        sequence: 1,
        occurred_at: "2026-09-16T14:01:00.500+00:00",
        type: "ai_invocation",
        process_node_ref: "node:support-model",
        component_ref: "component:support-model",
        attributes: {
          provider: "gateway",
          request_model: "anthropic/claude-3-haiku",
          response_model: "anthropic/claude-3-haiku",
          input_tokens: 21,
          output_tokens: 13,
        },
        disclosure: "internal",
      },
    ],
  });

const context: AuthenticatedIngestContext = {
  principal_ref: "principal:test-service",
  scope_ref: scopeRef,
  allowed_producer_refs: [producer.id],
  capabilities: ["runtime:write"],
};

const store = () =>
  new InMemoryDurableIngestStore([{ scope_ref: scopeRef, bundle: baseBundle() }]);

describe("durable CRUX ingestion service", () => {
  it("commits once and replays the same producer/request id without a second transaction", async () => {
    const durableStore = store();

    const first = await ingestCruxBatchDurably(durableStore, context, batch(), {
      now: "2026-09-16T14:02:00+00:00",
    });
    expect(first.request_status).toBe("committed");
    expect(first.revision).toBe(1);
    expect(first.acceptances.map((item) => item.status)).toEqual(["accepted", "accepted"]);

    const replay = await ingestCruxBatchDurably(durableStore, context, batch(), {
      now: "2026-09-16T14:03:00+00:00",
    });
    expect(replay.request_status).toBe("replayed");
    expect(replay.revision).toBe(1);
    expect(replay.accepted_at).toBe(first.accepted_at);
    expect(replay.acceptances).toEqual(first.acceptances);
    expect(replay.bundle.runs).toHaveLength(1);
    expect(replay.bundle.events).toHaveLength(1);
  });

  it("rejects reuse of a producer/request id for a changed bounded batch", async () => {
    const durableStore = store();
    await ingestCruxBatchDurably(durableStore, context, batch());

    const changed = batch();
    changed.runs[0] = {
      ...changed.runs[0]!,
      completed_at: "2026-09-16T14:01:02+00:00",
    };

    await expect(
      ingestCruxBatchDurably(durableStore, context, changed),
    ).rejects.toThrow(/idempotency key was already used for a different batch/);
  });

  it("treats batch producer identity as provenance, not authentication", async () => {
    const durableStore = store();
    const unauthorised: AuthenticatedIngestContext = {
      ...context,
      principal_ref: "principal:other-service",
      allowed_producer_refs: ["producer:someone-else"],
    };

    await expect(
      ingestCruxBatchDurably(durableStore, unauthorised, batch()),
    ).rejects.toThrow(/not authorised to ingest as producer/);
  });

  it("requires explicit runtime/evidence capabilities from the authenticated context", async () => {
    const durableStore = store();
    const readOnly: AuthenticatedIngestContext = {
      ...context,
      capabilities: [],
    };

    await expect(
      ingestCruxBatchDurably(durableStore, readOnly, batch()),
    ).rejects.toThrow(/lacks runtime:write/);

    const evidenceBatch = {
      format: "crux-ingest/0.1" as const,
      request_id: "request:durable:evidence:001",
      producer: {
        id: "producer:durable-test-ci",
        kind: "ci" as const,
      },
      runs: [],
      events: [],
      observations: [],
      evidence_envelopes: [
        {
          schema_version: "0.1",
          generated_at: "2026-09-16T14:04:00+00:00",
          producer: { name: "test-ci", version: "1.0" },
          evidence: {
            schema_version: "0.1",
            id: "evidence:durable-test:001",
            kind: "evaluation",
            title: "Durable ingestion check",
            summary: "Synthetic evidence for capability testing.",
            source: {
              kind: "external_tool",
              producer: { name: "test-ci", version: "1.0" },
            },
            targets: [{ kind: "system_version", ref: versionRef }],
            freshness: { observed_at: "2026-09-16T14:04:00+00:00" },
            result: { outcome: "pass", summary: "Synthetic check passed.", metrics: [] },
            limitations: ["Synthetic test evidence."],
            external_refs: [],
            disclosure: "internal",
          },
          external_refs: [],
        },
      ],
    };

    await expect(
      ingestCruxBatchDurably(
        durableStore,
        {
          ...context,
          allowed_producer_refs: ["producer:durable-test-ci"],
          capabilities: ["runtime:write"],
        },
        evidenceBatch,
      ),
    ).rejects.toThrow(/lacks evidence:write/);
  });

  it("rejects unknown service scopes before changing canonical state", async () => {
    const durableStore = store();
    await expect(
      ingestCruxBatchDurably(
        durableStore,
        { ...context, scope_ref: "scope:missing" },
        batch(),
      ),
    ).rejects.toThrow(/scope scope:missing does not exist/);
  });
});
