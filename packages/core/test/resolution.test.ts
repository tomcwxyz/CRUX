import { describe, expect, it } from "vitest";
import type { Claim, Evidence, EvidenceLink, TargetRef } from "@crux/schemas";
import {
  evidenceScopeForClaim,
  filterEvidenceByDisclosure,
  resolveClaimEvidence,
  type ScopeContext,
} from "../src/index.js";

const created = "2026-09-01T09:00:00+00:00";
const now = "2026-09-15T10:30:00+00:00";

const scopeContext: ScopeContext = {
  organisations: [{ id: "organisation:example" }, { id: "organisation:other" }],
  ai_uses: [
    { id: "ai-use:funding-review", organisation_ref: "organisation:example" },
    { id: "ai-use:other", organisation_ref: "organisation:other" },
  ],
  systems: [
    { id: "system:funding-assistant", ai_use_refs: ["ai-use:funding-review"] },
    { id: "system:other", ai_use_refs: ["ai-use:other"] },
  ],
  system_versions: [
    {
      id: "system-version:funding-assistant:2.3",
      system_ref: "system:funding-assistant",
    },
    {
      id: "system-version:funding-assistant:2.2",
      system_ref: "system:funding-assistant",
    },
    { id: "system-version:other:1", system_ref: "system:other" },
  ],
};

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

