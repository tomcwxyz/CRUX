import { z } from "zod";
import {
  cruxIdSchema,
  disclosureLevelSchema,
  knowledgeStatusSchema,
  schemaVersionSchema,
  stableRefSchema,
  timestampSchema,
} from "./primitives.js";

const prefixedId = (prefix: string) =>
  cruxIdSchema.refine((value) => value.startsWith(`${prefix}:`), {
    message: `Expected an ID beginning ${prefix}:.`,
  });

export const organisationIdSchema = prefixedId("organisation");
export const aiUseIdSchema = prefixedId("ai-use");
export const systemIdSchema = prefixedId("system");
export const systemVersionIdSchema = prefixedId("system-version");
export const processIdSchema = prefixedId("process");
export const processNodeIdSchema = prefixedId("node");
export const componentIdSchema = prefixedId("component");
export const dataSourceIdSchema = prefixedId("data");
export const humanRoleIdSchema = prefixedId("role");
export const decisionIdSchema = prefixedId("decision");
export const actionIdSchema = prefixedId("action");
export const riskIdSchema = prefixedId("risk");
export const safeguardIdSchema = prefixedId("safeguard");

export const aiInfluenceSchema = z.enum([
  "assistive",
  "informational",
  "advisory",
  "conditional",
  "decisional",
]);

export const aiAgencySchema = z.enum([
  "none",
  "proposes_action",
  "human_approval_required",
  "automatic_bounded",
  "autonomous_bounded",
]);

export const aiUseStatusSchema = z.enum(["planned", "active", "paused", "retired"]);
export const systemStatusSchema = z.enum(["draft", "active", "paused", "retired"]);
export const decisionAuthoritySchema = z.enum(["human", "rule", "ai", "hybrid", "external"]);
export const actionInitiatorSchema = z.enum(["human", "rule", "ai", "hybrid", "external"]);
export const reversibilitySchema = z.enum(["yes", "partly", "no", "unknown"]);
export const dataPresenceSchema = z.enum(["yes", "no", "possible", "unknown"]);

export const knowledgeValueSchema = z
  .object({
    status: knowledgeStatusSchema,
    value: z.string().min(1).max(500).optional(),
    reason: z.string().min(1).max(2_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "known" && value.value === undefined) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "A known value must include value.",
      });
    }
    if (value.status !== "known" && value.value !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Only known values may include value.",
      });
    }
    if (["not_disclosed", "withheld"].includes(value.status) && value.reason === undefined) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: `${value.status} values should explain why the value is unavailable.`,
      });
    }
  });

const externalRefsSchema = z.array(z.url()).default([]);
const disclosureSchema = disclosureLevelSchema.default("internal");

export const organisationSchema = z
  .object({
    schema_version: schemaVersionSchema,
    id: organisationIdSchema,
    name: z.string().min(1).max(240),
    legal_name: z.string().min(1).max(240).optional(),
    website: z.url().optional(),
    jurisdiction: z.string().min(1).max(160).optional(),
    organisation_type: z.string().min(1).max(160).optional(),
    description: z.string().max(4_000).optional(),
    transparency_contact: z
      .object({
        name: z.string().min(1).max(160).optional(),
        email: z.string().email().optional(),
        uri: z.url().optional(),
      })
      .strict()
      .refine((value) => Boolean(value.email || value.uri), {
        message: "A transparency contact needs an email or URI.",
      })
      .optional(),
    disclosure: disclosureSchema,
    external_refs: externalRefsSchema,
    created_at: timestampSchema,
    updated_at: timestampSchema.optional(),
    last_reviewed_at: timestampSchema.optional(),
  })
  .strict();

export const aiUseSchema = z
  .object({
    schema_version: schemaVersionSchema,
    id: aiUseIdSchema,
    organisation_ref: organisationIdSchema,
    name: z.string().min(1).max(240),
    purpose: z.string().min(1).max(4_000),
    public_summary: z.string().min(1).max(4_000).optional(),
    status: aiUseStatusSchema,
    people_affected: z.array(z.string().min(1).max(240)).default([]),
    consequential: z.boolean(),
    system_refs: z.array(systemIdSchema).default([]),
    owner_role: z.string().min(1).max(240).optional(),
    disclosure: disclosureSchema,
    external_refs: externalRefsSchema,
    created_at: timestampSchema,
    updated_at: timestampSchema.optional(),
    last_reviewed_at: timestampSchema.optional(),
  })
  .strict();

