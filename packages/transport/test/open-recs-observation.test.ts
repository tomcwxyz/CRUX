import { describe, expect, it } from "vitest";
import { cruxIngestBatchSchema } from "../src/ingest.js";

describe("Open Recs generated observation hook contract", () => {
  it("accepts the dependency-free source.extract payload shape", () => {
    const batch = {
      format: "crux-ingest/0.1",
      request_id: "request:open-recs:test-1",
      producer: {
        id: "producer:open-recs",
        kind: "application",
        name: "Open Recommendations Local",
      },
      system_version_ref: "system-version:open-recs:0.1",
      runs: [{
        schema_version: "0.1",
        id: "run:open-recs:test-1",
        system_version_ref: "system-version:open-recs:0.1",
        started_at: "2026-09-18T20:45:00.000Z",
        completed_at: "2026-09-18T20:45:00.000Z",
        status: "completed",
        capture_mode: "metadata_only",
        disclosure: "internal",
        external_refs: [],
      }],
      events: [{
        schema_version: "0.1",
        id: "event:open-recs:test-1:1",
        run_ref: "run:open-recs:test-1",
        sequence: 1,
        occurred_at: "2026-09-18T20:45:00.000Z",
        type: "ai_invocation",
        attributes: {
          workflow: "source.extract",
          provider: "local-openai-compatible",
          operation: "recommendation_extract",
        },
        disclosure: "internal",
      }],
      observations: [],
      evidence_envelopes: [],
    };

    const parsed = cruxIngestBatchSchema.parse(batch);
    expect(parsed.events[0]?.attributes.workflow).toBe("source.extract");
    expect(JSON.stringify(parsed)).not.toContain("prompt");
    expect(JSON.stringify(parsed)).not.toContain("completion");
    expect(JSON.stringify(parsed)).not.toContain("reasoning");
  });
});
