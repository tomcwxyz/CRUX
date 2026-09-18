import { projectTraceForDisclosure } from "@crux/core/projection";
import type {
  DisclosureLevel,
  EvidenceLink,
  SystemVersion,
  TargetRef,
} from "@crux/schemas";
import type { CruxPortableBundle } from "./bundle.js";

const disclosureRank: Record<DisclosureLevel, number> = {
  public: 0,
  affected_party: 1,
  trusted: 2,
  internal: 3,
};

const visibleAt = (level: DisclosureLevel, maximum: DisclosureLevel) =>
  disclosureRank[level] <= disclosureRank[maximum];

const isUrlRef = (ref: string) => /^https?:\/\//.test(ref);
const cruxOwnedTargetKinds = new Set<TargetRef["kind"]>([
  "organisation",
  "ai_use",
  "system",
  "system_version",
  "process",
  "decision",
  "action",
  "risk",
  "safeguard",
  "claim",
]);

type OrganisationRecord = CruxPortableBundle["organisations"][number];
type AIUseRecord = CruxPortableBundle["ai_uses"][number];
type SystemRecord = CruxPortableBundle["systems"][number];
type ClaimRecord = CruxPortableBundle["claims"][number];
type EvidenceRecord = CruxPortableBundle["evidence"][number];

type ProjectedOrganisation = Pick<
  OrganisationRecord,
  "id" | "name" | "website" | "jurisdiction" | "organisation_type" | "description" | "transparency_contact"
> & {
  legal_name?: string;
};

export type ProjectedAIUse = Pick<
  AIUseRecord,
  "id" | "organisation_ref" | "name" | "status" | "people_affected" | "consequential" | "system_refs"
> & {
  public_summary?: string;
  purpose?: string;
  owner_role?: string;
};

export type ProjectedSystem = Pick<
  SystemRecord,
  "id" | "name" | "description" | "ai_use_refs" | "influence" | "agency" | "status" | "current_version_ref"
> & {
  owner_role?: string;
};

export type ProjectedClaim = Pick<
  ClaimRecord,
  "id" | "type" | "statement" | "applies_to" | "status" | "review_after"
> & {
  owner_role?: string;
  rationale?: string;
};

export type ProjectedEvidence = Pick<
  EvidenceRecord,
  "id" | "kind" | "title" | "summary" | "source" | "targets" | "freshness" | "result" | "limitations" | "external_refs"
>;

export type ProjectedSystemVersion = {
  id: string;
  system_ref: string;
  version: string;
  effective_from: string;
  effective_to?: string;
  supersedes?: string;
  change_summary?: string;
  process: {
    id: string;
    name: string;
    description?: string;
    nodes: Array<{
      id: string;
      type: SystemVersion["process"]["nodes"][number]["type"];
      name: string;
      description?: string;
    }>;
    edges: Array<{ from: string; to: string }>;
  };
  components: SystemVersion["components"];
  data_sources: SystemVersion["data_sources"];
  human_roles: SystemVersion["human_roles"];
  decisions: SystemVersion["decisions"];
  actions: SystemVersion["actions"];
  risks: SystemVersion["risks"];
  safeguards: SystemVersion["safeguards"];
  published_at?: string;
};

export type CruxDisclosureBundle = {
  format: "crux-disclosure/0.1";
  source_format: "crux-bundle/0.1";
  generated_at: string;
  disclosure_level: DisclosureLevel;
  organisations: ProjectedOrganisation[];
  ai_uses: ProjectedAIUse[];
  systems: ProjectedSystem[];
  system_versions: ProjectedSystemVersion[];
  claims: ProjectedClaim[];
  evidence: ProjectedEvidence[];
  claim_evidence_links: Array<Pick<EvidenceLink, "claim_ref" | "evidence_ref" | "relationship">>;
  evaluation_definitions: CruxPortableBundle["evaluation_definitions"];
  evaluation_runs: CruxPortableBundle["evaluation_runs"];
  evaluation_cases: CruxPortableBundle["evaluation_cases"];
  observations: CruxPortableBundle["observations"];
  trace_views: ReturnType<typeof projectTraceForDisclosure>[];
};

const projectOrganisation = (
  item: OrganisationRecord,
  maximumLevel: DisclosureLevel,
): ProjectedOrganisation => ({
  id: item.id,
  name: item.name,
  ...(item.website ? { website: item.website } : {}),
  ...(item.jurisdiction ? { jurisdiction: item.jurisdiction } : {}),
  ...(item.organisation_type ? { organisation_type: item.organisation_type } : {}),
  ...(item.description ? { description: item.description } : {}),
  ...(item.transparency_contact ? { transparency_contact: item.transparency_contact } : {}),
  ...(maximumLevel === "internal" && item.legal_name ? { legal_name: item.legal_name } : {}),
});