export const systemSchema = z
  .object({
    schema_version: schemaVersionSchema,
    id: systemIdSchema,
    name: z.string().min(1).max(240),
    description: z.string().min(1).max(4_000),
    ai_use_refs: z.array(aiUseIdSchema).min(1),
    influence: z.array(aiInfluenceSchema).min(1),
    agency: aiAgencySchema,
    status: systemStatusSchema,
    owner_role: z.string().min(1).max(240).optional(),
    current_version_ref: systemVersionIdSchema.optional(),
    disclosure: disclosureSchema,
    external_refs: externalRefsSchema,
    created_at: timestampSchema,
    updated_at: timestampSchema.optional(),
  })
  .strict();

export const componentKindSchema = z.enum([
  "model",
  "application",
  "service",
  "library",
  "database",
  "retrieval_system",
  "agent",
  "other",
]);

export const componentSchema = z
  .object({
    id: componentIdSchema,
    kind: componentKindSchema,
    name: z.string().min(1).max(240),
    purpose: z.string().min(1).max(2_000).optional(),
    provider: knowledgeValueSchema.optional(),
    model_family: knowledgeValueSchema.optional(),
    model_identifier: knowledgeValueSchema.optional(),
    externally_provided: z.boolean().default(false),
    disclosure: disclosureSchema,
    external_refs: externalRefsSchema,
  })
  .strict()
  .superRefine((component, context) => {
    if (component.kind === "model" && component.model_identifier === undefined) {
      context.addIssue({
        code: "custom",
        path: ["model_identifier"],
        message: "Model components must explicitly state whether the model identifier is known or unavailable.",
      });
    }
  });

export const dataSourceOriginSchema = z.enum([
  "provided_by_affected_party",
  "organisation",
  "public",
  "third_party",
  "generated",
  "mixed",
  "unknown",
]);

export const dataSourceSchema = z
  .object({
    id: dataSourceIdSchema,
    name: z.string().min(1).max(240),
    purpose: z.string().min(1).max(2_000).optional(),
    origin: dataSourceOriginSchema,
    contains_personal_data: dataPresenceSchema,
    contains_sensitive_data: dataPresenceSchema,
    retention: z.string().min(1).max(2_000).optional(),
    disclosure: disclosureSchema,
    external_refs: externalRefsSchema,
  })
  .strict();

export const humanRoleSchema = z
  .object({
    id: humanRoleIdSchema,
    name: z.string().min(1).max(240),
    responsibilities: z.array(z.string().min(1).max(1_000)).default([]),
    can_override_ai: z.boolean().optional(),
    sees_original_source: z.boolean().optional(),
    disclosure: disclosureSchema,
  })
  .strict();

export const challengeSchema = z
  .object({
    available: z.boolean(),
    description: z.string().min(1).max(2_000).optional(),
    uri: z.url().optional(),
  })
  .strict()
  .superRefine((challenge, context) => {
    if (challenge.available && challenge.description === undefined && challenge.uri === undefined) {
      context.addIssue({
        code: "custom",
        message: "An available challenge route needs a description or URI.",
      });
    }
  });

export const decisionSchema = z
  .object({
    id: decisionIdSchema,
    name: z.string().min(1).max(240),
    consequence: z.string().min(1).max(4_000),
    authority: decisionAuthoritySchema,
    ai_influence: z.array(aiInfluenceSchema).default([]),
    review_before_effect: z.boolean(),
    responsible_role_refs: z.array(humanRoleIdSchema).default([]),
    challenge: challengeSchema.optional(),
    disclosure: disclosureSchema,
  })
  .strict();

const actionLimitValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const actionSchema = z
  .object({
    id: actionIdSchema,
    name: z.string().min(1).max(240),
    description: z.string().min(1).max(2_000).optional(),
    initiated_by: actionInitiatorSchema,
    human_approval_required: z.boolean(),
    reversibility: reversibilitySchema,
    scope: z
      .object({
        summary: z.string().min(1).max(2_000),
        limits: z.record(z.string().min(1), actionLimitValueSchema).default({}),
      })
      .strict(),
    escalation: z.string().min(1).max(2_000).optional(),
    disclosure: disclosureSchema,
  })
  .strict();

export const riskSchema = z
  .object({
    id: riskIdSchema,
    description: z.string().min(1).max(4_000),
    affects: z.array(z.string().min(1).max(240)).default([]),
    related_node_refs: z.array(processNodeIdSchema).default([]),
    disclosure: disclosureSchema,
  })
  .strict();

export const safeguardSchema = z
  .object({
    id: safeguardIdSchema,
    description: z.string().min(1).max(4_000),
    mitigates: z.array(riskIdSchema).min(1),
    applies_to: z.array(stableRefSchema).default([]),
    disclosure: disclosureSchema,
  })
  .strict();

