import { z } from "zod";
import {
  cruxIdSchema,
  disclosureLevelSchema,
  evidenceRelationshipSchema,
  evaluationOutcomeSchema,
  producerSchema,
  schemaVersionSchema,
  stableRefSchema,
  targetRefSchema,
  timestampSchema,
} from "./primitives.js";

export const evidenceKindSchema = z.enum([
  "evaluation",
  "system_configuration",
  "production_observation",
  "human_review",
  "audit",
  "assurance",
  "incident",
  "receipt",
  "policy",
  "research",
  "other",
]);

export const evidenceSourceKindSchema = z.enum([
  "native",
  "external_tool",
  "human",
  "organisation",
  "supplier",
  "research",
  "audit",
  "production_observation",
]);

export const evidenceMetricSchema = z.object({
  name: z.string().min(1).max(160),
  value: z.union([z.number(), z.string().min(1), z.boolean()]),
  unit: z.string().min(1).max(80).optional(),
}).strict();

export const evidenceResultSchema = z.object({
  outcome: evaluationOutcomeSchema.optional(),
  summary: z.string().min(1).max(4_000).optional(),
  metrics: z.array(evidenceMetricSchema).default([]),
}).strict().refine(
  (result) => result.outcome !== undefined || result.summary !== undefined || result.metrics.length > 0,
  "Evidence result must contain an outcome, summary or metric.",
);

export const evidenceFreshnessSchema = z.object({
  observed_at: timestampSchema,
  review_after: timestampSchema.optional(),
}).strict().superRefine((freshness, context) => {
  if (freshness.review_after && freshness.review_after <= freshness.observed_at) {
    context.addIssue({
      code: "custom",
      path: ["review_after"],
      message: "review_after must be later than observed_at.",
    });
  }
});

export const evidenceSourceSchema = z.object({
  kind: evidenceSourceKindSchema,
  producer: producerSchema,
  source_ref: stableRefSchema.optional(),
}).strict();

export const evidenceSchema = z.object({
  schema_version: schemaVersionSchema,
  id: cruxIdSchema,
  kind: evidenceKindSchema,
  title: z.string().min(1).max(240).optional(),
  summary: z.string().min(1).max(4_000),
  source: evidenceSourceSchema,
  targets: z.array(targetRefSchema).min(1),
  freshness: evidenceFreshnessSchema,
  result: evidenceResultSchema.optional(),
  limitations: z.array(z.string().min(1).max(2_000)).default([]),
  external_refs: z.array(z.url()).default([]),
  disclosure: disclosureLevelSchema.default("internal"),
}).strict();

export const evidenceLinkSchema = z.object({
  schema_version: schemaVersionSchema,
  id: cruxIdSchema,
  claim_ref: cruxIdSchema,
  evidence_ref: cruxIdSchema,
  relationship: evidenceRelationshipSchema,
  rationale: z.string().min(1).max(2_000).optional(),
  created_at: timestampSchema,
}).strict();

export const evidenceEnvelopeSchema = z.object({
  schema_version: schemaVersionSchema,
  generated_at: timestampSchema,
  producer: producerSchema,
  evidence: evidenceSchema,
  external_refs: z.array(z.url()).default([]),
}).strict().superRefine((envelope, context) => {
  const sourceProducer = envelope.evidence.source.producer;
  if (sourceProducer.name !== envelope.producer.name) {
    context.addIssue({
      code: "custom",
      path: ["evidence", "source", "producer", "name"],
      message: "Envelope producer and evidence source producer must match.",
    });
  }
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type EvidenceLink = z.infer<typeof evidenceLinkSchema>;
export type EvidenceEnvelope = z.infer<typeof evidenceEnvelopeSchema>;
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
