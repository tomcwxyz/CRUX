import { describe, expect, it } from "vitest";
import {
  aiUseSchema,
  organisationSchema,
  processSchema,
  systemSchema,
  systemVersionSchema,
} from "../src/index.js";

const timestamp = "2026-09-15T10:30:00+00:00";

const organisation = {
  schema_version: "0.1",
  id: "organisation:example-foundation",
  name: "Example Community Foundation",
  website: "https://example.org",
  transparency_contact: { uri: "https://example.org/ai" },
  disclosure: "public",
  external_refs: [],
  created_at: timestamp,
};

const aiUse = {
  schema_version: "0.1",
  id: "ai-use:funding-review",
  organisation_ref: "organisation:example-foundation",
  name: "Funding application review",
  purpose: "Help funding officers identify evidence relevant to eligibility criteria.",
  public_summary: "AI helps staff find evidence but does not decide whether funding is awarded.",
  status: "active",
  people_affected: ["funding applicants"],
  consequential: true,
  system_refs: ["system:funding-evidence-assistant"],
  owner_role: "Head of Funding",
  disclosure: "public",
  external_refs: [],
  created_at: timestamp,
};

const system = {
  schema_version: "0.1",
  id: "system:funding-evidence-assistant",
  name: "Funding Evidence Assistant",
  description: "Extracts evidence relating to eligibility criteria for review by funding officers.",
  ai_use_refs: ["ai-use:funding-review"],
  influence: ["informational"],
  agency: "none",
  status: "active",
  owner_role: "Head of Funding",
  current_version_ref: "system-version:funding-evidence-assistant:2.3",
  disclosure: "public",
  external_refs: [],
  created_at: timestamp,
};

const known = (value: string) => ({ status: "known", value });

const fundingVersion = {
  schema_version: "0.1",
  id: "system-version:funding-evidence-assistant:2.3",
  system_ref: "system:funding-evidence-assistant",
  version: "2.3",
  effective_from: timestamp,
  change_summary: "Updated the extraction model and uncertainty instructions.",
  process: {
    id: "process:funding-review:2.3",
    name: "Funding eligibility review",
    nodes: [
      { id: "node:application", type: "input", name: "Funding application", disclosure: "public" },
      {
        id: "node:application-data",
        type: "data_source",
        name: "Application data",
        data_source_ref: "data:funding-application",
        disclosure: "public",
      },
      {
        id: "node:extract-evidence",
        type: "ai",
        name: "Extract eligibility evidence",
        component_ref: "component:funding-model",
        purpose: "Identify passages relevant to six eligibility criteria.",
        disclosure: "public",
      },
      {
        id: "node:funding-officer",
        type: "human",
        name: "Funding officer review",
        human_role_ref: "role:funding-officer",
        disclosure: "public",
      },
      {
        id: "node:eligibility-decision",
        type: "decision",
        name: "Eligibility decision",
        decision_ref: "decision:eligibility",
        disclosure: "public",
      },
    ],
    edges: [
      { from: "node:application", to: "node:application-data", carries: ["application"] },
      { from: "node:application-data", to: "node:extract-evidence", carries: ["application text"] },
      { from: "node:extract-evidence", to: "node:funding-officer", carries: ["evidence findings"] },
      { from: "node:funding-officer", to: "node:eligibility-decision", carries: ["reviewed evidence"] },
    ],
  },
  components: [
    {
      id: "component:funding-model",
      kind: "model",
      name: "Evidence extraction model",
      purpose: "Extract relevant evidence without recommending an award decision.",
      provider: known("Example model provider"),
      model_family: known("Example Sonnet"),
      model_identifier: { status: "not_disclosed", reason: "Provider routing identifier is not exposed to the organisation." },
      externally_provided: true,
      disclosure: "public",
      external_refs: [],
    },
  ],
  data_sources: [
    {
      id: "data:funding-application",
      name: "Funding application",
      purpose: "Provides applicant information and evidence for eligibility assessment.",
      origin: "provided_by_affected_party",
      contains_personal_data: "yes",
      contains_sensitive_data: "possible",
      retention: "According to the organisation's grants retention policy.",
      disclosure: "public",
      external_refs: [],
    },
  ],
  human_roles: [
    {
      id: "role:funding-officer",
      name: "Funding officer",
      responsibilities: ["Check AI-generated evidence against the original application", "Make the eligibility decision"],
      can_override_ai: true,
      sees_original_source: true,
      disclosure: "public",
    },
  ],
  decisions: [
    {
      id: "decision:eligibility",
      name: "Eligibility decision",
      consequence: "Determines whether the application proceeds to funding assessment.",
      authority: "human",
      ai_influence: ["informational"],
      review_before_effect: true,
      responsible_role_refs: ["role:funding-officer"],
      challenge: {
        available: true,
        description: "Applicants can contact the funding team for clarification.",
      },
      disclosure: "public",
    },
  ],
  actions: [],
  risks: [
    {
      id: "risk:missing-evidence",
      description: "Relevant application evidence may not be identified by the AI system.",
      affects: ["funding applicants"],
      related_node_refs: ["node:extract-evidence"],
      disclosure: "public",
    },
  ],
  safeguards: [
    {
      id: "safeguard:original-application-review",
      description: "Funding officers can inspect the complete original application alongside the extracted evidence.",
      mitigates: ["risk:missing-evidence"],
      applies_to: ["decision:eligibility"],
      disclosure: "public",
    },
  ],
  disclosure: "public",
  external_refs: [],
  published_at: timestamp,
};

