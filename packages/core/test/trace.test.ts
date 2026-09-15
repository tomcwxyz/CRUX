import { describe, expect, it } from "vitest";
import {
  eventSchema,
  receiptSchema,
  runSchema,
  traceSchema,
} from "@crux/schemas";
import { validateTraceBundle } from "../src/trace.js";

const run = runSchema.parse({
  schema_version: "0.1",
  id: "run:funding:24861",
  system_version_ref: "system-version:funding-assistant:2.3",
  started_at: "2026-09-15T10:00:00+00:00",
  completed_at: "2026-09-15T10:00:12+00:00",
  status: "completed",
  capture_mode: "metadata_only",
  disclosure: "internal",
  external_refs: [],
});

const events = [
  eventSchema.parse({
    schema_version: "0.1",
    id: "event:funding:24861:ai",
    run_ref: run.id,
    sequence: 1,
    occurred_at: "2026-09-15T10:00:03+00:00",
    type: "ai_invocation",
    attributes: {},
    disclosure: "internal",
  }),
  eventSchema.parse({
    schema_version: "0.1",
    id: "event:funding:24861:review",
    run_ref: run.id,
    sequence: 2,
    occurred_at: "2026-09-15T10:00:08+00:00",
    type: "human_review",
    attributes: {},
    disclosure: "affected_party",
  }),
  eventSchema.parse({
    schema_version: "0.1",
    id: "event:funding:24861:decision",
    run_ref: run.id,
    sequence: 3,
    occurred_at: "2026-09-15T10:00:11+00:00",
    type: "decision",
    attributes: {},
    disclosure: "affected_party",
  }),
];

const trace = traceSchema.parse({
  schema_version: "0.1",
  id: "trace:funding:24861",
  run_ref: run.id,
  system_version_ref: run.system_version_ref,
  generated_at: "2026-09-15T10:00:12+00:00",
  steps: [
    { event_ref: events[0]!.id, relationship_to_previous: "starts" },
    { event_ref: events[1]!.id, relationship_to_previous: "reviews" },
    { event_ref: events[2]!.id, relationship_to_previous: "decides" },
  ],
  disclosure: "affected_party",
});

const receipt = receiptSchema.parse({
  schema_version: "0.1",
  id: "receipt:funding:af-24861",
  run_ref: run.id,
  trace_ref: trace.id,
  system_version_ref: run.system_version_ref,
  occurred_at: "2026-09-15T10:00:12+00:00",
  ai_involvement: ["informational"],
  ai_summary: "AI identified evidence relating to eligibility criteria.",
  effect_of_ai: "A finding prompted review of the original application.",
  human_involvement: "A funding officer reviewed the original application.",
  final_authority: "human",
  outcome: "The funding officer made the eligibility decision.",
  source_content_included: false,
  disclosure: "affected_party",
  external_refs: [],
});

describe("trace bundle validation", () => {
  it("accepts a coherent run, causal trace and receipt", () => {
    const result = validateTraceBundle({ run, events, trace, receipt });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.ordered_events.map((event) => event.sequence)).toEqual([1, 2, 3]);
  });

  it("surfaces missing and cross-run events rather than silently ignoring them", () => {
    const wrongRunEvent = eventSchema.parse({
      ...events[1],
      id: "event:funding:other:review",
      run_ref: "run:funding:other",
    });
    const brokenTrace = traceSchema.parse({
      ...trace,
      id: "trace:funding:broken",
      steps: [
        { event_ref: events[0]!.id, relationship_to_previous: "starts" },
        { event_ref: wrongRunEvent.id, relationship_to_previous: "reviews" },
        { event_ref: "event:funding:missing", relationship_to_previous: "decides" },
      ],
    });

    const result = validateTraceBundle({
      run,
      events: [events[0]!, wrongRunEvent],
      trace: brokenTrace,
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "event_run_mismatch",
      "missing_event",
    ]);
  });

  it("rejects a receipt that points at a different trace or system version", () => {
    const mismatchedReceipt = receiptSchema.parse({
      ...receipt,
      id: "receipt:funding:mismatch",
      trace_ref: "trace:funding:other",
      system_version_ref: "system-version:funding-assistant:2.2",
    });

    const result = validateTraceBundle({
      run,
      events,
      trace,
      receipt: mismatchedReceipt,
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "receipt_trace_mismatch",
      "receipt_system_version_mismatch",
    ]);
  });

  it("detects a causal trace whose selected events run backwards", () => {
    const reverseTrace = traceSchema.parse({
      ...trace,
      id: "trace:funding:reverse",
      steps: [
        { event_ref: events[1]!.id, relationship_to_previous: "starts" },
        { event_ref: events[0]!.id, relationship_to_previous: "follows" },
      ],
    });

    const result = validateTraceBundle({ run, events, trace: reverseTrace });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe("non_monotonic_event_order");
  });
});
