import { describe, expect, it } from "vitest";
import { decisionAuthoritySchema, evidenceKindSchema } from "@crux/schemas";
import { actionControlLabel, authorityLabel, authorityOptions, evidenceKindLabel, evidenceKindOptions } from "../lib/labels";

describe("plain-language labels", () => {
  it("covers every canonical authority and evidence kind", () => {
    expect(authorityOptions.map((option) => option.value).sort()).toEqual([...decisionAuthoritySchema.options].sort());
    expect(evidenceKindOptions.map((option) => option.value).sort()).toEqual([...evidenceKindSchema.options].sort());
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
