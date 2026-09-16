import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POST } from "../app/api/ingest-test/route";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../examples/observed-divergence/crux.json", import.meta.url),
    "utf8",
  ),
);

const baseBundle = () => ({
  ...fixture,
  runs: [],
  events: [],
  traces: [],
  receipts: [],
  observations: [],
  evidence: [],
  evidence_links: [],
});

const versionRef = "system-version:support-routing:1.0";

const batch = () => ({
  format: "crux-ingest/0.1",
  request_id: "request:http-route:001",
  producer: {
    id: "producer:http-route-test",
    kind: "application",
    name: "HTTP route regression",
  },
  system_version_ref: versionRef,
  runs: [
    {
      schema_version: "0.1",
      id: "run:http-route:001",
      system_version_ref: versionRef,
      started_at: "2026-09-16T11:00:00+00:00",
      completed_at: "2026-09-16T11:00:01+00:00",
      status: "completed",
      capture_mode: "metadata_only",
      disclosure: "internal",
      external_refs: [],
    },
  ],
  events: [
    {
      schema_version: "0.1",
      id: "event:http-route:001",
      run_ref: "run:http-route:001",
      sequence: 1,
      occurred_at: "2026-09-16T11:00:00.500+00:00",
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
  observations: [],
  evidence_envelopes: [],
});

const callRoute = async (bundle: unknown, ingestBatch: unknown) => {
  const response = await POST(
    new Request("http://localhost/api/ingest-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bundle, batch: ingestBatch }),
    }),
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, any>,
  };
};

describe("CRUX ingest test route", () => {
  it("accepts then idempotently replays the same semantic batch", async () => {
    const first = await callRoute(baseBundle(), batch());
    expect(first.status).toBe(200);
    expect(first.body.ok).toBe(true);
    expect(first.body.persistence).toBe("none");
    expect(first.body.acceptances.map((item: { status: string }) => item.status)).toEqual([
      "accepted",
      "accepted",
    ]);

    const replay = await callRoute(first.body.bundle, batch());
    expect(replay.status).toBe(200);
    expect(replay.body.acceptances.map((item: { status: string }) => item.status)).toEqual([
      "already_present",
      "already_present",
    ]);
  });

  it("rejects free-text event summaries at the default HTTP boundary", async () => {
    const unsafe = batch() as ReturnType<typeof batch> & {
      events: Array<ReturnType<typeof batch>["events"][number] & { summary?: string }>;
    };
    unsafe.events[0] = {
      ...unsafe.events[0]!,
      summary: "A free-text runtime summary that should require an explicit broader policy.",
    };

    const result = await callRoute(baseBundle(), unsafe);
    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    expect(result.body.code).toBe("ingest_rejected");
    expect(result.body.message).toMatch(/includes summary/);
  });
});