const projectAIUse = (
  item: AIUseRecord,
  maximumLevel: DisclosureLevel,
): ProjectedAIUse => ({
  id: item.id,
  organisation_ref: item.organisation_ref,
  name: item.name,
  status: item.status,
  people_affected: item.people_affected,
  consequential: item.consequential,
  system_refs: [...item.system_refs],
  ...(item.public_summary ? { public_summary: item.public_summary } : {}),
  ...(maximumLevel === "internal" ? { purpose: item.purpose } : {}),
  ...(maximumLevel === "internal" && item.owner_role ? { owner_role: item.owner_role } : {}),
});

const projectSystem = (
  item: SystemRecord,
  maximumLevel: DisclosureLevel,
): ProjectedSystem => ({
  id: item.id,
  name: item.name,
  description: item.description,
  ai_use_refs: [...item.ai_use_refs],
  influence: [...item.influence],
  agency: item.agency,
  status: item.status,
  ...(item.current_version_ref ? { current_version_ref: item.current_version_ref } : {}),
  ...(maximumLevel === "internal" && item.owner_role ? { owner_role: item.owner_role } : {}),
});

const projectClaim = (
  item: ClaimRecord,
  visibleRefs: Set<string>,
  maximumLevel: DisclosureLevel,
): ProjectedClaim | undefined => {
  const appliesTo = filterTargetRefs(item.applies_to, visibleRefs);
  if (appliesTo.length === 0) return undefined;

  return {
    id: item.id,
    type: item.type,
    statement: item.statement,
    applies_to: appliesTo,
    status: item.status,
    ...(item.review_after ? { review_after: item.review_after } : {}),
    ...(maximumLevel === "internal" && item.owner_role ? { owner_role: item.owner_role } : {}),
    ...(maximumLevel === "internal" && item.rationale ? { rationale: item.rationale } : {}),
  };
};

const projectEvidence = (
  item: EvidenceRecord,
  visibleRefs: Set<string>,
): ProjectedEvidence | undefined => {
  const targets = filterTargetRefs(item.targets, visibleRefs);
  if (targets.length === 0) return undefined;

  return {
    id: item.id,
    kind: item.kind,
    ...(item.title ? { title: item.title } : {}),
    summary: item.summary,
    source: item.source,
    targets,
    freshness: item.freshness,
    ...(item.result ? { result: item.result } : {}),
    limitations: item.limitations,
    external_refs: item.external_refs,
  };
};

const projectVersion = (
  version: SystemVersion,
  maximumLevel: DisclosureLevel,
): ProjectedSystemVersion | undefined => {
  if (!visibleAt(version.disclosure, maximumLevel)) return undefined;

  const components = version.components.filter((item) => visibleAt(item.disclosure, maximumLevel));
  const dataSources = version.data_sources.filter((item) => visibleAt(item.disclosure, maximumLevel));
  const humanRoles = version.human_roles.filter((item) => visibleAt(item.disclosure, maximumLevel));
  const decisions = version.decisions.filter((item) => visibleAt(item.disclosure, maximumLevel));
  const actions = version.actions.filter((item) => visibleAt(item.disclosure, maximumLevel));
  const risks = version.risks.filter((item) => visibleAt(item.disclosure, maximumLevel));
  const safeguards = version.safeguards.filter((item) => visibleAt(item.disclosure, maximumLevel));

  const nodes = version.process.nodes
    .filter((node) => visibleAt(node.disclosure, maximumLevel))
    .map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name,
      ...(node.description ? { description: node.description } : {}),
    }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = version.process.edges
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .map((edge) => ({ from: edge.from, to: edge.to }));

  if (nodes.length === 0) return undefined;

  return {
    id: version.id,
    system_ref: version.system_ref,
    version: version.version,
    effective_from: version.effective_from,
    ...(version.effective_to ? { effective_to: version.effective_to } : {}),
    ...(version.supersedes ? { supersedes: version.supersedes } : {}),
    ...(version.change_summary ? { change_summary: version.change_summary } : {}),
    process: {
      id: version.process.id,
      name: version.process.name,
      ...(version.process.description ? { description: version.process.description } : {}),
      nodes,
      edges,
    },
    components,
    data_sources: dataSources,
    human_roles: humanRoles,
    decisions,
    actions,
    risks,
    safeguards,
    ...(version.published_at ? { published_at: version.published_at } : {}),
  };
};

const filterTargetRefs = (targets: TargetRef[], visibleRefs: Set<string>) =>
  targets.filter(
    (target) =>
      isUrlRef(target.ref) ||
      !cruxOwnedTargetKinds.has(target.kind) ||
      visibleRefs.has(target.ref),
  );

