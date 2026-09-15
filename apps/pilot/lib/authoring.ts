import type { CruxPortableBundle } from "@crux/formats";
import type {
  DisclosureLevel,
  EvidenceKind,
  EvidenceRelationship,
} from "@crux/schemas";

const nextUseNumber = (bundle: CruxPortableBundle) => {
  let number = bundle.ai_uses.length + 1;
  const usedIds = new Set(bundle.ai_uses.map((item) => item.id));
  while (usedIds.has(`ai-use:use-${number}`)) number += 1;
  return number;
};

const nextEvidenceNumber = (bundle: CruxPortableBundle) => {
  let number = bundle.evidence.length + 1;
  const evidenceIds = new Set(bundle.evidence.map((item) => item.id));
  const linkIds = new Set(bundle.evidence_links.map((item) => item.id));
  while (
    evidenceIds.has(`evidence:manual-${number}`) ||
    linkIds.has(`evidence-link:manual-${number}`)
  ) {
    number += 1;
  }
  return number;
};

export const appendAIUse = (
  bundle: CruxPortableBundle,
  now = new Date().toISOString(),
): { bundle: CruxPortableBundle; aiUseId: string } => {
  const organisation = bundle.organisations[0];
  if (!organisation) {
    throw new Error("Create an organisation before adding an AI use.");
  }

  const next = structuredClone(bundle);
  const number = nextUseNumber(next);
  const key = `use-${number}`;
  const aiUseId = `ai-use:${key}`;
  const systemId = `system:${key}`;
  const versionId = `system-version:${key}:0.1`;
  const processId = `process:${key}`;
  const modelId = `component:${key}-model`;
  const reviewerId = `role:${key}-reviewer`;
  const claimId = `claim:${key}`;

  next.ai_uses.push({
    schema_version: "0.1",
    id: aiUseId,
    organisation_ref: organisation.id,
    name: `AI use ${number}`,
    purpose: "Describe why the organisation uses AI here and what it is trying to achieve.",
    public_summary: "Describe this use of AI in plain language.",
    status: "active",
    people_affected: [],
    consequential: false,
    system_refs: [systemId],
    disclosure: "public",
    external_refs: [],
    created_at: now,
  });

  next.systems.push({
    schema_version: "0.1",
    id: systemId,
    name: `AI-supported workflow ${number}`,
    description: "Describe the system or workflow before focusing on a model or provider.",
    ai_use_refs: [aiUseId],
    influence: ["assistive"],
    agency: "none",
    status: "active",
    current_version_ref: versionId,
    disclosure: "public",
    external_refs: [],
    created_at: now,
  });

  next.system_versions.push({
    schema_version: "0.1",
    id: versionId,
    system_ref: systemId,
    version: "0.1",
    effective_from: now,
    process: {
      id: processId,
      name: `AI-supported workflow ${number}`,
      description: "A deliberately simple starting process for pilot authoring.",
      nodes: [
        {
          id: `node:${key}-input`,
          type: "input",
          name: "Information enters the process",
          disclosure: "public",
        },
        {
          id: `node:${key}-ai`,
          type: "ai",
          name: "AI contributes",
          component_ref: modelId,
          purpose: "Describe what the AI contributes at this point.",
          disclosure: "public",
        },
        {
          id: `node:${key}-human`,
          type: "human",
          name: "Human judgement",
          human_role_ref: reviewerId,
          disclosure: "public",
        },
        {
          id: `node:${key}-output`,
          type: "output",
          name: "Outcome or output",
          disclosure: "public",
        },
      ],
      edges: [
        { from: `node:${key}-input`, to: `node:${key}-ai`, carries: [] },
        { from: `node:${key}-ai`, to: `node:${key}-human`, carries: [] },
        { from: `node:${key}-human`, to: `node:${key}-output`, carries: [] },
      ],
    },
    components: [
      {
        id: modelId,
        kind: "model",
        name: "AI model",
        purpose: "The model used in this part of the workflow.",
        model_identifier: { status: "unknown" },
        externally_provided: true,
        disclosure: "internal",
        external_refs: [],
      },
    ],
    data_sources: [],
    human_roles: [
      {
        id: reviewerId,
        name: "Human reviewer",
        responsibilities: ["Review the AI contribution and remain accountable for the outcome."],
        can_override_ai: true,
        disclosure: "public",
      },
    ],
    decisions: [],
    actions: [],
    risks: [],
    safeguards: [],
    disclosure: "public",
    external_refs: [],
    published_at: now,
  });

  next.claims.push({
    schema_version: "0.1",
    id: claimId,
    type: "descriptive",
    statement: "Describe something important the organisation claims about this AI-supported process.",
    applies_to: [{ kind: "system_version", ref: versionId }],
    status: "active",
    disclosure: "public",
    created_at: now,
  });

  next.generated_at = now;
  return { bundle: next, aiUseId };
};

export type ManualEvidenceInput = {
  summary: string;
  kind: EvidenceKind;
  relationship: EvidenceRelationship;
  disclosure: DisclosureLevel;
  observedAt?: string;
  limitations?: string[];
};

export const appendManualEvidence = (
  bundle: CruxPortableBundle,
  claimId: string,
  input: ManualEvidenceInput,
  now = new Date().toISOString(),
): { bundle: CruxPortableBundle; evidenceId: string; evidenceLinkId: string } => {
  const organisation = bundle.organisations[0];
  const claim = bundle.claims.find((item) => item.id === claimId);
  if (!organisation) throw new Error("Create an organisation before adding evidence.");
  if (!claim) throw new Error(`Cannot add evidence: claim ${claimId} was not found.`);
  if (!input.summary.trim()) throw new Error("Evidence needs a short summary.");

  const next = structuredClone(bundle);
  const number = nextEvidenceNumber(next);
  const evidenceId = `evidence:manual-${number}`;
  const evidenceLinkId = `evidence-link:manual-${number}`;

  next.evidence.push({
    schema_version: "0.1",
    id: evidenceId,
    kind: input.kind,
    summary: input.summary.trim(),
    source: {
      kind: "organisation",
      producer: { name: organisation.name },
    },
    targets: structuredClone(claim.applies_to),
    freshness: { observed_at: input.observedAt ?? now },
    limitations: input.limitations?.filter(Boolean) ?? [],
    external_refs: [],
    disclosure: input.disclosure,
  });

  next.evidence_links.push({
    schema_version: "0.1",
    id: evidenceLinkId,
    claim_ref: claim.id,
    evidence_ref: evidenceId,
    relationship: input.relationship,
    created_at: now,
  });

  next.generated_at = now;
  return { bundle: next, evidenceId, evidenceLinkId };
};