const processNodeBase = {
  id: processNodeIdSchema,
  name: z.string().min(1).max(240),
  description: z.string().min(1).max(2_000).optional(),
  disclosure: disclosureSchema,
};

export const processNodeSchema = z.discriminatedUnion("type", [
  z.object({ ...processNodeBase, type: z.literal("input") }).strict(),
  z.object({
    ...processNodeBase,
    type: z.literal("data_source"),
    data_source_ref: dataSourceIdSchema,
  }).strict(),
  z.object({
    ...processNodeBase,
    type: z.literal("transformation"),
    component_ref: componentIdSchema.optional(),
  }).strict(),
  z.object({
    ...processNodeBase,
    type: z.literal("ai"),
    component_ref: componentIdSchema,
    purpose: z.string().min(1).max(2_000),
  }).strict(),
  z.object({
    ...processNodeBase,
    type: z.literal("rule"),
    component_ref: componentIdSchema.optional(),
  }).strict(),
  z.object({
    ...processNodeBase,
    type: z.literal("decision"),
    decision_ref: decisionIdSchema,
  }).strict(),
  z.object({
    ...processNodeBase,
    type: z.literal("human"),
    human_role_ref: humanRoleIdSchema,
  }).strict(),
  z.object({
    ...processNodeBase,
    type: z.literal("action"),
    action_ref: actionIdSchema,
  }).strict(),
  z.object({ ...processNodeBase, type: z.literal("output") }).strict(),
  z.object({
    ...processNodeBase,
    type: z.literal("external_system"),
    component_ref: componentIdSchema.optional(),
  }).strict(),
]);

export const processEdgeSchema = z
  .object({
    from: processNodeIdSchema,
    to: processNodeIdSchema,
    carries: z.array(z.string().min(1).max(240)).default([]),
    condition: z.string().min(1).max(1_000).optional(),
  })
  .strict();

export const processSchema = z
  .object({
    id: processIdSchema,
    name: z.string().min(1).max(240),
    description: z.string().min(1).max(4_000).optional(),
    nodes: z.array(processNodeSchema).min(1),
    edges: z.array(processEdgeSchema).default([]),
  })
  .strict()
  .superRefine((process, context) => {
    const nodeIds = new Set<string>();
    for (const [index, node] of process.nodes.entries()) {
      if (nodeIds.has(node.id)) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "id"],
          message: `Duplicate process node ID ${node.id}.`,
        });
      }
      nodeIds.add(node.id);
    }

    for (const [index, edge] of process.edges.entries()) {
      if (!nodeIds.has(edge.from)) {
        context.addIssue({
          code: "custom",
          path: ["edges", index, "from"],
          message: `Process edge references missing source node ${edge.from}.`,
        });
      }
      if (!nodeIds.has(edge.to)) {
        context.addIssue({
          code: "custom",
          path: ["edges", index, "to"],
          message: `Process edge references missing destination node ${edge.to}.`,
        });
      }
    }
  });

const checkUniqueIds = (
  values: Array<{ id: string }>,
  path: string,
  context: z.RefinementCtx,
) => {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value.id)) {
      context.addIssue({
        code: "custom",
        path: [path, index, "id"],
        message: `Duplicate ID ${value.id}.`,
      });
    }
    seen.add(value.id);
  }
};

