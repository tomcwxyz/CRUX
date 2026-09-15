import { describe, expect, it } from "vitest";
import {
  eventSchema,
  receiptSchema,
  traceSchema,
} from "@crux/schemas";
import { proposeEvaluationCaseFromReceipt } from "../src/learning.js";
import { projectTraceForDisclosure } from "../src/projection.js";

const receipt = receiptSchema.parse({
  schema_version: "0.1",
  id: "receipt:funding:af-24861",
  run_ref: "run:funding:24861",
  trace_ref: "trace:funding:24861",
  system_version_ref: "system-version:funding-assistant:2.3",
  occurred_at: "2026-09-15T10:00:12+00:00",
  ai_involvement: ["informational"],
  ai_summary: "AI identified evidence relating to eligibility criteria.",
  effect_of_ai: "A finding prompted review of the original application.",
  human_involvement: "A funding officer reviewed the source and made the decision.",
  final_authority: "human",
  outcome: "The application did not proceed.",
  challenge: {
    available: true,
    description: "The applicant may request clarification.",
  },
  source_content_included: false,
  disclosure: "affected_party",
  external_refs: [],
});

const events = [
  eventSchema.parse({
    schema_version: "0.1",
    id: "event:funding:24861:input",
    run_ref: "run:funding:24861",
    sequence: 0,
    occurred_at: "2026-09-15T10:00:01+00:00",
    type: "input_received",
    summary: "Application received.",
    attributes: { private_reference: "internal-case-24861" },
    disclosure: "internal",
  }),
  eventSchema.parse({
    schema_version: "0.1",
    id: "event:funding:24861:ai",
    run_ref: "run:funding:24861",
    sequence: 1,
    occurred_at: "2026-09-15T10:00:03+00:00",
    type: "ai_invocation",
    summary: "AI extracted eligibility evidence.",
    attributes: { model_route: "provider-internal-route" },
    disclosure: "internal",
  }),
  eventSchema.parse({
    schema_version: "0.1",
    id: "event:funding:24861:review",
    run_ref: "run:funding:24861",
    sequence: 2,
    occurred_at: "2026-09-15T10:00:08+00:00",
    type: "human_review",
    summary: "A funding officer reviewed the original application.",
    attributes: { staff_id: "private-staff-ref" },
    disclosure: "affected_party",
  }),
  eventSchema.parse({
    schema_version: "0.1",
    id: "event:funding:24861:decision",
    run_ref: "run:funding:24861",
    sequence: 3,
    occurred_at: "2026-09-15T10:00:11+00:00",
    type: "decision",
    summary: "A funding officer made the eligibility decision.",
    attributes: {},
    disclosure: "affected_party",
  }),
];

const trace = traceSchema.parse({
  schema_version: "0.1",
  id: "trace:funding:24861",
  run_ref: "run:funding:24861",
  system_version_ref: "system-version:funding-assistant:2.3",
  generated_at: "2026-09-15T10:00:12+00:00",
  steps: [
    { event_ref: events[0]!.id, relationship_to_previous: "starts" },
    { event_ref: events[1]!.id, relationship_to_previous: "triggers" },
    { event_ref: events[2]!.id, relationship_to_previous: "reviews" },
    { event_ref: events[3]!.id, relationship_to_previous: "decides" },
  ],
  summary: "AI evidence extraction contributed to a human eligibility decision.",
  disclosure: "affected_party",
});

describe("learning and disclosure projections", () => {
  it("turns a receipt into a proposed evaluation case, never an automatically accepted one", () => {
    const evaluationCase = proposeEvaluationCaseFromReceipt({
      id: "evaluation-case:funding:terse-language",
      receipt,
      title: "Terse application evidence extraction",
      scenarioSummary: "The receipt exposed an evidence extraction case worth preserving.",
      learningQuestion: "Does the system reliably identify evidence in unusually terse applications?",
      expectedBehaviour: "Relevant evidence should be surfaced without requiring verbose prose.",
      fixtureRef: "fixture:funding:terse-language",
      createdAt: "2026-09-15T11:00:00+00:00",
    });

    expect(evaluationCase.status).toBe("proposed");
    expect(evaluationCase.source).toEqual({
      kind: "receipt",
      ref: receipt.id,
    });
    expect(evaluationCase.accepted_at).toBeUndefined();
  });

  it("creates an affected-person trace view without leaking internal event attributes", () => {
    const projection = projectTraceForDisclosure({
      trace,
      events,
      receipt,
      maximumLevel: "affected_party",
    });

    expect(projection.trace_visible).toBe(true);
    expect(projection.hidden_event_count).toBe(2);
    expect(projection.events.map((event) => event.type)).toEqual([
      "human_review",
      "decision",
    ]);
    expect(projection.events[0]?.relationship_to_previous).toBe("starts");
    expect(projection.events[0]?.causal_context_incomplete).toBe(true);
    expect("attributes" in projection.events[0]!).toBe(false);
    expect(projection.receipt?.outcome).toBe("The application did not proceed.");
  });

  it("can expose a receipt even when the canonical trace remains internal", () => {
    const internalTrace = traceSchema.parse({
      ...trace,
      id: "trace:funding:internal",
      disclosure: "internal",
    });
    const projection = projectTraceForDisclosure({
      trace: internalTrace,
      events,
      receipt,
      maximumLevel: "affected_party",
    });

    expect(projection.trace_visible).toBe(false);
    expect(projection.events).toEqual([]);
    expect(projection.receipt?.id).toBe(receipt.id);
  });

  it("does not expose affected-person material in a public projection", () => {
    const publicTrace = traceSchema.parse({
      ...trace,
      id: "trace:funding:public-shell",
      disclosure: "public",
    });
    const projection = projectTraceForDisclosure({
      trace: publicTrace,
      events,
      receipt,
      maximumLevel: "public",
    });

    expect(projection.trace_visible).toBe(true);
    expect(projection.events).toEqual([]);
    expect(projection.receipt).toBeUndefined();
    expect(projection.hidden_event_count).toBe(4);
  });
});
