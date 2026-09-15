import { z } from "zod";

export const schemaVersionSchema = z.literal("0.1");

export const cruxIdSchema = z.string().regex(
  /^[a-z][a-z0-9-]*(?::[a-z0-9][a-z0-9._-]*)+$/,
  "Expected a stable namespaced ID such as claim:no-autonomous-rejection.",
);

export const stableRefSchema = z.union([cruxIdSchema, z.url()]);

export const timestampSchema = z.string().datetime({ offset: true });

export const disclosureLevelSchema = z.enum([
  "public",
  "affected_party",
  "trusted",
  "internal",
]);

export const evidenceRelationshipSchema = z.enum([
  "supports",
  "contradicts",
  "qualifies",
  "inconclusive",
]);

export const evaluationOutcomeSchema = z.enum([
  "pass",
  "fail",
  "uncertain",
  "incomplete",
]);

export const knowledgeStatusSchema = z.enum([
  "known",
  "unknown",
  "not_applicable",
  "not_disclosed",
  "withheld",
]);

export const targetKindSchema = z.enum([
  "organisation",
  "ai_use",
  "system",
  "system_version",
  "process",
  "decision",
  "action",
  "risk",
  "safeguard",
  "claim",
  "practice",
  "repository",
  "other",
]);

export const targetRefSchema = z.object({
  kind: targetKindSchema,
  ref: stableRefSchema,
}).strict();

export const producerSchema = z.object({
  name: z.string().min(1).max(160),
  version: z.string().min(1).max(120).optional(),
  uri: z.url().optional(),
}).strict();

export type DisclosureLevel = z.infer<typeof disclosureLevelSchema>;
export type EvidenceRelationship = z.infer<typeof evidenceRelationshipSchema>;
export type EvaluationOutcome = z.infer<typeof evaluationOutcomeSchema>;
export type TargetRef = z.infer<typeof targetRefSchema>;
export type Producer = z.infer<typeof producerSchema>;
