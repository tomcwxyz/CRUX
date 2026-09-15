import { describe, expect, it } from "vitest";
import {
  eventSchema,
  observationSchema,
  receiptSchema,
  runSchema,
  traceSchema,
} from "../src/index.js";

const startedAt = "2026-09-15T10:00:00+00:00";
const completedAt = "2026-09-15T10:00:12+00:00";

describe("CRUX trace and receipt contracts", () => {
  it("records a metadata-first run without requiring source content", () => {
    const run = runSchema.parse({
      schema_version: "0.1",
      id: "run:funding:24861",
      system_version_ref: "system-version:funding-assistant:2.3",
      started_at: startedAt,
      completed_at: completedAt,
      status: "completed",
      capture_mode: "metadata_only",
      subject_ref: "application:AF-24861",
      disclosure: "internal",
      external_refs: [],
    });

    expect(run.capture_mode).toBe("metadata_only");
  });

  it("captures bounded event metadata for AI, human review and decisions", () => {
    const ai = eventSchema.parse({
      schema_version: "0.1",
      id: "event:funding:24861:ai",
      run_ref: "run:funding:24861",
      sequence: 1,
      occurred_at: "2026-09-15T10:00:03+00:00",
      type: "ai_invocation",
      process_node_ref: "node:extract-evidence",
      component_ref: "component:model",
      summary: "Eligibility evidence extraction ran.",
      attributes: { output_type: "eligibility-findings" },
      disclosure: "internal",
    });

    const human = eventSchema.parse({
      schema_version: "0.1",
      id: "event:funding:24861:review",
      run_ref: "run:funding:24861",
      sequence: 2,
      occurred_at: "2026-09-15T10:00:08+00:00",
      type: "human_review",
      human_role_ref: "role:funding-officer",
      summary: "Funding officer checked the original application.",
      attributes: {},
      disclosure: "affected_party",
    });

    expect(ai.type).toBe("ai_invocation");
    expect(human.type).toBe("human_review");
  });

  it("builds a causal trace rather than treating every event as equally explanatory", () => {
    const trace = traceSchema.parse({
      schema_version: "0.1",
      id: "trace:funding:24861",
      run_ref: "run:funding:24861",
      system_version_ref: "system-version:funding-assistant:2.3",
      generated_at: completedAt,
      steps: [
        {
          event_ref: "event:funding:24861:ai",
          relationship_to_previous: "starts",
        },
        {
          event_ref: "event:funding:24861:review",
          relationship_to_previous: "reviews",
        },
        {
          event_ref: "event:funding:24861:decision",
          relationship_to_previous: "decides",
        },
      ],
      summary: "AI evidence extraction informed a human eligibility decision.",
      disclosure: "affected_party",
    });

    expect(trace.steps).toHaveLength(3);
    expect(trace.steps[1]?.relationship_to_previous).toBe("reviews");
  });

  it("rejects malformed traces with duplicate events or a non-starting first step", () => {
    expect(() =>
      traceSchema.parse({
        schema_version: "0.1",
        id: "trace:bad:1",
        run_ref: "run:funding:24861",
        system_version_ref: "system-version:funding-assistant:2.3",
        generated_at: completedAt,
        steps: [
          {
            event_ref: "event:funding:24861:ai",
            relationship_to_previous: "follows",
          },
          {
            event_ref: "event:funding:24861:ai",
            relationship_to_previous: "follows",
          },
        ],
        disclosure: "internal",
      }),
    ).toThrow();
  });

  it("creates an affected-person receipt without reproducing raw source content", () => {
    const receipt = receiptSchema.parse({
      schema_version: "0.1",
      id: "receipt:funding:AF-24861",
      run_ref: "run:funding:24861",
      trace_ref: "trace:funding:24861",
      system_version_ref: "system-version:funding-assistant:2.3",
      occurred_at: completedAt,
      ai_involvement: ["informational"],
      ai_summary: "AI identified passages relating to six eligibility criteria.",
      effect_of_ai: "One finding prompted the funding officer to inspect criterion four.",
      human_involvement: "The funding officer reviewed the original application and made the eligibility decision.",
      final_authority: "human",
      outcome: "The application did not proceed beyond eligibility assessment.",
      challenge: {
        available: true,
        description: "The applicant may contact the funding team for clarification.",
      },
      source_content_included: false,
      disclosure: "affected_party",
      external_refs: [],
    });

    expect(receipt.final_authority).toBe("human");
    expect(receipt.source_content_included).toBe(false);
  });

  it("supports bounded production observations as evidence inputs", () => {
    const observation = observationSchema.parse({
      schema_version: "0.1",
      id: "observation:override-rate:2026-09",
      system_version_ref: "system-version:funding-assistant:2.3",
      period: {
        from: "2026-09-01T00:00:00+00:00",
        to: "2026-09-30T23:59:59+00:00",
      },
      measure: "human-override-rate",
      value: 0.17,
      unit: "ratio",
      sample_size: 1284,
      disclosure: "trusted",
    });

    expect(observation.sample_size).toBe(1284);
  });

  it("rejects raw undeclared content fields from metadata-only event records", () => {
    expect(() =>
      eventSchema.parse({
        schema_version: "0.1",
        id: "event:unsafe:1",
        run_ref: "run:funding:24861",
        sequence: 1,
        occurred_at: startedAt,
        type: "input_received",
        raw_input: "sensitive application text",
        attributes: {},
        disclosure: "internal",
      }),
    ).toThrow();
  });
});
