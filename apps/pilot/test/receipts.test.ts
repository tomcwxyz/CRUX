import { describe, expect, it } from "vitest";
import { portableBundleSchema, validateBundleReferences } from "@crux/formats";
import { appendDecisionPoint } from "../lib/authoring";
import { appendManualReceipt } from "../lib/receipts";
import { createStarterBundle } from "../lib/starter";

describe("pilot receipt authoring", () => {
  it("creates a metadata-only causal trace and affected-person receipt", () => {
    const starter = createStarterBundle("2026-09-15T12:00:00+00:00");
    const version = starter.system_versions[0];
    expect(version).toBeDefined();
    if (!version) return;

    const withDecision = appendDecisionPoint(
      starter,
      version.id,
      "2026-09-15T12:01:00+00:00",
    );
    const decision = withDecision.bundle.system_versions[0]?.decisions[0];
    expect(decision).toBeDefined();
    if (!decision) return;

    const result = appendManualReceipt(
      withDecision.bundle,
      version.id,
      {
        aiInvolvement: ["advisory"],
        aiSummary: "AI highlighted evidence relevant to eligibility.",
        effectOfAI: "The highlight prompted a funding officer to review the original application.",
        humanInvolvement: "A funding officer checked the original application and the programme rules.",
        finalAuthority: "human",
        outcome: "The funding officer made the eligibility decision.",
        decisionId: decision.id,
        challengeDescription: "The applicant can contact the grants team to question the decision.",
      },
      "2026-09-15T12:05:00+00:00",
    );

    const parsed = portableBundleSchema.parse(result.bundle);
    expect(validateBundleReferences(parsed)).toEqual({ valid: true, issues: [] });
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0]?.capture_mode).toBe("metadata_only");
    expect(parsed.events.map((event) => event.type)).toEqual([
      "ai_invocation",
      "human_review",
      "decision",
    ]);
    expect(parsed.traces[0]?.steps.map((step) => step.relationship_to_previous)).toEqual([
      "starts",
      "reviews",
      "decides",
    ]);
    expect(parsed.receipts[0]?.id).toBe(result.receiptId);
    expect(parsed.receipts[0]?.source_content_included).toBe(false);
    expect(parsed.receipts[0]?.disclosure).toBe("affected_party");
  });

  it("can create a non-human-authority receipt without inventing human involvement", () => {
    const starter = createStarterBundle("2026-09-15T12:00:00+00:00");
    const version = starter.system_versions[0];
    expect(version).toBeDefined();
    if (!version) return;

    const result = appendManualReceipt(
      starter,
      version.id,
      {
        aiInvolvement: ["conditional"],
        aiSummary: "AI classified the request into a bounded workflow category.",
        effectOfAI: "The classification selected the next rule-based route.",
        finalAuthority: "rule",
        outcome: "The configured rule routed the request to the standard queue.",
      },
      "2026-09-15T12:05:00+00:00",
    );

    const parsed = portableBundleSchema.parse(result.bundle);
    expect(parsed.events.map((event) => event.type)).toEqual(["ai_invocation", "decision"]);
    expect(parsed.receipts[0]?.human_involvement).toBeUndefined();
    expect(parsed.receipts[0]?.final_authority).toBe("rule");
    expect(validateBundleReferences(parsed)).toEqual({ valid: true, issues: [] });
  });

  it("requires human involvement when human or hybrid authority is claimed", () => {
    const starter = createStarterBundle("2026-09-15T12:00:00+00:00");
    const version = starter.system_versions[0];
    expect(version).toBeDefined();
    if (!version) return;

    expect(() => appendManualReceipt(starter, version.id, {
      aiInvolvement: ["assistive"],
      aiSummary: "AI drafted a summary.",
      effectOfAI: "The draft informed the next step.",
      finalAuthority: "human",
      outcome: "A person made the decision.",
    })).toThrow("Describe the human involvement when final authority is human or hybrid.");
  });

  it("rejects empty explanation fields", () => {
    const starter = createStarterBundle("2026-09-15T12:00:00+00:00");
    const version = starter.system_versions[0];
    expect(version).toBeDefined();
    if (!version) return;

    expect(() => appendManualReceipt(starter, version.id, {
      aiInvolvement: ["assistive"],
      aiSummary: " ",
      effectOfAI: "It informed the next step.",
      humanInvolvement: "A person reviewed the draft.",
      finalAuthority: "human",
      outcome: "A person made the decision.",
    })).toThrow("AI contribution is required.");
  });
});
