import { z } from "zod";

export const DiscoverySourceKindSchema = z.enum([
  "source_code",
  "runtime",
  "workflow_export",
  "gateway",
  "platform",
  "manual",
]);
export type DiscoverySourceKind = z.infer<typeof DiscoverySourceKindSchema>;

export const DiscoverySignalKindSchema = z.enum([
  "ai_sdk",
  "ai_provider",
  "provider_configuration",
  "model_call",
  "workflow_job",
  "human_review_surface",
  "decision_surface",
  "action_surface",
  "tool_boundary",
  "runtime_observation",
]);
export type DiscoverySignalKind = z.infer<typeof DiscoverySignalKindSchema>;

export const DiscoveryConfidenceSchema = z.enum(["high", "medium", "low"]);
export type DiscoveryConfidence = z.infer<typeof DiscoveryConfidenceSchema>;

export const DiscoverySignalScopeSchema = z.enum(["shared", "use"]);
export type DiscoverySignalScope = z.infer<typeof DiscoverySignalScopeSchema>;

export const DiscoveryEvidenceSchema = z.object({
  path: z.string().min(1).optional(),
  line: z.number().int().positive().optional(),
  symbol: z.string().min(1).optional(),
  detail: z.string().min(1),
}).strict();
export type DiscoveryEvidence = z.infer<typeof DiscoveryEvidenceSchema>;

export const DiscoverySignalSchema = z.object({
  id: z.string().min(1),
  kind: DiscoverySignalKindSchema,
  label: z.string().min(1),
  confidence: DiscoveryConfidenceSchema,
  technology: z.string().min(1).optional(),
  workflow_hint: z.string().min(1).optional(),
  candidate_label: z.string().min(1).optional(),
  scope_hint: DiscoverySignalScopeSchema.optional(),
  evidence: z.array(DiscoveryEvidenceSchema).min(1),
}).strict();
export type DiscoverySignal = z.infer<typeof DiscoverySignalSchema>;

export const DiscoveryReportSchema = z.object({
  format: z.literal("crux-discovery/0.1"),
  generated_at: z.string().datetime(),
  source: z.object({
    kind: DiscoverySourceKindSchema,
    provider: z.string().min(1),
    label: z.string().min(1),
    external_ref: z.string().min(1).optional(),
  }).strict(),
  signals: z.array(DiscoverySignalSchema),
  limitations: z.array(z.string().min(1)).default([]),
}).strict();
export type DiscoveryReport = z.infer<typeof DiscoveryReportSchema>;

export const DiscoveryQuestionSchema = z.enum([
  "purpose",
  "people_affected",
  "authority",
  "challenge_route",
  "action_limits",
]);
export type DiscoveryQuestion = z.infer<typeof DiscoveryQuestionSchema>;

export const DiscoveryCandidateSchema = z.object({
  id: z.string().min(1),
  status: z.literal("candidate"),
  name: z.string().min(1),
  confidence: DiscoveryConfidenceSchema,
  signal_refs: z.array(z.string().min(1)).min(1),
  observed: z.object({
    technologies: z.array(z.string().min(1)),
    ai_boundaries: z.array(z.string().min(1)),
    workflow_hints: z.array(z.string().min(1)),
    human_surfaces: z.array(z.string().min(1)),
    decision_surfaces: z.array(z.string().min(1)),
    action_surfaces: z.array(z.string().min(1)),
  }).strict(),
  unanswered: z.array(DiscoveryQuestionSchema),
  explanation: z.string().min(1),
}).strict();
export type DiscoveryCandidate = z.infer<typeof DiscoveryCandidateSchema>;

export const DiscoveryPowerSchema = z.enum(["suggest", "recommend", "decide", "act"]);
export type DiscoveryPower = z.infer<typeof DiscoveryPowerSchema>;

export const DiscoveryActionControlSchema = z.enum([
  "human_approval",
  "rule_bounded",
  "automatic_bounded",
]);
export type DiscoveryActionControl = z.infer<typeof DiscoveryActionControlSchema>;

export const DiscoveryConfirmationSchema = z
  .object({
    organisation_name: z.string().min(1).max(240),
    purpose: z.string().min(1).max(4_000),
    people_affected: z.array(z.string().min(1).max(240)).default([]),
    consequential: z.boolean(),
    power: DiscoveryPowerSchema,
    action_control: DiscoveryActionControlSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.power === "act" && value.action_control === undefined) {
      context.addIssue({
        code: "custom",
        path: ["action_control"],
        message: "An AI use that can act must say what constrains that action.",
      });
    }
    if (value.power !== "act" && value.action_control !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["action_control"],
        message: "Action control only applies when the AI can act.",
      });
    }
  });
export type DiscoveryConfirmation = z.infer<typeof DiscoveryConfirmationSchema>;
