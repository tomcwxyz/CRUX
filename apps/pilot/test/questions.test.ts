import { describe, expect, it } from "vitest";
import { appendDecisionPoint, appendManualEvidence } from "../lib/authoring";
import { getPilotQuestions } from "../lib/questions";
import { appendManualReceipt } from "../lib/receipts";
import { createStarterBundle } from "../lib/starter";

describe("pilot questions to resolve", () => {
  it("surfaces missing decision, affected people, evidence and receipt without scoring", () => {
    const bundle = createStarterBundle("2026-09-15T12:00:00+00:00");
    const use = bundle.ai_uses[0];
    const version = bundle.system_versions[0];
    expect(use).toBeDefined();
    expect(version).toBeDefined();
    if (!use || !version) return;

    use.consequential = true;
    use.people_affected = [];

    const questions = getPilotQuestions(bundle, version.id);
    expect(questions.map((item) => item.id)).toEqual(expect.arrayContaining([
      "people-affected",
      "decision-point",
      "case-receipt",
    ]));
    expect(questions.some((item) => item.kind === "declared_only")).toBe(true);
  });

  it("removes resolved prompts while keeping an intentionally unevidenced claim visible until evidence is linked", () => {
    const starter = createStarterBundle("2026-09-15T12:00:00+00:00");
    const use = starter.ai_uses[0];
    const version = starter.system_versions[0];
    const claim = starter.claims[0];
    expect(use).toBeDefined();
    expect(version).toBeDefined();
    expect(claim).toBeDefined();
    if (!use || !version || !claim) return;

    use.consequential = true;
    use.people_affected = ["funding applicants"];
    const withDecision = appendDecisionPoint(starter, version.id, "2026-09-15T12:01:00+00:00");
    const decision = withDecision.bundle.system_versions[0]?.decisions[0];
    expect(decision).toBeDefined();
    if (!decision) return;
    decision.challenge = { available: false };

    const withEvidence = appendManualEvidence(
      withDecision.bundle,
      claim.id,
      {
        summary: "Configuration review confirmed a human reviewer remains responsible.",
        kind: "system_configuration",
        relationship: "supports",
        disclosure: "public",
      },
      "2026-09-15T12:02:00+00:00",
    );

    const withReceipt = appendManualReceipt(
      withEvidence.bundle,
      version.id,
      {
        aiInvolvement: ["informational"],
        aiSummary: "AI highlighted relevant evidence.",
        effectOfAI: "The highlight prompted a human review.",
        humanInvolvement: "A funding officer checked the original application.",
        finalAuthority: "human",
        outcome: "The funding officer made the decision.",
        decisionId: decision.id,
      },
      "2026-09-15T12:03:00+00:00",
    );

    const questions = getPilotQuestions(withReceipt.bundle, version.id);
    expect(questions.find((item) => item.id === "people-affected")).toBeUndefined();
    expect(questions.find((item) => item.id === "decision-point")).toBeUndefined();
    expect(questions.find((item) => item.id === "case-receipt")).toBeUndefined();
    expect(questions.find((item) => item.id === `claim-evidence:${claim.id}`)).toBeUndefined();
  });

  it("asks for a responsible role when human authority is declared without one", () => {
    const starter = createStarterBundle("2026-09-15T12:00:00+00:00");
    const version = starter.system_versions[0];
    expect(version).toBeDefined();
    if (!version) return;

    const result = appendDecisionPoint(starter, version.id, "2026-09-15T12:01:00+00:00");
    const decision = result.bundle.system_versions[0]?.decisions[0];
    expect(decision).toBeDefined();
    if (!decision) return;
    decision.responsible_role_refs = [];

    const questions = getPilotQuestions(result.bundle, version.id);
    expect(questions.some((item) => item.id === `decision-role:${decision.id}`)).toBe(true);
  });
});
