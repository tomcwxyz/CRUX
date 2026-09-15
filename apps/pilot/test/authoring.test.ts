import { describe, expect, it } from "vitest";
import { portableBundleSchema, validateBundleReferences } from "@crux/formats";
import { appendAIUse } from "../lib/authoring";
import { createStarterBundle } from "../lib/starter";

describe("pilot multi-use authoring", () => {
  it("adds a complete second AI-use graph without breaking the canonical bundle", () => {
    const starter = createStarterBundle("2026-09-15T11:30:00+00:00");
    const result = appendAIUse(starter, "2026-09-15T11:35:00+00:00");

    expect(result.bundle.ai_uses).toHaveLength(2);
    expect(result.bundle.systems).toHaveLength(2);
    expect(result.bundle.system_versions).toHaveLength(2);
    expect(result.bundle.claims).toHaveLength(2);
    expect(result.bundle.ai_uses[1]?.id).toBe(result.aiUseId);

    const parsed = portableBundleSchema.parse(result.bundle);
    expect(validateBundleReferences(parsed)).toEqual({ valid: true, issues: [] });
  });

  it("allocates stable non-colliding ids across repeated additions", () => {
    const starter = createStarterBundle("2026-09-15T11:30:00+00:00");
    const second = appendAIUse(starter, "2026-09-15T11:35:00+00:00");
    const third = appendAIUse(second.bundle, "2026-09-15T11:40:00+00:00");

    expect(new Set(third.bundle.ai_uses.map((item) => item.id)).size).toBe(3);
    expect(new Set(third.bundle.systems.map((item) => item.id)).size).toBe(3);
    expect(new Set(third.bundle.system_versions.map((item) => item.id)).size).toBe(3);
    expect(validateBundleReferences(portableBundleSchema.parse(third.bundle)).valid).toBe(true);
  });
});
