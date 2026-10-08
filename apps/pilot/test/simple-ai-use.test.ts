import { describe, expect, it } from "vitest";
import { portableBundleSchema, redactBundle, validateBundleReferences } from "@crux/formats";
import { appendManualEvidenceWithSource } from "../lib/manual-evidence";
import { buildReaderModel } from "../lib/reader-model";
import { evidenceTarget, makeSimpleAIUseRecord, needsDetailedAuthoring, type SimpleUseAnswers } from "../lib/simple-ai-use";

const baseline: SimpleUseAnswers = {
  name: "Drafting letters",
  description: "AI helps us draft letters, which a person checks before sending.",
  organisation: "Example charity",
  role: "assist",
  control: "person",
  consequential: false,
  peopleAffected: "",
};

describe("simple AI-use authoring", () => {
  it("creates a portable valid draft from a short real-world description", () => {
    const bundle = makeSimpleAIUseRecord(baseline, "2026-10-08T08:00:00.000Z");
    expect(portableBundleSchema.safeParse(bundle).success).toBe(true);
    expect(validateBundleReferences(bundle).valid).toBe(true);
    expect(bundle.ai_uses[0]?.name).toBe("Drafting letters");
    expect(bundle.claims[0]?.statement).toBe(baseline.description);
    expect(bundle.systems[0]?.influence).toEqual(["assistive"]);
    expect(bundle.system_versions[0]?.decisions).toEqual([]);
    expect(bundle.system_versions[0]?.process.nodes.map((node) => node.type)).toEqual(["input","ai","human","output"]);
    expect(bundle.evidence).toHaveLength(0);
    expect(bundle.runs).toHaveLength(0);
    expect(bundle.events).toHaveLength(0);
    expect(bundle.receipts).toHaveLength(0);
    expect(bundle.system_versions[0]?.published_at).toBeUndefined();
  });

  it("records a human consequential decision without treating it as proven", () => {
    const bundle = makeSimpleAIUseRecord({
      ...baseline,
      name: "Funding review",
      role: "recommend",
      consequential: true,
      peopleAffected: "Grant applicants",
    });
    expect(validateBundleReferences(bundle).valid).toBe(true);
    expect(bundle.systems[0]?.influence).toEqual(["advisory"]);
    expect(bundle.system_versions[0]?.decisions[0]?.authority).toBe("human");
    expect(bundle.system_versions[0]?.process.nodes.some((node) => node.type === "decision")).toBe(true);
    expect(bundle.claims.find((claim) => claim.id === "claim:control")?.statement).toBe("A person makes the final decision.");
    expect(bundle.evidence_links).toHaveLength(0);
  });

  it("does not export an inaccurate account when authority is unknown", () => {
    const unknown = { ...baseline, role: "recommend" as const, control: "unsure" as const, consequential: true };
    expect(needsDetailedAuthoring(unknown)).toBe(true);
    expect(() => makeSimpleAIUseRecord(unknown)).toThrow(/confirm the AI's powers/i);
    expect(needsDetailedAuthoring({ ...baseline, role: "decide" })).toBe(true);
    expect(needsDetailedAuthoring({ ...baseline, control: "ai" })).toBe(true);
    expect(needsDetailedAuthoring({ ...baseline, control: "rule" })).toBe(true);
  });

  it("does not fabricate automated action bounds from a short answer", () => {
    expect(needsDetailedAuthoring({ ...baseline, role: "act" })).toBe(true);
    expect(needsDetailedAuthoring({ ...baseline, role: "unsure" })).toBe(true);
    expect(() => makeSimpleAIUseRecord({ ...baseline, role: "act" })).toThrow(/action limits/i);
  });

  it("rejects unsafe source-link schemes in evidence", () => {
    const bundle = makeSimpleAIUseRecord(baseline);
    expect(() => appendManualEvidenceWithSource(bundle, evidenceTarget(bundle)!, {
      summary: "A purported source",
      sourceUri: "javascript:alert(1)",
      kind: "policy",
      relationship: "supports",
      disclosure: "internal",
    })).toThrow("Source link must start with https:// or http://.");
  });

  it("links organisation-provided evidence without mislabelling it as runtime observation", () => {
    const bundle = makeSimpleAIUseRecord({ ...baseline, role: "recommend", consequential: true });
    const result = appendManualEvidenceWithSource(bundle, evidenceTarget(bundle)!, {
      summary: "A reviewer checked the approval workflow.",
      sourceUri: "https://example.org/review",
      kind: "human_review",
      relationship: "qualifies",
      disclosure: "internal",
    });
    expect(result.bundle.evidence[0]?.source.kind).toBe("organisation");
    expect(result.bundle.evidence_links[0]?.relationship).toBe("qualifies");
    expect(result.bundle.events).toHaveLength(0);
    const publicModel = buildReaderModel({
      kind: "disclosure",
      projection: redactBundle(result.bundle, "public"),
    });
    expect(JSON.stringify(publicModel)).not.toContain("A reviewer checked the approval workflow.");
    expect(publicModel.activity).toBeUndefined();
  });
});
