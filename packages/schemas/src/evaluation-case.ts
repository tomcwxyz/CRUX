import { z } from "zod";
import {
  cruxIdSchema,
  disclosureLevelSchema,
  schemaVersionSchema,
  stableRefSchema,
  timestampSchema,
} from "./primitives.js";
import { systemVersionIdSchema } from "./system.js";

const evaluationCaseIdSchema = cruxIdSchema.refine(
  (value) => value.startsWith("evaluation-case:"),
  { message: "Expected an ID beginning evaluation-case:." },
);

export const evaluationCaseSourceKindSchema = z.enum([
  "receipt",
  "incident",
  "observation",
  "human_review",
  "other",
]);

export const evaluationCaseStatusSchema = z.enum([
  "proposed",
  "accepted",
  "retired",
]);

export const evaluationCaseSchema = z
  .object({
    schema_version: schemaVersionSchema,
    id: evaluationCaseIdSchema,
    source: z
      .object({
        kind: evaluationCaseSourceKindSchema,
        ref: stableRefSchema,
      })
      .strict(),
    system_version_ref: systemVersionIdSchema,
    title: z.string().min(1).max(240),
    scenario_summary: z.string().min(1).max(4_000),
    learning_question: z.string().min(1).max(4_000),
    expected_behaviour: z.string().min(1).max(4_000).optional(),
    fixture_ref: stableRefSchema.optional(),
    evaluation_definition_refs: z.array(cruxIdSchema).default([]),
    status: evaluationCaseStatusSchema.default("proposed"),
    disclosure: disclosureLevelSchema.default("internal"),
    created_at: timestampSchema,
    accepted_at: timestampSchema.optional(),
  })
  .strict()
  .superRefine((evaluationCase, context) => {
    if (evaluationCase.status === "accepted" && evaluationCase.accepted_at === undefined) {
      context.addIssue({
        code: "custom",
        path: ["accepted_at"],
        message: "An accepted evaluation case must record accepted_at.",
      });
    }
    if (
      evaluationCase.accepted_at !== undefined &&
      Date.parse(evaluationCase.accepted_at) < Date.parse(evaluationCase.created_at)
    ) {
      context.addIssue({
        code: "custom",
        path: ["accepted_at"],
        message: "accepted_at cannot precede created_at.",
      });
    }
  });

export type EvaluationCase = z.infer<typeof evaluationCaseSchema>;
export type EvaluationCaseSourceKind = z.infer<typeof evaluationCaseSourceKindSchema>;
export type EvaluationCaseStatus = z.infer<typeof evaluationCaseStatusSchema>;
