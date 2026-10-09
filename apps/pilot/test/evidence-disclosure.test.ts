import { describe, expect, it } from "vitest";
import { createStarterBundle } from "../lib/starter";
import { availableEvidenceDisclosures } from "../lib/evidence-disclosure";

describe("manual evidence disclosure constraints", () => {
  it("defaults to internal when a claim or use is internal", () => {
    const bundle = createStarterBundle();
    const claim = bundle.claims[0]!;
    claim.disclosure = "internal";
    expect(availableEvidenceDisclosures(bundle, claim.id)).toEqual(["internal"]);
    claim.disclosure = "public";
    bundle.ai_uses[0]!.disclosure = "internal";
    expect(availableEvidenceDisclosures(bundle, claim.id)).toEqual(["internal"]);
  });

  it("offers external levels only when the parent claim and use allow them", () => {
    const bundle = createStarterBundle();
    const claim = bundle.claims[0]!;
    claim.disclosure = "public";
    bundle.ai_uses[0]!.disclosure = "public";
    expect(availableEvidenceDisclosures(bundle, claim.id)).toEqual([
      "public", "affected_party", "trusted", "internal",
    ]);
  });

  it("does not infer permission from a missing or disconnected claim", () => {
    const bundle = createStarterBundle();
    expect(availableEvidenceDisclosures(bundle, "claim:not-found")).toEqual(["internal"]);
    bundle.claims[0]!.applies_to = [{ kind: "system_version", ref: "system-version:other" }];
    expect(availableEvidenceDisclosures(bundle, bundle.claims[0]!.id)).toEqual(["internal"]);
  });
});
