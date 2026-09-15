import { z } from "zod";
import {
  cruxIdSchema,
  evaluationOutcomeSchema,
  producerSchema,
  schemaVersionSchema,
  stableRefSchema,
  targetRefSchema,
  timestampSchema,
} from "./primitives.js";

export const evaluationTypeSchema = z.enum([
  "capability",
  "safety_failure",
  "workflow",
  "impact",
  "production",
  "governance_control",
]);

export const evaluationMethodKindSchema = z.enum([
  "deterministic_test",
  "labelled_dataset",
  "model_judge",
  "human_review",
  "simulation",
  "production_monitoring",
  "mixed",
  "other",
]);

export const evaluationMetricDefinitionSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().min(1).max(2_000).optional(),
  unit: z.string().min(1).max(80).optional(),
  acceptance: z.string().min(1).max(1_000).optional(),
}).strict();

export const evaluationDefinitionSchema = z.object({
  schema_version: schemaVersionSchema,
  id: cruxIdSchema,
  version: z.string().min(1).max(80),
  name: z.string().min(1).max(240),
  evaluation_type: evaluationTypeSchema,
  purpose: z.string().min(1).max(4_000),
  evaluates: z.array(targetRefSchema).min(1),
  method: z.object({
    kind: evaluationMethodKindSchema,
    description: z.string().min(1).max(4_000),
  }).strict(),
  metrics: z.array(evaluationMetricDefinitionSchema).default([]),
  limitations: z.array(z.string().min(1).max(2_000)).default([]),
  created_at: timestampSchema,
}).strict();

export const evaluationMetricResultSchema = z.object({
  name: z.string().min(1).max(160),
  value: z.union([z.number(), z.string().min(1), z.boolean()]),
  unit: z.string().min(1).max(80).optional(),
}).strict();

export const evaluationRunSchema = z.object({
  schema_version: schemaVersionSchema,
  id: cruxIdSchema,
  definition_ref: cruxIdSchema,
  definition_version: z.string().min(1).max(80),
  targets: z.array(targetRefSchema).min(1),
  conducted_at: timestampSchema,
  runner: producerSchema,
  dataset: z.object({
    description: z.string().min(1).max(4_000),
    ref: stableRefSchema.optional(),
  }).strict().optional(),
  results: z.array(evaluationMetricResultSchema).default([]),
  outcome: evaluationOutcomeSchema,
  conclusion: z.string().min(1).max(4_000).optional(),
  limitations: z.array(z.string().min(1).max(2_000)).default([]),
  evidence_ref: cruxIdSchema.optional(),
  external_refs: z.array(z.url()).default([]),
}).strict();

export type EvaluationDefinition = z.infer<typeof evaluationDefinitionSchema>;
export type EvaluationRun = z.infer<typeof evaluationRunSchema>;
export type EvaluationType = z.infer<typeof evaluationTypeSchema>;
export type EvaluationMethodKind = z.infer<typeof evaluationMethodKindSchema>;
