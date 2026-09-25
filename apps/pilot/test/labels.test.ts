import { describe, expect, it } from "vitest";
import { aiAgencySchema, decisionAuthoritySchema, evidenceKindSchema, evidenceRelationshipSchema, knowledgeStatusSchema, reversibilitySchema } from "@crux/schemas";
import {
  actionControlLabel,
  agencyOptions,
  authorityLabel,
  authorityOptions,
  evidenceKindLabel,
  evidenceKindOptions,
  knowledgeStatusOptions,
  relationshipOptions,
  reversibilityOptions,
} from "../lib/labels";

describe("plain-language labels", () => {
  it.each([
    ["authority", authorityOptions, decisionAuthoritySchema.options],
    ["agency", agencyOptions, aiAgencySchema.options],
    ["evidence kind", evidenceKindOptions, evidenceKindSchema.options],
    ["relationship", relationshipOptions, evidenceRelationshipSchema.options],
    ["reversibility", reversibilityOptions, reversibilitySchema.options],
    ["knowledge status", knowledgeStatusOptions, knowledgeStatusSchema.options],
  ] as const)("labels every canonical %s value", (_name, options, values) => {
    expect(options.map((option) => option.value).sort()).toEqual([...values].sort());
  });

  it("never shows raw schema values to a reader", () => {
    expect(authorityLabel("human")).toBe("A person");
    expect(evidenceKindLabel("system_configuration")).toBe("System configuration");
    expect(actionControlLabel("human_approval")).toBe("A person must approve it");
  });

  it("falls back to readable text for unexpected values", () => {
    expect(authorityLabel("new_kind_of_authority")).toBe("new kind of authority");
  });
});
