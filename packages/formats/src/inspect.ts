import { resolveClaimEvidence, type ScopeContext } from "@crux/core";
import type { CruxPortableBundle } from "./bundle.js";
import { validateBundleReferences } from "./bundle.js";

export type BundleInspection = {
  summary: string;
  claim_statuses: Array<{
    id: string;
    statement: string;
    status: string;
    reasons: string[];
  }>;
};

export const inspectBundle = (
  bundle: CruxPortableBundle,
  asOf = new Date().toISOString(),
): BundleInspection => {
  const validation = validateBundleReferences(bundle);
  const scopeContext: ScopeContext = {
    organisations: bundle.organisations.map(({ id }) => ({ id })),
    ai_uses: bundle.ai_uses.map(({ id, organisation_ref }) => ({ id, organisation_ref })),
    systems: bundle.systems.map(({ id, ai_use_refs }) => ({ id, ai_use_refs })),
    system_versions: bundle.system_versions.map(({ id, system_ref }) => ({ id, system_ref })),
  };

  const claimStatuses = bundle.claims.map((claim) => {
    const resolution = resolveClaimEvidence({
      claim,
      links: bundle.evidence_links,
      evidence: bundle.evidence,
      asOf,
      scopeContext,
    });
    return {
      id: claim.id,
      statement: claim.statement,
      status: resolution.status,
      reasons: resolution.reasons,
    };
  });

  const consequentialUses = bundle.ai_uses.filter((use) => use.consequential).length;
  const lines = [
    "CRUX bundle",
    `Generated: ${bundle.generated_at}`,
    `Organisations: ${bundle.organisations.length}`,
    `AI uses: ${bundle.ai_uses.length} (${consequentialUses} consequential)`,
    `Systems: ${bundle.systems.length}`,
    `System versions: ${bundle.system_versions.length}`,
    `Claims: ${bundle.claims.length}`,
    `Evidence records: ${bundle.evidence.length}`,
    `Evaluation definitions/runs: ${bundle.evaluation_definitions.length}/${bundle.evaluation_runs.length}`,
    `Runs/traces/receipts: ${bundle.runs.length}/${bundle.traces.length}/${bundle.receipts.length}`,
    `Reference validation: ${validation.valid ? "valid" : `${validation.issues.length} issue(s)`}`,
  ];

  if (claimStatuses.length > 0) {
    lines.push("", "Claims:");
    for (const claim of claimStatuses) {
      lines.push(`- [${claim.status}] ${claim.statement} (${claim.id})`);
      for (const reason of claim.reasons) lines.push(`  ${reason}`);
    }
  }

  if (!validation.valid) {
    lines.push("", "Reference issues:");
    for (const issue of validation.issues) {
      lines.push(`- ${issue.path}: ${issue.message}`);
    }
  }

  return { summary: lines.join("\n"), claim_statuses: claimStatuses };
};
