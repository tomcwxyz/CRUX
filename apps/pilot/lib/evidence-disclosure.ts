import type { CruxPortableBundle } from "@crux/formats";
import type { DisclosureLevel } from "@crux/schemas";

const order: DisclosureLevel[] = ["public", "affected_party", "trusted", "internal"];

/** Show only audiences allowed by BOTH the claim and its AI use. */
export function availableEvidenceDisclosures(bundle: CruxPortableBundle, claimId: string): DisclosureLevel[] {
  const claim = bundle.claims.find((item) => item.id === claimId);
  if (!claim) return ["internal"];

  const affectedUses = bundle.ai_uses.filter((use) => {
    const systems = bundle.systems.filter((system) =>
      use.system_refs.includes(system.id) || system.ai_use_refs.includes(use.id),
    );
    const versions = bundle.system_versions.filter((version) =>
      systems.some((system) => system.id === version.system_ref),
    );
    const refs = new Set([use.id, ...systems.map((system) => system.id), ...versions.map((version) => version.id)]);
    return claim.applies_to.some((target) => refs.has(target.ref));
  });
  // Unknown ancestry cannot grant external disclosure permission.
  if (!affectedUses.length) return ["internal"];
  const minimum = Math.max(
    order.indexOf(claim.disclosure),
    ...affectedUses.map((use) => order.indexOf(use.disclosure)),
  );
  return order.slice(minimum < 0 ? 3 : minimum);
}
