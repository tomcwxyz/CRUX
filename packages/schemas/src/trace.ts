import { z } from "zod";
import {
  cruxIdSchema,
  disclosureLevelSchema,
  schemaVersionSchema,
  stableRefSchema,
  timestampSchema,
} from "./primitives.js";
import {
  actionIdSchema,
  aiInfluenceSchema,
  challengeSchema,
  componentIdSchema,
  decisionAuthoritySchema,
  decisionIdSchema,
  humanRoleIdSchema,
  processNodeIdSchema,
  systemVersionIdSchema,
} from "./system.js";

const prefixedId = (prefix: string) =>
  cruxIdSchema.refine((value) => value.startsWith(`${prefix}:`), {
    message: `Expected an ID beginning ${prefix}:.`,
  });

export const runIdSchema = prefixedId("run");
export const eventIdSchema = prefixedId("event");
export const traceIdSchema = prefixedId("trace");
export const receiptIdSchema = prefixedId("receipt");
export const observationIdSchema = prefixedId("observation");

export const captureModeSchema = z.enum([
  "metadata_only",
  "redacted",
  "content_included",
]);

export const runStatusSchema = z.enum([
  "started",
  "completed",
  "failed",
  "cancelled",
]);

export const runSchema = z
  .object({
    schema_version: schemaVersionSchema,
    id: runIdSchema,
    system_version_ref: systemVersionIdSchema,
    started_at: timestampSchema,
    completed_at: timestampSchema.optional(),
    status: runStatusSchema,
    capture_mode: captureModeSchema.default("metadata_only"),
    subject_ref: z.string().min(1).max(500).optional(),
    disclosure: disclosureLevelSchema.default("internal"),
    external_refs: z.array(z.url()).default([]),
  })
  .strict()
  .superRefine((run, context) => {
    if (
      run.completed_at !== undefined &&
      Date.parse(run.completed_at) < Date.parse(run.started_at)
    ) {
      context.addIssue({
        code: "custom",
        path: ["completed_at"],
        message: "completed_at cannot precede started_at.",
      });
    }
    if (run.status !== "started" && run.completed_at === undefined) {
      context.addIssue({
        code: "custom",
        path: ["completed_at"],
        message: `A ${run.status} run must include completed_at.`,
      });
    }
  });

export const eventTypeSchema = z.enum([
  "input_received",
  "retrieval",
  "transformation",
  "ai_invocation",
  "rule_evaluated",
  "output_created",
  "recommendation",
  "human_review",
  "override",
  "decision",
  "action_proposed",
  "action_executed",
  "error",
  "escalation",
]);

const eventAttributeValueSchema = z.union([
  z.string().max(1_000),
  z.number(),
  z.boolean(),
]);

export const eventSchema = z
  .object({
    schema_version: schemaVersionSchema,
    id: eventIdSchema,
    run_ref: runIdSchema,
    sequence: z.number().int().nonnegative(),
    occurred_at: timestampSchema,
    type: eventTypeSchema,
    process_node_ref: processNodeIdSchema.optional(),
    component_ref: componentIdSchema.optional(),
    decision_ref: decisionIdSchema.optional(),
    action_ref: actionIdSchema.optional(),
    human_role_ref: humanRoleIdSchema.optional(),
    summary: z.string().min(1).max(2_000).optional(),
    attributes: z.record(z.string().min(1).max(120), eventAttributeValueSchema).default({}),
    disclosure: disclosureLevelSchema.default("internal"),
  })
  .strict();

export const traceRelationshipSchema = z.enum([
  "starts",
  "informs",
  "triggers",
  "reviews",
  "overrides",
  "decides",
  "executes",
  "escalates",
  "follows",
]);

export const traceStepSchema = z
  .object({
    event_ref: eventIdSchema,
    relationship_to_previous: traceRelationshipSchema,
    explanation: z.string().min(1).max(2_000).optional(),
  })
  .strict();

export const traceSchema = z
  .object({
    schema_version: schemaVersionSchema,
    id: traceIdSchema,
    run_ref: runIdSchema,
    system_version_ref: systemVersionIdSchema,
    generated_at: timestampSchema,
    steps: z.array(traceStepSchema).min(1),
    summary: z.string().min(1).max(4_000).optional(),
    disclosure: disclosureLevelSchema.default("internal"),
  })
  .strict()
  .superRefine((trace, context) => {
    const seen = new Set<string>();
    for (const [index, step] of trace.steps.entries()) {
      if (seen.has(step.event_ref)) {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "event_ref"],
          message: `Trace contains duplicate event ${step.event_ref}.`,
        });
      }
      seen.add(step.event_ref);

      if (index === 0 && step.relationship_to_previous !== "starts") {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "relationship_to_previous"],
          message: "The first trace step must use starts.",
        });
      }
      if (index > 0 && step.relationship_to_previous === "starts") {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "relationship_to_previous"],
          message: "Only the first trace step may use starts.",
        });
      }
    }
  });

export const receiptSchema = z
  .object({
    schema_version: schemaVersionSchema,
    id: receiptIdSchema,
    run_ref: runIdSchema,
    trace_ref: traceIdSchema,
    system_version_ref: systemVersionIdSchema,
    occurred_at: timestampSchema,
    ai_involvement: z.array(aiInfluenceSchema).min(1),
    ai_summary: z.string().min(1).max(4_000),
    effect_of_ai: z.string().min(1).max(4_000),
    human_involvement: z.string().min(1).max(4_000).optional(),
    final_authority: decisionAuthoritySchema,
    outcome: z.string().min(1).max(4_000),
    challenge: challengeSchema.optional(),
    source_content_included: z.boolean().default(false),
    disclosure: disclosureLevelSchema.default("affected_party"),
    external_refs: z.array(z.url()).default([]),
  })
  .strict();

export const observationValueSchema = z.union([
  z.number(),
  z.string().min(1).max(1_000),
  z.boolean(),
]);

export const observationSchema = z
  .object({
    schema_version: schemaVersionSchema,
    id: observationIdSchema,
    system_version_ref: systemVersionIdSchema,
    period: z
      .object({
        from: timestampSchema,
        to: timestampSchema,
      })
      .strict(),
    measure: z.string().min(1).max(240),
    value: observationValueSchema,
    unit: z.string().min(1).max(120).optional(),
    sample_size: z.number().int().nonnegative().optional(),
    evidence_ref: stableRefSchema.optional(),
    disclosure: disclosureLevelSchema.default("internal"),
  })
  .strict()
  .superRefine((observation, context) => {
    if (Date.parse(observation.period.to) < Date.parse(observation.period.from)) {
      context.addIssue({
        code: "custom",
        path: ["period", "to"],
        message: "Observation period end cannot precede its start.",
      });
    }
  });

export type Run = z.infer<typeof runSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type CaptureMode = z.infer<typeof captureModeSchema>;
export type Event = z.infer<typeof eventSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;
export type Trace = z.infer<typeof traceSchema>;
export type TraceStep = z.infer<typeof traceStepSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type Observation = z.infer<typeof observationSchema>;
