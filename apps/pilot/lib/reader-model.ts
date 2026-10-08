import type { CruxDisclosureBundle, CruxPortableBundle } from "@crux/formats";
import type { AIAgency, AIInfluence } from "@crux/schemas";
import {
  agencyLabel,
  authorityLabel,
  evidenceKindLabel,
  influenceLabel,
  knowledgeStatusLabel,
  processStepLabel,
  relationshipLabel,
  reversibilityLabel,
} from "./labels";
import { observedBehaviourForVersion } from "./observed";

/**
 * One view model for every CRUX reading surface.
 *
 * Disclosure boundary: a public or affected-person model is built only from a
 * disclosure projection (`redactBundle`). The canonical bundle is only ever read
 * for the internal audience, so hidden fields cannot leak into lower views.
 */

export type Audience = "internal" | "public" | "affected_party";

export type ReaderSource =
  | { kind: "working"; bundle: CruxPortableBundle }
  | { kind: "disclosure"; projection: CruxDisclosureBundle };

export type ReaderChallenge = { text: string; uri?: string };

export type ReaderStep = {
  id: string;
  role: "ai" | "person" | "decision" | "action" | "other";
  roleLabel: string;
  name: string;
  description?: string;
  /** True when an AI step is directly followed by this person step. */
  aiStopsBefore: boolean;
};

export type ReaderDecision = {
  id: string;
  name: string;
  authority: string;
  reviewBeforeEffect: boolean;
  challenge?: ReaderChallenge;
};

export type ReaderAction = {
  id: string;
  name: string;
  scope: string;
  startedBy: string;
  approval: string;
  reversibility: string;
};

export type ReaderEvidence = {
  id: string;
  summary: string;
  kind: string;
  relationship: string;
  tone: "supports" | "caution";
  limitations: string[];
  sourceUrl?: string;
};

export type ReaderClaim = { id: string; statement: string; evidence: ReaderEvidence[] };

export type ReaderCase = {
  id: string;
  aiContribution: string;
  effect: string;
  person?: string;
  outcome: string;
  finalAuthority: string;
  challenge?: ReaderChallenge;
};

export type ReaderActivity = {
  attachedObservations: number;
  modelComparisons: number;
  differencesToReview: number;
};

export type ReaderModel = {
  audience: Audience;
  organisation: string;
  /** Why there is nothing to read, when there is nothing to read. */
  availability: "ready" | "no_use" | "use_not_included";
  use?: {
    id: string;
    name: string;
    summary?: string;
    consequential: boolean;
    peopleAffected: string[];
  };
  system?: { name: string; version?: string; agency?: AIAgency };
  aiCan: string[];
  canActAlone: string;
  humanCheckpoint?: string;
  process?: { name: string; description?: string; steps: ReaderStep[] };
  decisions: ReaderDecision[];
  actions: ReaderAction[];
  claims: ReaderClaim[];
  cases: ReaderCase[];
  /** Gaps not already visible beside a claim. */
  unknowns: string[];
  /** Internal only: runtime behaviour attached to this exact version. */
  activity?: ReaderActivity;
};

// Optional fields in the canonical and projected types allow explicit undefined.
type Maybe<Value> = Value | undefined;
type ChallengeInput = { available: boolean; description?: Maybe<string>; uri?: Maybe<string> };

// The fields both source kinds share once normalised. Canonical records carry
// more fields; the disclosure projection carries exactly what may be shown.
type Normalised = {
  audience: Audience;
  organisation?: string;
  uses: Array<{
    id: string;
    name: string;
    summary?: string;
    consequential: boolean;
    people_affected: string[];
    system_refs: string[];
  }>;
  systems: Array<{
    id: string;
    name: string;
    description: string;
    influence: AIInfluence[];
    agency: AIAgency;
    ai_use_refs: string[];
    current_version_ref?: Maybe<string>;
  }>;
  versions: Array<{
    id: string;
    system_ref: string;
    version: string;
    process: {
      name: string;
      description?: Maybe<string>;
      nodes: Array<{ id: string; type: string; name: string; description?: Maybe<string> }>;
    };
    components: Array<{ kind: string; name: string; model_identifier?: Maybe<{ status: string }> }>;
    decisions: Array<{ id: string; name: string; authority: string; review_before_effect: boolean; challenge?: Maybe<ChallengeInput> }>;
    actions: Array<{
      id: string;
      name: string;
      initiated_by: string;
      human_approval_required: boolean;
      reversibility: string;
      scope: { summary: string };
    }>;
  }>;
  claims: Array<{ id: string; statement: string; applies_to: Array<{ ref: string }> }>;
  evidence: Array<{ id: string; kind: string; summary: string; limitations: string[]; external_refs: string[] }>;
  links: Array<{ claim_ref: string; evidence_ref: string; relationship: string }>;
  receipts: Array<{
    id: string;
    system_version_ref: string;
    ai_summary: string;
    effect_of_ai: string;
    human_involvement?: Maybe<string>;
    final_authority: string;
    outcome: string;
    challenge?: Maybe<ChallengeInput>;
  }>;
  observations: Array<{ system_version_ref: string }>;
};

