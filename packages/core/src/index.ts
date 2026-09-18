import type {
  Claim,
  DisclosureLevel,
  Evidence,
  EvidenceLink,
  EvidenceRelationship,
} from "@crux/schemas";
import {
  compareTargetScope,
  type EvidenceScopeState,
  type ScopeContext,
} from "./scope.js";

export * from "./scope.js";
export * from "./discovery.js";
export * from "./connectors.js";
export * from "./gatewayDiscovery.js";

export type DerivedClaimStatus =
  | "declared"
  | "supported"
  | "qualified"
  | "contradicted"
  | "stale"
  | "unknown";

export type EvidenceFreshnessState = "fresh" | "stale";

export type ResolvedEvidence = {
  evidence_ref: string;
  relationship: EvidenceRelationship;
  effective_relationship: EvidenceRelationship;
  freshness: EvidenceFreshnessState;
  scope: EvidenceScopeState;
  applicable: boolean;
  observed_at: string;
  review_after?: string;
};

export type EvidenceSummary = {
  linked: number;
  resolved: number;
  current: number;
  stale: number;
  inapplicable: number;
  unresolved: number;
  latest_observed_at?: string;
};

export type ClaimEvidenceResolution = {
  claim_ref: string;
  status: DerivedClaimStatus;
  as_of: string;
  claim_review_overdue: boolean;
  evidence: ResolvedEvidence[];
  summary: EvidenceSummary;
  current_evidence_refs: string[];
  stale_evidence_refs: string[];
  inapplicable_evidence_refs: string[];
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

export const evidenceScopeForClaim = (
  claim: Claim,
  evidence: Evidence,
  context?: ScopeContext,
): EvidenceScopeState => compareTargetScope(claim.applies_to, evidence.targets, context);

const effectiveRelationship = (
  relationship: EvidenceRelationship,
  scope: EvidenceScopeState,
): EvidenceRelationship => {
  if (scope === "narrower" && relationship === "supports") return "qualifies";
  return relationship;
};

const isApplicableScope = (scope: EvidenceScopeState) =>
  !["version_mismatch", "unrelated"].includes(scope);

const uniqueRelationships = (items: ResolvedEvidence[]): EvidenceRelationship[] =>
  [...new Set(items.map((item) => item.effective_relationship))];

const deriveCurrentStatus = (
  relationships: EvidenceRelationship[],
): DerivedClaimStatus => {
  if (relationships.includes("contradicts")) return "contradicted";
  if (relationships.includes("qualifies")) return "qualified";
  if (relationships.includes("supports")) return "supported";
  return "unknown";
};

const newestFirst = (left: ResolvedEvidence, right: ResolvedEvidence) =>
  instant(right.observed_at) - instant(left.observed_at) ||
  left.evidence_ref.localeCompare(right.evidence_ref);

export const resolveClaimEvidence = ({
  claim,
  links,
  evidence,
  asOf,
  scopeContext,
}: {
  claim: Claim;
  links: EvidenceLink[];
  evidence: Evidence[];
  asOf: string;
  scopeContext?: ScopeContext;
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

    const scope = evidenceScopeForClaim(claim, item, scopeContext);
    resolved.push({
      evidence_ref: item.id,
      relationship: link.relationship,
      effective_relationship: effectiveRelationship(link.relationship, scope),
      freshness: isEvidenceFresh(item, asOf) ? "fresh" : "stale",
      scope,
      applicable: isApplicableScope(scope),
      observed_at: item.freshness.observed_at,
      ...(item.freshness.review_after
        ? { review_after: item.freshness.review_after }
        : {}),
    });
  }

  resolved.sort(newestFirst);

  const applicable = resolved.filter((item) => item.applicable);
  const current = applicable.filter((item) => item.freshness === "fresh");
  const stale = applicable.filter((item) => item.freshness === "stale");
  const inapplicable = resolved.filter((item) => !item.applicable);
  const currentRelationships = uniqueRelationships(current);
  const conclusiveCurrentRelationships = currentRelationships.filter(
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
  } else if (current.length > 0) {
    status = deriveCurrentStatus(currentRelationships);
    if (status === "unknown") {
      reasons.push("Current applicable evidence is inconclusive.");
    } else {
      reasons.push(
        `Current applicable evidence ${
          status === "contradicted"
            ? "contradicts"
            : status === "qualified"
              ? "qualifies"
              : "supports"
        } the claim.`,
      );
    }
  } else if (stale.length > 0) {
    status = "stale";
    reasons.push("Applicable evidence exists, but it is past its review date.");
  } else {
    status = "unknown";
    if (unresolvedEvidenceRefs.length > 0) {
      reasons.push("Linked evidence could not be resolved.");
    }
    if (versionScopeMismatches.length > 0) {
      reasons.push("Linked evidence targets a different explicit system version.");
    }
    if (inapplicable.some((item) => item.scope === "unrelated")) {
      reasons.push("Linked evidence is outside the claim's organisational or system scope.");
    }
  }

  if (
    current.some(
      (item) => item.scope === "narrower" && item.relationship === "supports",
    )
  ) {
    reasons.push(
      "Supporting evidence covers a narrower scope than the claim, so it qualifies rather than fully supports the claim.",
    );
  }

  const conflictingRelationships =
    conclusiveCurrentRelationships.length > 1 ? conclusiveCurrentRelationships : [];

  if (conflictingRelationships.length > 1) {
    reasons.push(
      `Conflicting current evidence is preserved: ${conflictingRelationships.join(", ")}.`,
    );
  }

  const latestObservedAt = resolved[0]?.observed_at;

  return {
    claim_ref: claim.id,
    status,
    as_of: asOf,
    claim_review_overdue: claimReviewOverdue,
    evidence: resolved,
    summary: {
      linked: claimLinks.length,
      resolved: resolved.length,
      current: current.length,
      stale: stale.length,
      inapplicable: inapplicable.length,
      unresolved: [...new Set(unresolvedEvidenceRefs)].length,
      ...(latestObservedAt ? { latest_observed_at: latestObservedAt } : {}),
    },
    current_evidence_refs: current.map((item) => item.evidence_ref),
    stale_evidence_refs: stale.map((item) => item.evidence_ref),
    inapplicable_evidence_refs: inapplicable.map((item) => item.evidence_ref),
    unresolved_evidence_refs: [...new Set(unresolvedEvidenceRefs)],
    conflicting_relationships: conflictingRelationships,
    version_scope_mismatches: [...new Set(versionScopeMismatches)],
    reasons,
  };
};