export const redactBundle = (
  bundle: CruxPortableBundle,
  maximumLevel: DisclosureLevel,
): CruxDisclosureBundle => {
  const organisations = bundle.organisations
    .filter((item) => visibleAt(item.disclosure, maximumLevel))
    .map((item) => projectOrganisation(item, maximumLevel));
  const organisationIds = new Set(organisations.map((item) => item.id));

  const aiUses = bundle.ai_uses
    .filter(
      (item) =>
        visibleAt(item.disclosure, maximumLevel) && organisationIds.has(item.organisation_ref),
    )
    .map((item) => projectAIUse(item, maximumLevel));
  const aiUseIds = new Set(aiUses.map((item) => item.id));

  const systems = bundle.systems
    .filter(
      (item) =>
        visibleAt(item.disclosure, maximumLevel) &&
        item.ai_use_refs.some((ref) => aiUseIds.has(ref)),
    )
    .map((item) => projectSystem(item, maximumLevel));
  const systemIds = new Set(systems.map((item) => item.id));

  const systemVersions = bundle.system_versions
    .filter((item) => systemIds.has(item.system_ref))
    .map((item) => projectVersion(item, maximumLevel))
    .filter((item): item is ProjectedSystemVersion => item !== undefined);
  const versionIds = new Set(systemVersions.map((item) => item.id));

  for (const system of systems) {
    if (system.current_version_ref && !versionIds.has(system.current_version_ref)) {
      delete system.current_version_ref;
    }
  }

  for (const use of aiUses) {
    use.system_refs = use.system_refs.filter((ref) => systemIds.has(ref));
  }

  const visibleRefs = new Set<string>([
    ...organisationIds,
    ...aiUseIds,
    ...systemIds,
    ...versionIds,
  ]);
  for (const version of systemVersions) {
    visibleRefs.add(version.process.id);
    for (const node of version.process.nodes) visibleRefs.add(node.id);
    for (const collection of [
      version.components,
      version.data_sources,
      version.human_roles,
      version.decisions,
      version.actions,
      version.risks,
      version.safeguards,
    ]) {
      for (const item of collection) visibleRefs.add(item.id);
    }
  }

  const candidateClaims = bundle.claims.filter((item) => visibleAt(item.disclosure, maximumLevel));
  for (const claim of candidateClaims) visibleRefs.add(claim.id);

  const claims = candidateClaims
    .map((item) => projectClaim(item, visibleRefs, maximumLevel))
    .filter((item): item is ProjectedClaim => item !== undefined);
  const claimIds = new Set(claims.map((item) => item.id));

  const evidence = bundle.evidence
    .filter((item) => visibleAt(item.disclosure, maximumLevel))
    .map((item) => projectEvidence(item, visibleRefs))
    .filter((item): item is ProjectedEvidence => item !== undefined);
  const evidenceIds = new Set(evidence.map((item) => item.id));

  const claimEvidenceLinks = bundle.evidence_links
    .filter((link) => claimIds.has(link.claim_ref) && evidenceIds.has(link.evidence_ref))
    .map(({ claim_ref, evidence_ref, relationship }) => ({
      claim_ref,
      evidence_ref,
      relationship,
    }));

  const evaluationCases = bundle.evaluation_cases.filter(
    (item) =>
      visibleAt(item.disclosure, maximumLevel) && versionIds.has(item.system_version_ref),
  );
  const observations = bundle.observations.filter(
    (item) =>
      visibleAt(item.disclosure, maximumLevel) && versionIds.has(item.system_version_ref),
  );

  const traceViews = bundle.traces
    .filter((trace) => versionIds.has(trace.system_version_ref))
    .map((trace) => {
      const receipt = bundle.receipts.find((item) => item.trace_ref === trace.id);
      return projectTraceForDisclosure({
        trace,
        events: bundle.events.filter((event) => event.run_ref === trace.run_ref),
        ...(receipt ? { receipt } : {}),
        maximumLevel,
      });
    })
    .filter((view) => view.trace_visible || view.receipt !== undefined);

  const internal = maximumLevel === "internal";

  return {
    format: "crux-disclosure/0.1",
    source_format: bundle.format,
    generated_at: new Date().toISOString(),
    disclosure_level: maximumLevel,
    organisations,
    ai_uses: aiUses,
    systems,
    system_versions: systemVersions,
    claims,
    evidence,
    claim_evidence_links: claimEvidenceLinks,
    evaluation_definitions: internal ? bundle.evaluation_definitions : [],
    evaluation_runs: internal ? bundle.evaluation_runs : [],
    evaluation_cases: evaluationCases,
    observations,
    trace_views: traceViews,
  };
};