const normaliseWorking = (bundle: CruxPortableBundle): Normalised => ({
  audience: "internal",
  ...(bundle.organisations[0] ? { organisation: bundle.organisations[0].name } : {}),
  uses: bundle.ai_uses.map((use) => {
    // Internal readers may see the internal purpose when no public summary exists.
    const summary = use.public_summary || use.purpose;
    return { ...use, ...(summary ? { summary } : {}) };
  }),
  systems: bundle.systems,
  versions: bundle.system_versions,
  claims: bundle.claims,
  evidence: bundle.evidence,
  links: bundle.evidence_links,
  receipts: bundle.receipts,
  observations: bundle.observations,
});

const normaliseDisclosure = (projection: CruxDisclosureBundle): Normalised => ({
  audience: projection.disclosure_level === "public" || projection.disclosure_level === "affected_party"
    ? projection.disclosure_level
    : "internal",
  ...(projection.organisations[0] ? { organisation: projection.organisations[0].name } : {}),
  // Only the public-safe summary: never fall back to an internal purpose.
  uses: projection.ai_uses.map(({ purpose: _internalPurpose, ...use }) => ({
    ...use,
    ...(use.public_summary ? { summary: use.public_summary } : {}),
  })),
  systems: projection.systems,
  versions: projection.system_versions,
  claims: projection.claims,
  evidence: projection.evidence,
  links: projection.claim_evidence_links,
  receipts: projection.trace_views.flatMap((trace) => (trace.receipt ? [trace.receipt] : [])),
  observations: projection.observations,
});

const stepRole = (type: string): ReaderStep["role"] => {
  if (type === "ai") return "ai";
  if (type === "human") return "person";
  if (type === "decision") return "decision";
  if (type === "action") return "action";
  return "other";
};

const toChallenge = (
  value: ChallengeInput | undefined,
): ReaderChallenge | undefined => {
  if (!value?.available) return undefined;
  return {
    text: value.description ?? value.uri ?? "A way to question or challenge this is available.",
    ...(value.uri ? { uri: value.uri } : {}),
  };
};

const emptyModel = (source: Normalised, availability: ReaderModel["availability"]): ReaderModel => ({
  audience: source.audience,
  organisation: source.organisation ?? "Organisation",
  availability,
  aiCan: [],
  canActAlone: "Not recorded",
  decisions: [],
  actions: [],
  claims: [],
  cases: [],
  unknowns: [],
});