const evidence = ({
  id,
  target = {
    kind: "system_version",
    ref: "system-version:funding-assistant:2.3",
  },
  observedAt = created,
  reviewAfter,
  disclosure = "public",
}: {
  id: string;
  target?: TargetRef;
  observedAt?: string;
  reviewAfter?: string;
  disclosure?: Evidence["disclosure"];
}): Evidence => ({
  schema_version: "0.1",
  id,
  kind: "evaluation",
  summary: `Evidence ${id}`,
  source: {
    kind: "external_tool",
    producer: { name: "test-suite" },
  },
  targets: [target],
  freshness: {
    observed_at: observedAt,
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
  claimRef = claim.id,
): EvidenceLink => ({
  schema_version: "0.1",
  id,
  claim_ref: claimRef,
  evidence_ref: evidenceRef,
  relationship,
  created_at: created,
});

describe("claim evidence resolution", () => {
  it("keeps an unevidenced active claim as declared rather than treating it as true", () => {
    const result = resolveClaimEvidence({ claim, links: [], evidence: [], asOf: now });
    expect(result.status).toBe("declared");
    expect(result.summary.linked).toBe(0);
  });

  it("derives supported from current exact supporting evidence", () => {
    const item = evidence({ id: "evidence:decision-authority:1" });
    const result = resolveClaimEvidence({
      claim,
      links: [link("evidence-link:support:1", item.id, "supports")],
      evidence: [item],
      asOf: now,
      scopeContext,
    });
    expect(result.status).toBe("supported");
    expect(result.evidence[0]?.scope).toBe("exact");
  });

  it("lets broader system evidence support a version-scoped claim within the same lineage", () => {
    const item = evidence({
      id: "evidence:system-control:1",
      target: { kind: "system", ref: "system:funding-assistant" },
    });
    expect(evidenceScopeForClaim(claim, item, scopeContext)).toBe("broader");

    const result = resolveClaimEvidence({
      claim,
      links: [link("evidence-link:broader:1", item.id, "supports")],
      evidence: [item],
      asOf: now,
      scopeContext,
    });
    expect(result.status).toBe("supported");
  });

  it("qualifies narrower supporting evidence instead of letting it prove a broad claim", () => {
    const broadClaim: Claim = {
      ...claim,
      id: "claim:system-wide-control",
      applies_to: [{ kind: "system", ref: "system:funding-assistant" }],
    };
    const item = evidence({ id: "evidence:one-version:1" });

    expect(evidenceScopeForClaim(broadClaim, item, scopeContext)).toBe("narrower");
    const result = resolveClaimEvidence({
      claim: broadClaim,
      links: [link("evidence-link:narrower:1", item.id, "supports", broadClaim.id)],
      evidence: [item],
      asOf: now,
      scopeContext,
    });

    expect(result.status).toBe("qualified");
    expect(result.evidence[0]?.effective_relationship).toBe("qualifies");
    expect(result.reasons.join(" ")).toContain("narrower scope");
  });

  it("preserves contradictory current evidence even when newer support exists", () => {
    const contradiction = evidence({
      id: "evidence:contradiction:1",
      observedAt: "2026-09-02T09:00:00+00:00",
    });
    const support = evidence({
      id: "evidence:support:1",
      observedAt: "2026-09-14T09:00:00+00:00",
    });
    const result = resolveClaimEvidence({
      claim,
      links: [
        link("evidence-link:contradiction:1", contradiction.id, "contradicts"),
        link("evidence-link:support:2", support.id, "supports"),
      ],
      evidence: [contradiction, support],
      asOf: now,
      scopeContext,
    });

    expect(result.status).toBe("contradicted");
    expect(result.evidence.map((item) => item.evidence_ref)).toEqual([
      support.id,
      contradiction.id,
    ]);
    expect(result.conflicting_relationships).toEqual(["supports", "contradicts"]);
    expect(result.summary.latest_observed_at).toBe("2026-09-14T09:00:00+00:00");
  });

  it("allows stale contradictory evidence to remain inspectable without controlling current status", () => {
    const contradiction = evidence({
      id: "evidence:old-contradiction:1",
      observedAt: "2026-08-01T09:00:00+00:00",
      reviewAfter: "2026-09-10T09:00:00+00:00",
    });
    const support = evidence({
      id: "evidence:current-support:1",
      observedAt: "2026-09-14T09:00:00+00:00",
    });
    const result = resolveClaimEvidence({
      claim,
      links: [
        link("evidence-link:old-contradiction:1", contradiction.id, "contradicts"),
        link("evidence-link:current-support:1", support.id, "supports"),
      ],
      evidence: [contradiction, support],
      asOf: now,
      scopeContext,
    });

    expect(result.status).toBe("supported");
    expect(result.stale_evidence_refs).toEqual([contradiction.id]);
    expect(result.current_evidence_refs).toEqual([support.id]);
  });

  it("does not apply evidence from a different explicitly versioned system", () => {
    const oldVersion = evidence({
      id: "evidence:old-version:1",
      target: {
        kind: "system_version",
        ref: "system-version:funding-assistant:2.2",
      },
    });
    expect(evidenceScopeForClaim(claim, oldVersion, scopeContext)).toBe("version_mismatch");

    const result = resolveClaimEvidence({
      claim,
      links: [link("evidence-link:old-version:1", oldVersion.id, "supports")],
      evidence: [oldVersion],
      asOf: now,
      scopeContext,
    });
    expect(result.status).toBe("unknown");
    expect(result.version_scope_mismatches).toEqual([oldVersion.id]);
  });

  it("marks evidence from another organisation as unrelated", () => {
    const other = evidence({
      id: "evidence:other-system:1",
      target: { kind: "system", ref: "system:other" },
    });
    expect(evidenceScopeForClaim(claim, other, scopeContext)).toBe("unrelated");

    const result = resolveClaimEvidence({
      claim,
      links: [link("evidence-link:other:1", other.id, "supports")],
      evidence: [other],
      asOf: now,
      scopeContext,
    });
    expect(result.status).toBe("unknown");
    expect(result.inapplicable_evidence_refs).toEqual([other.id]);
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
    expect(result.summary.unresolved).toBe(1);
  });

  it("filters disclosure without mutating source evidence", () => {
    const publicEvidence = evidence({ id: "evidence:public:1", disclosure: "public" });
    const trustedEvidence = evidence({ id: "evidence:trusted:1", disclosure: "trusted" });
    const internalEvidence = evidence({ id: "evidence:internal:1", disclosure: "internal" });

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
    const item = evidence({ id: "evidence:current:1" });
    const result = resolveClaimEvidence({
      claim: overdueClaim,
      links: [link("evidence-link:current:1", item.id, "supports")],
      evidence: [item],
      asOf: now,
      scopeContext,
    });
    expect(result.status).toBe("stale");
    expect(result.claim_review_overdue).toBe(true);
  });
});
