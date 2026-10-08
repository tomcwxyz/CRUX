import { describe, expect, it } from "vitest";
import { parsePortableBundle, redactBundle, type CruxPortableBundle } from "@crux/formats";
import writingAssistantJson from "../../../examples/writing-assistant/crux.json";
import fundingReviewJson from "../../../examples/funding-review/crux.json";
import boundedActionJson from "../../../examples/bounded-action/crux.json";
import observedDivergenceJson from "../../../examples/observed-divergence/crux.json";
import { buildReaderModel, type ReaderModel } from "../lib/reader-model";

const examples: Array<[string, CruxPortableBundle]> = [
  ["writing-assistant", parsePortableBundle(writingAssistantJson as unknown)],
  ["funding-review", parsePortableBundle(fundingReviewJson as unknown)],
  ["bounded-action", parsePortableBundle(boundedActionJson as unknown)],
  ["observed-divergence", parsePortableBundle(observedDivergenceJson as unknown)],
];

const funding = examples[1]![1];

// Every string a reader sees as a label, as opposed to free text authors wrote.
const labelFields = (model: ReaderModel) => [
  ...model.aiCan,
  model.canActAlone,
  ...model.decisions.map((item) => item.authority),
  ...model.actions.flatMap((item) => [item.startedBy, item.approval, item.reversibility]),
  ...model.claims.flatMap((claim) => claim.evidence.flatMap((item) => [item.kind, item.relationship])),
  ...model.cases.map((item) => item.finalAuthority),
  ...model.process?.steps.map((step) => step.roleLabel) ?? [],
];

