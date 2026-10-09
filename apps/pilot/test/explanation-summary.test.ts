import { describe, expect, it } from "vitest";
import { parsePortableBundle, redactBundle } from "@crux/formats";
import fundingJson from "../../../examples/funding-review/crux.json";
import { buildReaderModel } from "../lib/reader-model";
import { caseVisibilityCopy, summariseVisibleEvidence } from "../lib/explanation-summary";

const funding = parsePortableBundle(fundingJson as unknown);

describe("audience-safe evidence summaries", () => {
  it("reports supported and unresolved statements without producing a trust score", () => {
    const model = buildReaderModel({ kind: "working", bundle: funding });
    const summary = summariseVisibleEvidence(model);
    expect(summary.claims).toBeGreaterThan(0);
    expect(summary.items).toBeGreaterThan(0);
    expect(summary).not.toHaveProperty("trustScore");
    expect(summary.visibleEvidence).toEqual(model.claims.flatMap((claim) => claim.evidence));
  });

  it("does not substitute hidden evidence into the public summary", () => {
    const internalBundle = structuredClone(funding);
    internalBundle.evidence = internalBundle.evidence.map((evidence) => ({
      ...evidence, disclosure: "internal" as const,
    }));
    const model = buildReaderModel({ kind: "disclosure", projection: redactBundle(internalBundle, "public") });
    const summary = summariseVisibleEvidence(model);
    expect(summary.items).toBe(0);
    expect(summary.missingCopy).toContain("visible");
    expect(JSON.stringify(summary)).not.toContain(internalBundle.evidence[0]?.summary ?? "NOT_IN_SOURCE");
  });

  it("does not imply an absent public case is absent from all records", () => {
    const publicModel = buildReaderModel({ kind: "disclosure", projection: redactBundle(funding, "public") });
    expect(caseVisibilityCopy(publicModel)).toContain("not shown");
  });
});
