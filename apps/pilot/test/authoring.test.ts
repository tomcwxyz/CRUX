import { describe, expect, it } from "vitest";
import {
  inspectBundle,
  portableBundleSchema,
  validateBundleReferences,
} from "@crux/formats";
import { appendAIUse, appendManualEvidence } from "../lib/authoring";
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

describe("pilot evidence authoring", () => {
  it("adds bounded manual evidence and links it to the selected claim", () => {
    const starter = createStarterBundle("2026-09-15T11:30:00+00:00");
    const claim = starter.claims[0];
    expect(claim).toBeDefined();
    if (!claim) return;

    const result = appendManualEvidence(
      starter,
      claim.id,
      {
        summary: "A staff review of 20 recent cases found a human checked every AI contribution.",
        kind: "human_review",
        relationship: "supports",
        disclosure: "public",
        observedAt: "2026-09-15T11:32:00+00:00",
        limitations: ["Small sample reviewed during one month."],
      },
      "2026-09-15T11:35:00+00:00",
    );

    expect(result.bundle.evidence).toHaveLength(1);
    expect(result.bundle.evidence_links).toHaveLength(1);
    expect(result.bundle.evidence_links[0]?.claim_ref).toBe(claim.id);
    expect(result.bundle.evidence_links[0]?.evidence_ref).toBe(result.evidenceId);

    const parsed = portableBundleSchema.parse(result.bundle);
    expect(validateBundleReferences(parsed).valid).toBe(true);
    expect(inspectBundle(parsed).claim_statuses[0]?.status).toBe("supported");
  });

  it("rejects blank evidence summaries instead of creating placeholder evidence", () => {
    const starter = createStarterBundle("2026-09-15T11:30:00+00:00");
    const claim = starter.claims[0];
    expect(claim).toBeDefined();
    if (!claim) return;

    expect(() =>
      appendManualEvidence(starter, claim.id, {
        summary: "   ",
        kind: "other",
        relationship: "inconclusive",
        disclosure: "internal",
      }),
    ).toThrow("Evidence needs a short summary.");
  });
});
