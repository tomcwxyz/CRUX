import { describe, expect, it } from "vitest";
import type { Claim, Evidence, EvidenceLink } from "@crux/schemas";
import {
  evidenceScopeForClaim,
  filterEvidenceByDisclosure,
  resolveClaimEvidence,
} from "../src/index.js";

const created = "2026-09-01T09:00:00+00:00";
const now = "2026-09-15T10:30:00+00:00";

const claim: Claim = {
  schema_version: "0.1",
  id: "claim:no-autonomous-rejection",
  type: "control",
  statement: "AI cannot independently reject a funding application.",
  applies_to: [
    {
      kind: "system_version",
      ref: "system-version:funding-assistant:2.3",
    },
  ],
  status: "active",
  disclosure: "public",
  created_at: created,
};

const evidence = (
  id: string,
  reviewAfter?: string,
  version = "system-version:funding-assistant:2.3",
  disclosure: Evidence["disclosure"] = "public",
): Evidence => ({
  schema_version: "0.1",
  id,
  kind: "evaluation",
  summary: `Evidence ${id}`,
  source: {
    kind: "external_tool",
    producer: { name: "test-suite" },
  },
  targets: [{ kind: "system_version", ref: version }],
  freshness: {
    observed_at: created,
    ...(reviewAfter ? { review_after: reviewAfter } : {}),
  },
  limitations: [],
  external_refs: [],
  disclosure,
});

const link = (
  id: string,
  evidenceRef: string,
  relationship: EvidenceLink["relationship"],
): EvidenceLink => ({
  schema_version: "0.1",
  id,
  claim_ref: claim.id,
  evidence_ref: evidenceRef,
  relationship,
  created_at: created,
});

describe("claim evidence resolution", () => {
  it("keeps an unevidenced active claim as declared rather than treating it as true", () => {
    const result = resolveClaimEvidence({ claim, links: [], evidence: [], asOf: now });
    expect(result.status).toBe("declared");
  });

  it("derives supported from current supporting evidence", () => {
    const item = evidence("evidence:decision-authority:1");
    const result = resolveClaimEvidence({
      claim,
      links: [link("evidence-link:support:1", item.id, "supports")],
      evidence: [item],
      asOf: now,
    });
    expect(result.status).toBe("supported");
  });

  it("preserves contradictory evidence even when support also exists", () => {
    const support = evidence("evidence:support:1");
    const contradiction = evidence("evidence:contradiction:1");
    const result = resolveClaimEvidence({
      claim,
      links: [
        link("evidence-link:support:2", support.id, "supports"),
        link("evidence-link:contradiction:1", contradiction.id, "contradicts"),
      ],
      evidence: [support, contradiction],
      asOf: now,
    });
    expect(result.status).toBe("contradicted");
    expect(result.conflicting_relationships).toEqual(["supports", "contradicts"]);
  });

  it("marks evidence stale after its review window", () => {
    const stale = evidence(
      "evidence:old-eval:1",
      "2026-09-10T09:00:00+00:00",
    );
    const result = resolveClaimEvidence({
      claim,
      links: [link("evidence-link:old:1", stale.id, "supports")],
      evidence: [stale],
      asOf: now,
    });
    expect(result.status).toBe("stale");
  });

  it("does not apply evidence from a different explicitly versioned system", () => {
    const oldVersion = evidence(
      "evidence:old-version:1",
      undefined,
      "system-version:funding-assistant:2.2",
    );
    expect(evidenceScopeForClaim(claim, oldVersion)).toBe("version_mismatch");

    const result = resolveClaimEvidence({
      claim,
      links: [link("evidence-link:old-version:1", oldVersion.id, "supports")],
      evidence: [oldVersion],
      asOf: now,
    });
    expect(result.status).toBe("unknown");
    expect(result.version_scope_mismatches).toEqual([oldVersion.id]);
  });

  it("reports unresolved linked evidence rather than silently dropping it", () => {
    const result = resolveClaimEvidence({
      claim,
      links: [link("evidence-link:missing:1", "evidence:missing:1", "supports")],
      evidence: [],
      asOf: now,
    });
    expect(result.status).toBe("unknown");
    expect(result.unresolved_evidence_refs).toEqual(["evidence:missing:1"]);
  });

  it("filters disclosure without mutating source evidence", () => {
    const publicEvidence = evidence("evidence:public:1", undefined, undefined, "public");
    const trustedEvidence = evidence("evidence:trusted:1", undefined, undefined, "trusted");
    const internalEvidence = evidence("evidence:internal:1", undefined, undefined, "internal");

    expect(
      filterEvidenceByDisclosure(
        [publicEvidence, trustedEvidence, internalEvidence],
        "trusted",
      ).map((item) => item.id),
    ).toEqual(["evidence:public:1", "evidence:trusted:1"]);
  });

  it("marks an overdue claim stale even when its evidence is current", () => {
    const overdueClaim: Claim = {
      ...claim,
      review_after: "2026-09-10T09:00:00+00:00",
    };
    const item = evidence("evidence:current:1");
    const result = resolveClaimEvidence({
      claim: overdueClaim,
      links: [link("evidence-link:current:1", item.id, "supports")],
      evidence: [item],
      asOf: now,
    });
    expect(result.status).toBe("stale");
    expect(result.claim_review_overdue).toBe(true);
  });
});
