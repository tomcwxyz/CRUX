import type { DiscoveryDeclaration } from "@crux/core";
import { parsePortableBundle, type CruxPortableBundle } from "./bundle.js";

export const portableBundleFromDiscoveryDeclaration = (
  declaration: DiscoveryDeclaration,
  generatedAt = declaration.system_version.effective_from,
): CruxPortableBundle =>
  parsePortableBundle({
    format: "crux-bundle/0.1",
    generated_at: generatedAt,
    organisations: [declaration.organisation],
    ai_uses: [declaration.ai_use],
    systems: [declaration.system],
    system_versions: [declaration.system_version],
    claims: [],
    evidence: [],
    evidence_links: [],
    evaluation_definitions: [],
    evaluation_runs: [],
    evaluation_cases: [],
    runs: [],
    events: [],
    traces: [],
    receipts: [],
    observations: [],
  });