export const systemVersionSchema = z
  .object({
    schema_version: schemaVersionSchema,
    id: systemVersionIdSchema,
    system_ref: systemIdSchema,
    version: z.string().min(1).max(120),
    effective_from: timestampSchema,
    effective_to: timestampSchema.optional(),
    supersedes: systemVersionIdSchema.optional(),
    change_summary: z.string().min(1).max(4_000).optional(),
    process: processSchema,
    components: z.array(componentSchema).default([]),
    data_sources: z.array(dataSourceSchema).default([]),
    human_roles: z.array(humanRoleSchema).default([]),
    decisions: z.array(decisionSchema).default([]),
    actions: z.array(actionSchema).default([]),
    risks: z.array(riskSchema).default([]),
    safeguards: z.array(safeguardSchema).default([]),
    disclosure: disclosureSchema,
    external_refs: externalRefsSchema,
    published_at: timestampSchema.optional(),
  })
  .strict()
  .superRefine((version, context) => {
    if (
      version.effective_to !== undefined &&
      Date.parse(version.effective_to) < Date.parse(version.effective_from)
    ) {
      context.addIssue({
        code: "custom",
        path: ["effective_to"],
        message: "effective_to cannot precede effective_from.",
      });
    }

    checkUniqueIds(version.components, "components", context);
    checkUniqueIds(version.data_sources, "data_sources", context);
    checkUniqueIds(version.human_roles, "human_roles", context);
    checkUniqueIds(version.decisions, "decisions", context);
    checkUniqueIds(version.actions, "actions", context);
    checkUniqueIds(version.risks, "risks", context);
    checkUniqueIds(version.safeguards, "safeguards", context);

    const componentIds = new Set(version.components.map((item) => item.id));
    const dataSourceIds = new Set(version.data_sources.map((item) => item.id));
    const humanRoleIds = new Set(version.human_roles.map((item) => item.id));
    const decisionIds = new Set(version.decisions.map((item) => item.id));
    const actionIds = new Set(version.actions.map((item) => item.id));
    const riskIds = new Set(version.risks.map((item) => item.id));
    const processNodeIds = new Set(version.process.nodes.map((item) => item.id));

    for (const [index, node] of version.process.nodes.entries()) {
      if ((node.type === "ai" || node.type === "transformation" || node.type === "rule" || node.type === "external_system") && node.component_ref !== undefined && !componentIds.has(node.component_ref)) {
        context.addIssue({
          code: "custom",
          path: ["process", "nodes", index, "component_ref"],
          message: `Process node references unknown component ${node.component_ref}.`,
        });
      }
      if (node.type === "data_source" && !dataSourceIds.has(node.data_source_ref)) {
        context.addIssue({
          code: "custom",
          path: ["process", "nodes", index, "data_source_ref"],
          message: `Process node references unknown data source ${node.data_source_ref}.`,
        });
      }
      if (node.type === "human" && !humanRoleIds.has(node.human_role_ref)) {
        context.addIssue({
          code: "custom",
          path: ["process", "nodes", index, "human_role_ref"],
          message: `Process node references unknown human role ${node.human_role_ref}.`,
        });
      }
      if (node.type === "decision" && !decisionIds.has(node.decision_ref)) {
        context.addIssue({
          code: "custom",
          path: ["process", "nodes", index, "decision_ref"],
          message: `Process node references unknown decision ${node.decision_ref}.`,
        });
      }
      if (node.type === "action" && !actionIds.has(node.action_ref)) {
        context.addIssue({
          code: "custom",
          path: ["process", "nodes", index, "action_ref"],
          message: `Process node references unknown action ${node.action_ref}.`,
        });
      }
    }

    for (const [index, decision] of version.decisions.entries()) {
      for (const [roleIndex, roleRef] of decision.responsible_role_refs.entries()) {
        if (!humanRoleIds.has(roleRef)) {
          context.addIssue({
            code: "custom",
            path: ["decisions", index, "responsible_role_refs", roleIndex],
            message: `Decision references unknown human role ${roleRef}.`,
          });
        }
      }
    }

    for (const [index, risk] of version.risks.entries()) {
      for (const [nodeIndex, nodeRef] of risk.related_node_refs.entries()) {
        if (!processNodeIds.has(nodeRef)) {
          context.addIssue({
            code: "custom",
            path: ["risks", index, "related_node_refs", nodeIndex],
            message: `Risk references unknown process node ${nodeRef}.`,
          });
        }
      }
    }

    for (const [index, safeguard] of version.safeguards.entries()) {
      for (const [riskIndex, riskRef] of safeguard.mitigates.entries()) {
        if (!riskIds.has(riskRef)) {
          context.addIssue({
            code: "custom",
            path: ["safeguards", index, "mitigates", riskIndex],
            message: `Safeguard references unknown risk ${riskRef}.`,
          });
        }
      }
    }
  });

export type Organisation = z.infer<typeof organisationSchema>;
export type AIUse = z.infer<typeof aiUseSchema>;
export type AISystem = z.infer<typeof systemSchema>;
export type SystemVersion = z.infer<typeof systemVersionSchema>;
export type AIInfluence = z.infer<typeof aiInfluenceSchema>;
export type AIAgency = z.infer<typeof aiAgencySchema>;
export type Process = z.infer<typeof processSchema>;
export type ProcessNode = z.infer<typeof processNodeSchema>;
export type Component = z.infer<typeof componentSchema>;
export type DataSource = z.infer<typeof dataSourceSchema>;
export type HumanRole = z.infer<typeof humanRoleSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Action = z.infer<typeof actionSchema>;
export type Risk = z.infer<typeof riskSchema>;
export type Safeguard = z.infer<typeof safeguardSchema>;
