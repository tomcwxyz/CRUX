import {
  evidenceEnvelopeSchema,
  type Evidence,
  type EvidenceEnvelope,
  type TargetRef,
} from "@crux/schemas";
import {
  parsePortableBundle,
  validateBundleReferences,
  type CruxPortableBundle,
} from "./bundle.js";

export type EvidenceImportStatus = "imported" | "already_present";

export type EvidenceImportResult = {
  status: EvidenceImportStatus;
  bundle: CruxPortableBundle;
  evidence: Evidence;
};

const sameEvidence = (left: Evidence, right: Evidence) =>
  JSON.stringify(left) === JSON.stringify(right);

const laterTimestamp = (left: string, right: string) =>
  Date.parse(right) > Date.parse(left) ? right : left;

const isUrl = (value: string) => /^https?:\/\//i.test(value);

const localTargetIds = (bundle: CruxPortableBundle) => ({
  organisation: new Set(bundle.organisations.map((item) => item.id)),
  ai_use: new Set(bundle.ai_uses.map((item) => item.id)),
  system: new Set(bundle.systems.map((item) => item.id)),
  system_version: new Set(bundle.system_versions.map((item) => item.id)),
  claim: new Set(bundle.claims.map((item) => item.id)),
  process: new Set(bundle.system_versions.map((item) => item.process.id)),
  decision: new Set(bundle.system_versions.flatMap((item) => item.decisions.map((decision) => decision.id))),
  action: new Set(bundle.system_versions.flatMap((item) => item.actions.map((action) => action.id))),
  risk: new Set(bundle.system_versions.flatMap((item) => item.risks.map((risk) => risk.id))),
  safeguard: new Set(bundle.system_versions.flatMap((item) => item.safeguards.map((safeguard) => safeguard.id))),
});

const validateEnvelopeTargets = (
  bundle: CruxPortableBundle,
  envelope: EvidenceEnvelope,
) => {
  const ids = localTargetIds(bundle);

  for (const target of envelope.evidence.targets) {
    if (isUrl(target.ref)) continue;
    if (target.kind === "practice" || target.kind === "repository" || target.kind === "other") {
      continue;
    }

    const exists = ids[target.kind].has(target.ref);
    if (!exists) {
      throw new Error(
        `Evidence ${envelope.evidence.id} targets missing ${target.kind} ${target.ref}. ` +
          "Use a canonical URL when the target is external to this CRUX bundle.",
      );
    }
  }
};

/**
 * Import one portable EvidenceEnvelope into a canonical CRUX bundle.
 *
 * Import is deliberately evidence-only: it never creates an EvidenceLink or
 * changes a claim state. An external test result can therefore enter CRUX
 * automatically without silently being treated as support for an organisational
 * claim. Claim relationships remain an explicit reviewed act.
 *
 * Replaying the same envelope is idempotent. Reusing an evidence ID for
 * materially different evidence is rejected as a conflict.
 */
export const importEvidenceEnvelope = (
  bundleInput: unknown,
  envelopeInput: unknown,
): EvidenceImportResult => {
  const bundle = parsePortableBundle(bundleInput);
  const existingValidation = validateBundleReferences(bundle);
  if (!existingValidation.valid) {
    const first = existingValidation.issues[0];
    throw new Error(
      `Cannot import evidence into an invalid CRUX bundle${first ? `: ${first.path}: ${first.message}` : "."}`,
    );
  }

  const envelope = evidenceEnvelopeSchema.parse(envelopeInput);
  validateEnvelopeTargets(bundle, envelope);

  const existing = bundle.evidence.find((item) => item.id === envelope.evidence.id);
  if (existing) {
    if (sameEvidence(existing, envelope.evidence)) {
      return { status: "already_present", bundle, evidence: existing };
    }
    throw new Error(
      `Evidence ID conflict for ${envelope.evidence.id}: the bundle already contains different evidence with this ID.`,
    );
  }

  const imported = parsePortableBundle({
    ...bundle,
    generated_at: laterTimestamp(bundle.generated_at, envelope.generated_at),
    evidence: [...bundle.evidence, envelope.evidence],
  });

  const validation = validateBundleReferences(imported);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Imported evidence would make the CRUX bundle invalid${first ? `: ${first.path}: ${first.message}` : "."}`,
    );
  }

  return {
    status: "imported",
    bundle: imported,
    evidence: envelope.evidence,
  };
};

export const parseEvidenceEnvelope = (input: unknown): EvidenceEnvelope =>
  evidenceEnvelopeSchema.parse(input);
