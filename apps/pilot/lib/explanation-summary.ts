import type { ReaderEvidence, ReaderModel } from "./reader-model";

/**
 * A short, deliberately non-scoring account of the evidence visible to this
 * audience. Only accept a ReaderModel: public/affected models must be built
 * from a disclosure projection, not the organisation's internal record.
 */
export function summariseVisibleEvidence(model: ReaderModel) {
  const evidence = model.claims.flatMap((claim) => claim.evidence);
  const withoutEvidence = model.claims.filter((claim) => claim.evidence.length === 0);
  const caveats = evidence.filter((item) => item.tone === "caution");
  return {
    claims: model.claims.length,
    items: evidence.length,
    withoutEvidence: withoutEvidence.length,
    caveats: caveats.length,
    visibleEvidence: evidence,
    firstStatement: model.claims[0]?.statement,
    missingCopy: model.audience === "internal"
      ? "No evidence has been linked to this statement yet."
      : "No evidence for this statement is visible in this explanation.",
  };
}

export function evidenceRelationshipCopy(item: ReaderEvidence): string {
  return item.relationship === "Supports"
    ? "Supports the statement"
    : item.relationship === "Qualifies"
      ? "Adds a caveat"
      : item.relationship === "Challenges"
        ? "Challenges the statement"
        : "Does not settle the statement";
}

export function caseVisibilityCopy(model: ReaderModel): string | null {
  if (model.cases.length > 0) return null;
  if (model.audience === "public") return "Individual cases are not shown in this public explanation.";
  if (model.audience === "affected_party") return "No explanation of a particular case is visible here yet.";
  return model.use?.consequential
    ? "No individual case has been recorded in this working view yet."
    : null;
}
