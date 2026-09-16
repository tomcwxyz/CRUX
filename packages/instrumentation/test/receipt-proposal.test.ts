import { describe, expect, it } from "vitest";
import {
  createInstrumentationSession,
  proposeReceiptFromObservedRun,
} from "../src/index.js";

describe("observed receipt proposals", () => {
  it("builds a bounded causal trace while leaving organisational meaning for review", () => {
    const session = createInstrumentationSession({
      runId: "run:eligibility:case-42",
      systemVersionRef: "system-version:eligibility:1.0",
      startedAt: "2026-09-16T08:00:00Z",
    });

    session.record({
      type: "ai_invocation",
      occurredAt: "2026-09-16T08:00:01Z",
      componentRef: "component:eligibility-model",
      summary: "AI invocation completed.",
      attributes: { response_model: "model-b", private_debug_value: "DO NOT COPY" },
    });
    session.record({
      type: "human_review",
      occurredAt: "2026-09-16T08:00:02Z",
      humanRoleRef: "role:eligibility-officer",
      summary: "Human review completed.",
    });
    session.record({
      type: "decision",
      occurredAt: "2026-09-16T08:00:03Z",
      decisionRef: "decision:eligibility",
      summary: "Decision recorded.",
    });
    session.record({
      type: "action_executed",
      occurredAt: "2026-09-16T08:00:04Z",
      actionRef: "action:notify-applicant",
      summary: "Notification action executed.",
    });
    session.finish("completed", "2026-09-16T08:00:05Z");

    const snapshot = session.snapshot();
    const result = proposeReceiptFromObservedRun(snapshot.run, snapshot.events);

    expect(result.trace.steps.map((step) => step.relationship_to_previous)).toEqual([
      "starts",
      "reviews",
      "decides",
      "executes",
    ]);
    expect(result.proposal.observed).toEqual({
      ai_invocation_count: 1,
      human_review_count: 1,
      override_count: 0,
      decision_count: 1,
      action_count: 1,
      escalation_count: 0,
    });
    expect(result.proposal.questions_to_resolve.map((item) => item.field)).toEqual([
      "ai_involvement",
      "effect_of_ai",
      "human_involvement",
      "final_authority",
      "outcome",
      "challenge",
    ]);
    expect(result.proposal.source_content_included).toBe(false);
    expect(JSON.stringify(result)).not.toContain("DO NOT COPY");
  });

  it("refuses to propose an AI receipt when no AI invocation was observed", () => {
    const session = createInstrumentationSession({
      runId: "run:manual-only",
      systemVersionRef: "system-version:eligibility:1.0",
      startedAt: "2026-09-16T08:00:00Z",
    });
    session.record({ type: "human_review", occurredAt: "2026-09-16T08:00:01Z" });
    session.finish("completed", "2026-09-16T08:00:02Z");

    const snapshot = session.snapshot();
    expect(() => proposeReceiptFromObservedRun(snapshot.run, snapshot.events)).toThrow(
      /no observed AI invocation/,
    );
  });
});
