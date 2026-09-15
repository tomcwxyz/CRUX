import { z } from "zod";
import {
  cruxIdSchema,
  disclosureLevelSchema,
  schemaVersionSchema,
  targetRefSchema,
  timestampSchema,
} from "./primitives.js";

export const claimTypeSchema = z.enum([
  "descriptive",
  "behavioural",
  "control",
  "performance",
  "safety",
  "impact",
]);

export const claimStatusSchema = z.enum([
  "active",
  "superseded",
  "withdrawn",
]);

export const claimSchema = z.object({
  schema_version: schemaVersionSchema,
  id: cruxIdSchema,
  type: claimTypeSchema,
  statement: z.string().min(1).max(4_000),
  applies_to: z.array(targetRefSchema).min(1),
  owner_role: z.string().min(1).max(240).optional(),
  rationale: z.string().min(1).max(4_000).optional(),
  status: claimStatusSchema.default("active"),
  disclosure: disclosureLevelSchema.default("internal"),
  created_at: timestampSchema,
  review_after: timestampSchema.optional(),
}).strict().superRefine((claim, context) => {
  if (claim.review_after && claim.review_after <= claim.created_at) {
    context.addIssue({
      code: "custom",
      path: ["review_after"],
      message: "review_after must be later than created_at.",
    });
  }
});

export type Claim = z.infer<typeof claimSchema>;
export type ClaimType = z.infer<typeof claimTypeSchema>;
export type ClaimStatus = z.infer<typeof claimStatusSchema>;