export const buildReaderModel = (source: ReaderSource, selectedUseId?: string): ReaderModel => {
  const data = source.kind === "working" ? normaliseWorking(source.bundle) : normaliseDisclosure(source.projection);
  const internal = data.audience === "internal";

  // Fall back to the first use only when nothing was selected. A selected use
  // missing from a projection must never be replaced by a different use.
  const use = selectedUseId ? data.uses.find((item) => item.id === selectedUseId) : data.uses[0];
  if (!use) return emptyModel(data, selectedUseId && data.uses.length ? "use_not_included" : "no_use");

  const system = data.systems.find((item) => use.system_refs.includes(item.id) || item.ai_use_refs.includes(use.id));
  const version = system?.current_version_ref
    ? data.versions.find((item) => item.id === system.current_version_ref)
    : data.versions.find((item) => item.system_ref === system?.id);

  const scope = new Set([use.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claims: ReaderClaim[] = data.claims
    .filter((claim) => claim.applies_to.some((target) => scope.has(target.ref)))
    .map((claim) => ({
      id: claim.id,
      statement: claim.statement,
      evidence: data.links
        .filter((link) => link.claim_ref === claim.id)
        .flatMap((link) => {
          const item = data.evidence.find((candidate) => candidate.id === link.evidence_ref);
          if (!item) return [];
          const sourceUrl = item.external_refs.find((ref) => /^https?:\/\//.test(ref));
          return [{
            id: item.id,
            summary: item.summary,
            kind: evidenceKindLabel(item.kind),
            relationship: relationshipLabel(link.relationship),
            tone: link.relationship === "supports" ? "supports" as const : "caution" as const,
            limitations: item.limitations,
            ...(sourceUrl ? { sourceUrl } : {}),
          }];
        }),
    }));

  const decisions: ReaderDecision[] = (version?.decisions ?? []).map((decision) => {
    const challenge = toChallenge(decision.challenge);
    return {
      id: decision.id,
      name: decision.name,
      authority: authorityLabel(decision.authority),
      reviewBeforeEffect: decision.review_before_effect,
      ...(challenge ? { challenge } : {}),
    };
  });

  const nodes = version?.process.nodes ?? [];
  const steps: ReaderStep[] = nodes.map((node, index) => ({
    id: node.id,
    role: stepRole(node.type),
    roleLabel: processStepLabel(node.type),
    name: node.name,
    ...(node.description ? { description: node.description } : {}),
    // One rule everywhere: only claim AI stops where a person takes over.
    aiStopsBefore: node.type === "human" && nodes[index - 1]?.type === "ai",
  }));

  const decisionChallenge = decisions.find((decision) => decision.challenge)?.challenge;
  const cases: ReaderCase[] = version
    ? data.receipts
      .filter((receipt) => receipt.system_version_ref === version.id)
      .map((receipt) => {
        const challenge = toChallenge(receipt.challenge) ?? decisionChallenge;
        return {
          id: receipt.id,
          aiContribution: receipt.ai_summary,
          effect: receipt.effect_of_ai,
          ...(receipt.human_involvement ? { person: receipt.human_involvement } : {}),
          outcome: receipt.outcome,
          finalAuthority: authorityLabel(receipt.final_authority),
          ...(challenge ? { challenge } : {}),
        };
      })
    : [];

  const unknowns: string[] = [];
  for (const component of version?.components ?? []) {
    const status = component.model_identifier?.status ?? "unknown";
    if (component.kind !== "model" || status === "known" || status === "not_applicable") continue;
    unknowns.push(internal
      ? `${component.name}: which AI model is used ${knowledgeStatusLabel(status)}.`
      : `Which AI model is used ${knowledgeStatusLabel(status)}.`);
  }
  // Claims without evidence are shown inline as UNKNOWN beside the claim itself.
  if (use.consequential && !decisions.length) {
    unknowns.push("This use can materially affect people, but no decision authority is recorded.");
  }

  const person = steps.find((step) => step.role === "person");
  const humanCheckpoint = person?.name ?? decisions[0]?.authority;

  const observed = source.kind === "working" && version ? observedBehaviourForVersion(source.bundle, version.id) : undefined;

  return {
    audience: data.audience,
    organisation: data.organisation ?? "Organisation",
    availability: "ready",
    use: {
      id: use.id,
      name: use.name,
      ...(use.summary ? { summary: use.summary } : system?.description ? { summary: system.description } : {}),
      consequential: use.consequential,
      peopleAffected: use.people_affected,
    },
    ...(system ? {
      system: {
        name: system.name,
        ...(version ? { version: version.version } : {}),
        agency: system.agency,
      },
    } : {}),
    aiCan: system ? system.influence.map(influenceLabel) : [],
    canActAlone: system ? agencyLabel(system.agency) : "Not recorded",
    ...(humanCheckpoint ? { humanCheckpoint } : {}),
    ...(version ? {
      process: {
        name: version.process.name,
        ...(version.process.description ? { description: version.process.description } : {}),
        steps,
      },
    } : {}),
    decisions,
    actions: (version?.actions ?? []).map((action) => ({
      id: action.id,
      name: action.name,
      scope: action.scope.summary,
      startedBy: authorityLabel(action.initiated_by),
      approval: action.human_approval_required ? "A person approves before it happens" : "No human approval before it happens",
      reversibility: reversibilityLabel(action.reversibility),
    })),
    claims,
    cases,
    unknowns,
    // Runtime activity exists only for the internal working record, by construction.
    ...(source.kind === "working" && version ? {
      activity: {
        attachedObservations: data.observations.filter((item) => item.system_version_ref === version.id).length,
        modelComparisons: observed?.observationCount ?? 0,
        differencesToReview: observed?.divergenceCount ?? 0,
      },
    } : {}),
  };
};