describe("buildReaderModel", () => {
  describe.each(examples)("%s", (_name, bundle) => {
    it("takes the audience from the source, never from the caller", () => {
      expect(buildReaderModel({ kind: "working", bundle }).audience).toBe("internal");
      expect(buildReaderModel({ kind: "disclosure", projection: redactBundle(bundle, "public") }).audience).toBe("public");
      expect(buildReaderModel({ kind: "disclosure", projection: redactBundle(bundle, "affected_party") }).audience).toBe("affected_party");
    });

    it("keeps the internal purpose and runtime activity out of lower-disclosure models", () => {
      for (const level of ["public", "affected_party"] as const) {
        const model = buildReaderModel({ kind: "disclosure", projection: redactBundle(bundle, level) });
        const serialised = JSON.stringify(model);
        for (const use of bundle.ai_uses) {
          if (use.purpose && use.purpose !== use.public_summary) expect(serialised).not.toContain(use.purpose);
        }
        expect(model.activity).toBeUndefined();
      }
    });

    it("never shows raw schema values as labels", () => {
      const models = [
        buildReaderModel({ kind: "working", bundle }),
        buildReaderModel({ kind: "disclosure", projection: redactBundle(bundle, "public") }),
      ];
      for (const label of models.flatMap(labelFields)) {
        expect(label).not.toMatch(/_/);
        expect(["human", "rule", "ai", "hybrid", "external", "yes", "no", "partly"]).not.toContain(label);
      }
    });
  });

  it("keeps each SHOWS item attached to the SAYS claim it supports", () => {
    const model = buildReaderModel({ kind: "disclosure", projection: redactBundle(funding, "public") });
    expect(model.claims).toHaveLength(1);
    expect(model.claims[0]!.statement).toBe(funding.claims[0]!.statement);
    expect(model.claims[0]!.evidence.map((item) => item.id)).toEqual(
      funding.evidence_links.filter((link) => link.claim_ref === funding.claims[0]!.id).map((link) => link.evidence_ref),
    );
    expect(model.claims[0]!.evidence[0]!.relationship).toBe("Supports the statement");
  });

  it("marks where AI stops only when a person takes over", () => {
    const steps = buildReaderModel({ kind: "working", bundle: funding }).process!.steps;
    const boundaries = steps.filter((step) => step.aiStopsBefore);
    expect(boundaries.map((step) => step.role)).toEqual(["person"]);
    expect(steps[steps.indexOf(boundaries[0]!) - 1]!.role).toBe("ai");
  });

  it("shows the case to the affected person but not the public", () => {
    expect(buildReaderModel({ kind: "disclosure", projection: redactBundle(funding, "affected_party") }).cases).toHaveLength(1);
    expect(buildReaderModel({ kind: "disclosure", projection: redactBundle(funding, "public") }).cases).toHaveLength(0);
  });

  it("scopes cases to the exact system version", () => {
    const moved = structuredClone(funding);
    moved.receipts[0]!.system_version_ref = "system-version:somewhere-else";
    expect(buildReaderModel({ kind: "working", bundle: moved }).cases).toHaveLength(0);
  });

  it("reads only the current version when a system has several", () => {
    const twoVersions = structuredClone(funding);
    const current = twoVersions.system_versions[0]!;
    const older = structuredClone(current);
    older.id = "system-version:funding-assistant:2.2";
    older.version = "2.2";
    older.decisions = older.decisions.map((decision) => ({ ...decision, id: "decision:old", name: "Old eligibility decision" }));
    twoVersions.system_versions.push(older);
    twoVersions.claims.push({
      ...structuredClone(funding.claims[0]!),
      id: "claim:old-version",
      statement: "A statement about the older version only.",
      applies_to: [{ kind: "system_version", ref: older.id }],
    });
    twoVersions.receipts.push({ ...structuredClone(funding.receipts[0]!), id: "receipt:old", system_version_ref: older.id, outcome: "An outcome from the older version." });

    for (const model of [
      buildReaderModel({ kind: "working", bundle: twoVersions }),
      buildReaderModel({ kind: "disclosure", projection: redactBundle(twoVersions, "affected_party") }),
    ]) {
      const serialised = JSON.stringify(model);
      expect(model.system?.version).toBe("2.3");
      expect(serialised).not.toContain("A statement about the older version only.");
      expect(serialised).not.toContain("Old eligibility decision");
      expect(serialised).not.toContain("An outcome from the older version.");
    }
  });

  // Regression: the previous disclosure view fell back to ai_uses[0], so a
  // selected internal-only use showed a *different* use's public account.
  it("never substitutes another AI use when the selected one is not disclosed", () => {
    const twoUses = structuredClone(funding);
    twoUses.ai_uses.push({
      ...structuredClone(funding.ai_uses[0]!),
      id: "ai-use:internal-only",
      name: "Internal-only use",
      system_refs: [],
      disclosure: "internal",
    });
    const publicModel = buildReaderModel(
      { kind: "disclosure", projection: redactBundle(twoUses, "public") },
      "ai-use:internal-only",
    );
    expect(publicModel.availability).toBe("use_not_included");
    expect(publicModel.use).toBeUndefined();
    expect(JSON.stringify(publicModel)).not.toContain(funding.ai_uses[0]!.name);

    const internalModel = buildReaderModel({ kind: "working", bundle: twoUses }, "ai-use:internal-only");
    expect(internalModel.use?.name).toBe("Internal-only use");
  });

  it("still reads an invalid draft with dangling references", () => {
    const draft = structuredClone(funding);
    draft.systems[0]!.current_version_ref = "system-version:missing";
    draft.claims[0]!.applies_to = [{ kind: "system", ref: "system:missing" }];
    const model = buildReaderModel({ kind: "working", bundle: draft });
    expect(model.availability).toBe("ready");
    expect(model.process).toBeUndefined();
    expect(model.unknowns).toContain("This use can materially affect people, but no decision authority is recorded.");
  });

  it("does not report a model as unknown when it is marked not applicable", () => {
    const bundle = structuredClone(funding);
    const component = bundle.system_versions[0]!.components.find((item) => item.kind === "model");
    if (!component || component.kind !== "model") throw new Error("funding example should declare a model component");
    component.model_identifier = { status: "not_applicable" };
    expect(buildReaderModel({ kind: "working", bundle }).unknowns.some((item) => item.includes("AI model"))).toBe(false);
  });

  it("explains an empty record rather than failing", () => {
    const empty = structuredClone(funding);
    empty.ai_uses = [];
    expect(buildReaderModel({ kind: "working", bundle: empty }).availability).toBe("no_use");
  });
});
