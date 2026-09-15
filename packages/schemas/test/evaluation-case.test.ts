import { describe, expect, it } from "vitest";
import { evaluationCaseSchema } from "../src/index.js";

describe("evaluation cases", () => {
  it("accepts a proposed case linked back to a receipt", () => {
    const evaluationCase = evaluationCaseSchema.parse({
      schema_version: "0.1",
      id: "evaluation-case:funding:terse-language",
      source: {
        kind: "receipt",
        ref: "receipt:funding:af-24861",
      },
      system_version_ref: "system-version:funding-assistant:2.3",
      title: "Terse application evidence extraction",
      scenario_summary: "A real receipt exposed an edge case worth preserving.",
      learning_question: "Does the system reliably identify evidence in unusually terse applications?",
      expected_behaviour: "Relevant evidence should still be surfaced.",
      fixture_ref: "fixture:funding:terse-language",
      evaluation_definition_refs: ["evaluation-definition:evidence-recall:1"],
      status: "proposed",
      disclosure: "internal",
      created_at: "2026-09-15T11:00:00+00:00",
    });

    expect(evaluationCase.status).toBe("proposed");
    expect(evaluationCase.source.kind).toBe("receipt");
  });

  it("requires an acceptance timestamp before a case becomes accepted", () => {
    expect(() =>
      evaluationCaseSchema.parse({
        schema_version: "0.1",
        id: "evaluation-case:funding:accepted",
        source: {
          kind: "receipt",
          ref: "receipt:funding:af-24861",
        },
        system_version_ref: "system-version:funding-assistant:2.3",
        title: "Accepted regression case",
        scenario_summary: "Example scenario.",
        learning_question: "Does the regression recur?",
        evaluation_definition_refs: [],
        status: "accepted",
        disclosure: "internal",
        created_at: "2026-09-15T11:00:00+00:00",
      }),
    ).toThrow();
  });
});
