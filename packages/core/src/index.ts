import type {
  Claim,
  DisclosureLevel,
  Evidence,
  EvidenceLink,
  EvidenceRelationship,
  TargetRef,
} from "@crux/schemas";

export type DerivedClaimStatus =
  | "declared"
  | "supported"
  | "qualified"
  | "contradicted"
  | "stale"
  | "unknown";

export type EvidenceFreshnessState = "fresh" | "stale";
export type EvidenceScopeState = "compatible" | "version_mismatch";

export type ResolvedEvidence = {
  evidence_ref: string;
  relationship: EvidenceRelationship;
  freshness: EvidenceFreshnessState;
  scope: EvidenceScopeState;
  observed_at: string;
  review_after?: string;
};

export type ClaimEvidenceResolution = {
  claim_ref: string;
  status: DerivedClaimStatus;
  as_of: string;
  claim_review_overdue: boolean;
  evidence: ResolvedEvidence[];
  unresolved_evidence_refs: string[];
  conflicting_relationships: EvidenceRelationship[];
  version_scope_mismatches: string[];
  reasons: string[];
};

const disclosureRank: Record<DisclosureLevel, number> = {
  public: 0,
  affected_party: 1,
  trusted: 2,
  internal: 3,
};

const instant = (value: string) => Date.parse(value);

export const isEvidenceFresh = (evidence: Evidence, asOf: string): boolean => {
  const reviewAfter = evidence.freshness.review_after;
  return reviewAfter === undefined || instant(reviewAfter) > instant(asOf);
};

export const isClaimReviewOverdue = (claim: Claim, asOf: string): boolean =>
  claim.review_after !== undefined && instant(claim.review_after) <= instant(asOf);

export const filterEvidenceByDisclosure = (
  evidence: Evidence[],
  maximumLevel: DisclosureLevel,
): Evidence[] => {
  const maximumRank = disclosureRank[maximumLevel];
  return evidence.filter((item) => disclosureRank[item.disclosure] <= maximumRank);
};

const refsEqual = (left: TargetRef, right: TargetRef) =>
  left.kind === right.kind && left.ref === right.ref;

const systemVersionTargets = (targets: TargetRef[]) =>
  targets.filter((target) => target.kind === "system_version");

export const evidenceScopeForClaim = (
  claim: Claim,
  evidence: Evidence,
): EvidenceScopeState => {
  const claimVersions = systemVersionTargets(claim.applies_to);
  const evidenceVersions = systemVersionTargets(evidence.targets);

  if (claimVersions.length === 0 || evidenceVersions.length === 0) {
    return "compatible";
  }

  return claimVersions.some((claimTarget) =>
    evidenceVersions.some((evidenceTarget) => refsEqual(claimTarget, evidenceTarget)),
  )
    ? "compatible"
    : "version_mismatch";
};

const uniqueRelationships = (items: ResolvedEvidence[]): EvidenceRelationship[] =>
  [...new Set(items.map((item) => item.relationship))];

const deriveFreshStatus = (
  relationships: EvidenceRelationship[],
): DerivedClaimStatus => {
  if (relationships.includes("contradicts")) return "contradicted";
  if (relationships.includes("qualifies")) return "qualified";
  if (relationships.includes("supports")) return "supported";
  return "unknown";
};

export const resolveClaimEvidence = ({
  claim,
  links,
  evidence,
  asOf,
}: {
  claim: Claim;
  links: EvidenceLink[];
  evidence: Evidence[];
  asOf: string;
}): ClaimEvidenceResolution => {
  const claimLinks = links.filter((link) => link.claim_ref === claim.id);
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const unresolvedEvidenceRefs: string[] = [];
  const resolved: ResolvedEvidence[] = [];

  for (const link of claimLinks) {
    const item = evidenceById.get(link.evidence_ref);
    if (item === undefined) {
      unresolvedEvidenceRefs.push(link.evidence_ref);
      continue;
    }

    const scope = evidenceScopeForClaim(claim, item);
    resolved.push({
      evidence_ref: item.id,
      relationship: link.relationship,
      freshness: isEvidenceFresh(item, asOf) ? "fresh" : "stale",
      scope,
      observed_at: item.freshness.observed_at,
      ...(item.freshness.review_after
        ? { review_after: item.freshness.review_after }
        : {}),
    });
  }

  const compatible = resolved.filter((item) => item.scope === "compatible");
  const fresh = compatible.filter((item) => item.freshness === "fresh");
  const stale = compatible.filter((item) => item.freshness === "stale");
  const freshRelationships = uniqueRelationships(fresh);
  const conclusiveFreshRelationships = freshRelationships.filter(
    (relationship) => relationship !== "inconclusive",
  );
  const versionScopeMismatches = resolved
    .filter((item) => item.scope === "version_mismatch")
    .map((item) => item.evidence_ref);
  const claimReviewOverdue = isClaimReviewOverdue(claim, asOf);

  let status: DerivedClaimStatus;
  const reasons: string[] = [];

  if (claim.status !== "active") {
    status = "unknown";
    reasons.push(`Claim is ${claim.status}, so current evidence state is not asserted.`);
  } else if (claimReviewOverdue) {
    status = "stale";
    reasons.push("The claim itself is past its review date.");
  } else if (claimLinks.length === 0) {
    status = "declared";
    reasons.push("The claim is declared but has no linked evidence.");
  } else if (fresh.length > 0) {
    status = deriveFreshStatus(freshRelationships);
    if (status === "unknown") {
      reasons.push("Current linked evidence is inconclusive.");
    } else {
      reasons.push(`Current compatible evidence ${status === "contradicted" ? "contradicts" : status === "qualified" ? "qualifies" : "supports"} the claim.`);
    }
  } else if (stale.length > 0) {
    status = "stale";
    reasons.push("Linked compatible evidence exists, but it is past its review date.");
  } else {
    status = "unknown";
    if (unresolvedEvidenceRefs.length > 0) {
      reasons.push("Linked evidence could not be resolved.");
    }
    if (versionScopeMismatches.length > 0) {
      reasons.push("Linked evidence targets a different system version.");
    }
  }

  const conflictCandidates = conclusiveFreshRelationships;
  const conflictingRelationships =
    conflictCandidates.length > 1 ? conflictCandidates : [];

  if (conflictingRelationships.length > 1) {
    reasons.push(
      `Conflicting current evidence is preserved: ${conflictingRelationships.join(", ")}.`,
    );
  }

  return {
    claim_ref: claim.id,
    status,
    as_of: asOf,
    claim_review_overdue: claimReviewOverdue,
    evidence: resolved,
    unresolved_evidence_refs: [...new Set(unresolvedEvidenceRefs)],
    conflicting_relationships: conflictingRelationships,
    version_scope_mismatches: [...new Set(versionScopeMismatches)],
    reasons,
  };
};
