import {
  DiscoveryConfirmationSchema,
  aiUseSchema,
  organisationSchema,
  systemSchema,
  systemVersionSchema,
  type AIAgency,
  type AIInfluence,
  type AIUse,
  type AISystem,
  type DiscoveryCandidate,
  type DiscoveryConfirmation,
  type DiscoveryReport,
  type Organisation,
  type SystemVersion,
} from "@crux/schemas";

export type DiscoveryDeclaration = {
  organisation: Organisation;
  ai_use: AIUse;
  system: AISystem;
  system_version: SystemVersion;
  system_version_ref: string;
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "discovered-ai";

const validExternalRefs = (value?: string): string[] => {
  if (!value) return [];
  try {
    return [new URL(value).toString()];
  } catch {
    return [];
  }
};

const influenceForPower = (power: DiscoveryConfirmation["power"]): AIInfluence => {
  switch (power) {
    case "suggest":
      return "assistive";
    case "recommend":
      return "advisory";
    case "decide":
      return "decisional";
    case "act":
      return "conditional";
  }
};

const agencyFor = (confirmation: DiscoveryConfirmation): AIAgency => {
  if (confirmation.power !== "act") return "none";
  switch (confirmation.action_control) {
    case "human_approval":
      return "human_approval_required";
    case "rule_bounded":
      return "automatic_bounded";
    case "automatic_bounded":
      return "autonomous_bounded";
    default:
      return "none";
  }
};

export const createDiscoveryDeclaration = (input: {
  report: DiscoveryReport;
  candidate: DiscoveryCandidate;
  confirmation: DiscoveryConfirmation;
  now?: string;
}): DiscoveryDeclaration => {
  const confirmation = DiscoveryConfirmationSchema.parse(input.confirmation);
  const now = input.now ?? new Date().toISOString();
  const candidateKey = slug(input.candidate.id.replace(/^candidate:/, ""));
  const organisationKey = slug(confirmation.organisation_name);
  const externalRefs = validExternalRefs(input.report.source.external_ref);

  const organisationId = `organisation:${organisationKey}`;
  const aiUseId = `ai-use:${candidateKey}`;
  const systemId = `system:${candidateKey}`;
  const systemVersionId = `system-version:${candidateKey}:0.1`;
  const processId = `process:${candidateKey}`;
  const componentId = `component:${candidateKey}-ai`;
  const inputNodeId = `node:${candidateKey}-input`;
  const aiNodeId = `node:${candidateKey}-ai`;
  const approvalNodeId = `node:${candidateKey}-approval`;
  const outputNodeId = `node:${candidateKey}-output`;
  const approverRoleId = `role:${candidateKey}-approver`;

  const organisation = organisationSchema.parse({
    schema_version: "0.1",
    id: organisationId,
    name: confirmation.organisation_name,
    disclosure: "internal",
    external_refs: [],
    created_at: now,
  });

  const aiUse = aiUseSchema.parse({
    schema_version: "0.1",
    id: aiUseId,
    organisation_ref: organisationId,
    name: input.candidate.name,
    purpose: confirmation.purpose,
    status: "active",
    people_affected: confirmation.people_affected,
    consequential: confirmation.consequential,
    system_refs: [systemId],
    disclosure: "internal",
    external_refs: externalRefs,
    created_at: now,
  });

  const system = systemSchema.parse({
    schema_version: "0.1",
    id: systemId,
    name: input.candidate.name,
    description: `Human-confirmed AI use discovered from ${input.report.source.label}.`,
    ai_use_refs: [aiUseId],
    influence: [influenceForPower(confirmation.power)],
    agency: agencyFor(confirmation),
    status: "active",
    current_version_ref: systemVersionId,
    disclosure: "internal",
    external_refs: externalRefs,
    created_at: now,
  });

  const requiresHumanApproval =
    confirmation.power === "act" && confirmation.action_control === "human_approval";

  const nodes: SystemVersion["process"]["nodes"] = [
    {
      id: inputNodeId,
      type: "input",
      name: "Input enters the workflow",
      disclosure: "internal",
    },
    {
      id: aiNodeId,
      type: "ai",
      name: input.candidate.name,
      component_ref: componentId,
      purpose: confirmation.purpose,
      disclosure: "internal",
    },
    ...(requiresHumanApproval
      ? [{
          id: approvalNodeId,
          type: "human" as const,
          name: "Human approval",
          human_role_ref: approverRoleId,
          disclosure: "internal" as const,
        }]
      : []),
    {
      id: outputNodeId,
      type: "output",
      name: "Workflow continues",
      disclosure: "internal",
    },
  ];

  const edges: SystemVersion["process"]["edges"] = requiresHumanApproval
    ? [
        { from: inputNodeId, to: aiNodeId, carries: [] },
        { from: aiNodeId, to: approvalNodeId, carries: [] },
        { from: approvalNodeId, to: outputNodeId, carries: [] },
      ]
    : [
        { from: inputNodeId, to: aiNodeId, carries: [] },
        { from: aiNodeId, to: outputNodeId, carries: [] },
      ];

  const systemVersion = systemVersionSchema.parse({
    schema_version: "0.1",
    id: systemVersionId,
    system_ref: systemId,
    version: "0.1",
    effective_from: now,
    change_summary: "Initial draft created from automated discovery plus human confirmation.",
    process: {
      id: processId,
      name: input.candidate.name,
      description: "Minimal workflow scaffold created during discovery onboarding. It should be refined as organisational understanding improves.",
      nodes,
      edges,
    },
    components: [{
      id: componentId,
      kind: "application",
      name: "Discovered AI boundary",
      purpose: "Technical AI boundary associated with this confirmed use.",
      externally_provided: false,
      disclosure: "internal",
      external_refs: externalRefs,
    }],
    data_sources: [],
    human_roles: requiresHumanApproval
      ? [{
          id: approverRoleId,
          name: "Human approver",
          responsibilities: ["Approve the AI-initiated action before it takes effect."],
          can_override_ai: true,
          disclosure: "internal",
        }]
      : [],
    decisions: [],
    actions: [],
    risks: [],
    safeguards: [],
    disclosure: "internal",
    external_refs: externalRefs,
  });

  return {
    organisation,
    ai_use: aiUse,
    system,
    system_version: systemVersion,
    system_version_ref: systemVersion.id,
  };
};