const minimalVersion = (id: string, systemRef: string, processName: string, nodes: unknown[], extra: Record<string, unknown> = {}) => ({
  schema_version: "0.1",
  id,
  system_ref: systemRef,
  version: "1.0",
  effective_from: timestamp,
  process: {
    id: `process:${processName}:1.0`,
    name: processName,
    nodes,
    edges: [],
  },
  components: [],
  data_sources: [],
  human_roles: [],
  decisions: [],
  actions: [],
  risks: [],
  safeguards: [],
  disclosure: "internal",
  external_refs: [],
  ...extra,
});

describe("CRUX organisational and process contracts", () => {
  it("represents organisation → AI use → system independently from runtime or storage", () => {
    expect(organisationSchema.parse(organisation).name).toBe("Example Community Foundation");
    expect(aiUseSchema.parse(aiUse).consequential).toBe(true);
    const parsed = systemSchema.parse(system);
    expect(parsed.influence).toEqual(["informational"]);
    expect(parsed.agency).toBe("none");
  });

  it("represents a consequential grant workflow where AI informs but does not decide", () => {
    const parsed = systemVersionSchema.parse(fundingVersion);
    expect(parsed.decisions[0]?.authority).toBe("human");
    expect(parsed.decisions[0]?.ai_influence).toEqual(["informational"]);
    expect(parsed.safeguards[0]?.mitigates).toEqual(["risk:missing-evidence"]);
  });

  it("represents recruitment with distinct AI and human decision points", () => {
    const version = minimalVersion(
      "system-version:recruitment-shortlisting:1.0",
      "system:recruitment-shortlisting",
      "recruitment-shortlisting",
      [
        { id: "node:auto-reject", type: "decision", name: "Threshold rejection", decision_ref: "decision:auto-reject", disclosure: "internal" },
        { id: "node:interview-review", type: "decision", name: "Interview review", decision_ref: "decision:interview-review", disclosure: "internal" },
      ],
      {
        decisions: [
          {
            id: "decision:auto-reject",
            name: "Threshold rejection",
            consequence: "Candidate does not progress to interview review.",
            authority: "ai",
            ai_influence: ["decisional"],
            review_before_effect: false,
            responsible_role_refs: [],
            disclosure: "internal",
          },
          {
            id: "decision:interview-review",
            name: "Interview review",
            consequence: "Recruiter decides whether to invite the candidate to interview.",
            authority: "human",
            ai_influence: ["advisory"],
            review_before_effect: true,
            responsible_role_refs: ["role:recruiter"],
            disclosure: "internal",
          },
        ],
        human_roles: [
          {
            id: "role:recruiter",
            name: "Recruiter",
            responsibilities: ["Review shortlisted candidates"],
            can_override_ai: true,
            sees_original_source: true,
            disclosure: "internal",
          },
        ],
      },
    );
    const parsed = systemVersionSchema.parse(version);
    expect(parsed.decisions.map((decision) => decision.authority)).toEqual(["ai", "human"]);
  });

  it("keeps a routine writing assistant lightweight", () => {
    const version = minimalVersion(
      "system-version:writing-assistant:1.0",
      "system:writing-assistant",
      "writing-assistant",
      [{ id: "node:suggestion", type: "output", name: "Suggested text", disclosure: "internal" }],
    );
    expect(systemVersionSchema.parse(version).decisions).toHaveLength(0);
  });

  it("represents safeguarding triage as conditional influence without claiming final authority", () => {
    const version = minimalVersion(
      "system-version:safeguarding-triage:1.0",
      "system:safeguarding-triage",
      "safeguarding-triage",
      [
        { id: "node:triage-model", type: "ai", name: "Safeguarding classifier", component_ref: "component:triage-model", purpose: "Flag possible safeguarding risk for routing.", disclosure: "internal" },
        { id: "node:support-worker", type: "human", name: "Support worker", human_role_ref: "role:support-worker", disclosure: "internal" },
      ],
      {
        components: [
          {
            id: "component:triage-model",
            kind: "model",
            name: "Safeguarding classifier",
            model_identifier: { status: "unknown" },
            externally_provided: true,
            disclosure: "internal",
            external_refs: [],
          },
        ],
        human_roles: [
          {
            id: "role:support-worker",
            name: "Support worker",
            responsibilities: ["Review requests and decide support response"],
            can_override_ai: true,
            sees_original_source: true,
            disclosure: "internal",
          },
        ],
      },
    );
    expect(systemVersionSchema.parse(version).components[0]?.model_identifier.status).toBe("unknown");
  });

  it("represents bounded autonomous action separately from decision influence", () => {
    const autonomousSystem = systemSchema.parse({
      schema_version: "0.1",
      id: "system:support-agent",
      name: "Support agent",
      description: "Resolves bounded support requests and escalates exceptions.",
      ai_use_refs: ["ai-use:customer-support"],
      influence: ["informational", "conditional", "decisional"],
      agency: "autonomous_bounded",
      status: "active",
      disclosure: "public",
      external_refs: [],
      created_at: timestamp,
    });

    const version = minimalVersion(
      "system-version:support-agent:1.0",
      "system:support-agent",
      "support-agent",
      [{ id: "node:issue-refund", type: "action", name: "Issue refund", action_ref: "action:issue-refund", disclosure: "public" }],
      {
        actions: [
          {
            id: "action:issue-refund",
            name: "Issue refund",
            initiated_by: "ai",
            human_approval_required: false,
            reversibility: "yes",
            scope: {
              summary: "Refunds are bounded by a fixed monetary limit.",
              limits: { amount: 50, currency: "GBP" },
            },
            escalation: "Requests above the limit are escalated to a person.",
            disclosure: "public",
          },
        ],
      },
    );

    expect(autonomousSystem.agency).toBe("autonomous_bounded");
    expect(systemVersionSchema.parse(version).actions[0]?.scope.limits.amount).toBe(50);
  });

  it("rejects dangling process edges", () => {
    expect(() => processSchema.parse({
      id: "process:broken:1",
      name: "Broken process",
      nodes: [{ id: "node:start", type: "input", name: "Start", disclosure: "internal" }],
      edges: [{ from: "node:start", to: "node:missing", carries: [] }],
    })).toThrow(/missing destination node/);
  });

  it("rejects typed process references that do not exist in the system version", () => {
    const broken = minimalVersion(
      "system-version:broken:1.0",
      "system:broken",
      "broken",
      [{ id: "node:model", type: "ai", name: "Missing model", component_ref: "component:missing", purpose: "Do something", disclosure: "internal" }],
    );
    expect(() => systemVersionSchema.parse(broken)).toThrow(/unknown component/);
  });

  it("requires unavailable model identifiers to be explicit rather than omitted", () => {
    const broken = minimalVersion(
      "system-version:model-missing-status:1.0",
      "system:model-missing-status",
      "model-missing-status",
      [{ id: "node:start", type: "input", name: "Start", disclosure: "internal" }],
      {
        components: [
          {
            id: "component:model-without-identifier",
            kind: "model",
            name: "Mystery model",
            externally_provided: true,
            disclosure: "internal",
            external_refs: [],
          },
        ],
      },
    );
    expect(() => systemVersionSchema.parse(broken)).toThrow(/model identifier/i);
  });
});
