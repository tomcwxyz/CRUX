import type {
  AIUse,
  AISystem,
  Organisation,
  SystemVersion,
  TargetRef,
} from "@crux/schemas";

export type ScopeContext = {
  organisations?: Pick<Organisation, "id">[];
  ai_uses?: Pick<AIUse, "id" | "organisation_ref">[];
  systems?: Pick<AISystem, "id" | "ai_use_refs">[];
  system_versions?: Pick<SystemVersion, "id" | "system_ref">[];
};

export type EvidenceScopeState =
  | "exact"
  | "broader"
  | "narrower"
  | "compatible"
  | "version_mismatch"
  | "unrelated";

const key = (target: TargetRef) => `${target.kind}:${target.ref}`;

const uniqueTargets = (targets: TargetRef[]): TargetRef[] => {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const targetKey = key(target);
    if (seen.has(targetKey)) return false;
    seen.add(targetKey);
    return true;
  });
};

const systemForVersion = (ref: string, context?: ScopeContext) =>
  context?.system_versions?.find((version) => version.id === ref)?.system_ref;

const aiUsesForSystem = (ref: string, context?: ScopeContext) =>
  context?.systems?.find((system) => system.id === ref)?.ai_use_refs ?? [];

const organisationForAIUse = (ref: string, context?: ScopeContext) =>
  context?.ai_uses?.find((use) => use.id === ref)?.organisation_ref;

export const targetLineage = (
  target: TargetRef,
  context?: ScopeContext,
): TargetRef[] => {
  const lineage: TargetRef[] = [target];

  if (target.kind === "system_version") {
    const systemRef = systemForVersion(target.ref, context);
    if (systemRef) {
      lineage.push({ kind: "system", ref: systemRef });
      for (const aiUseRef of aiUsesForSystem(systemRef, context)) {
        lineage.push({ kind: "ai_use", ref: aiUseRef });
        const organisationRef = organisationForAIUse(aiUseRef, context);
        if (organisationRef) lineage.push({ kind: "organisation", ref: organisationRef });
      }
    }
  } else if (target.kind === "system") {
    for (const aiUseRef of aiUsesForSystem(target.ref, context)) {
      lineage.push({ kind: "ai_use", ref: aiUseRef });
      const organisationRef = organisationForAIUse(aiUseRef, context);
      if (organisationRef) lineage.push({ kind: "organisation", ref: organisationRef });
    }
  } else if (target.kind === "ai_use") {
    const organisationRef = organisationForAIUse(target.ref, context);
    if (organisationRef) lineage.push({ kind: "organisation", ref: organisationRef });
  }

  return uniqueTargets(lineage);
};

const refsEqual = (left: TargetRef, right: TargetRef) =>
  left.kind === right.kind && left.ref === right.ref;

const isAncestor = (
  possibleAncestor: TargetRef,
  descendant: TargetRef,
  context?: ScopeContext,
): boolean =>
  targetLineage(descendant, context).some((target) => refsEqual(target, possibleAncestor));

const hasDifferentExplicitVersions = (claimTargets: TargetRef[], evidenceTargets: TargetRef[]) => {
  const claimVersions = claimTargets.filter((target) => target.kind === "system_version");
  const evidenceVersions = evidenceTargets.filter((target) => target.kind === "system_version");
  return (
    claimVersions.length > 0 &&
    evidenceVersions.length > 0 &&
    !claimVersions.some((claimTarget) =>
      evidenceVersions.some((evidenceTarget) => refsEqual(claimTarget, evidenceTarget)),
    )
  );
};

const organisationRoots = (targets: TargetRef[], context?: ScopeContext) =>
  new Set(
    targets.flatMap((target) =>
      targetLineage(target, context)
        .filter((lineageTarget) => lineageTarget.kind === "organisation")
        .map((lineageTarget) => lineageTarget.ref),
    ),
  );

export const compareTargetScope = (
  claimTargets: TargetRef[],
  evidenceTargets: TargetRef[],
  context?: ScopeContext,
): EvidenceScopeState => {
  if (
    claimTargets.some((claimTarget) =>
      evidenceTargets.some((evidenceTarget) => refsEqual(claimTarget, evidenceTarget)),
    )
  ) {
    return "exact";
  }

  if (hasDifferentExplicitVersions(claimTargets, evidenceTargets)) {
    return "version_mismatch";
  }

  if (
    claimTargets.some((claimTarget) =>
      evidenceTargets.some((evidenceTarget) => isAncestor(evidenceTarget, claimTarget, context)),
    )
  ) {
    return "broader";
  }

  if (
    claimTargets.some((claimTarget) =>
      evidenceTargets.some((evidenceTarget) => isAncestor(claimTarget, evidenceTarget, context)),
    )
  ) {
    return "narrower";
  }

  const comparableKinds = new Set(claimTargets.map((target) => target.kind));
  if (evidenceTargets.some((target) => comparableKinds.has(target.kind))) {
    return "unrelated";
  }

  const claimOrganisations = organisationRoots(claimTargets, context);
  const evidenceOrganisations = organisationRoots(evidenceTargets, context);
  if (
    claimOrganisations.size > 0 &&
    evidenceOrganisations.size > 0 &&
    ![...claimOrganisations].some((ref) => evidenceOrganisations.has(ref))
  ) {
    return "unrelated";
  }

  return "compatible";
};
