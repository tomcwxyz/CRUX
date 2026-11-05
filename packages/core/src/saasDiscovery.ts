import type { PlatformAssessment, PlatformSource } from "./platformEvidence.js";

/**
 * A provider-neutral evidence coverage contract. It says exactly what was
 * checked, why it matters, where the evidence came from and what is missing.
 *
 * Never turn supplier documentation or an organisation's own assertion into
 * an authenticated observation. JSON imports are unverified local evidence.
 */
export type SaasCoverageDimension =
  | "inventory" | "capability" | "configuration" | "activity"
  | "human_review" | "decision_influence";
export type SaasCoverageState =
  | "not_checked"
  | "supplier_described"
  | "organisation_reported"
  | "observed_in_export"
  | "no_match_in_export"
  | "access_required";

export type SaasCoverageCheck = {
  dimension: SaasCoverageDimension;
  title: string;
  state: SaasCoverageState;
  summary: string;
  provenance: string;
  checked_at?: string;
};

export type SaasEvidenceRoute = {
  id: "inventory" | "settings" | "activity" | "oversight" | "export" | "supplier";
  label: string;
  purpose: string;
  requested_access: string;
  method: "admin_api" | "audit_api" | "local_export" | "supplier_request" | "review";
  availability: "not_connected" | "available_now" | "external";
  documentation?: string;
};

export type SaasDiscoveryPlan = {
  platform: PlatformSource;
  name: string;
  usage: "unknown" | "reported_used" | "evaluating";
  checks: SaasCoverageCheck[];
  routes: SaasEvidenceRoute[];
  evidence_summary: string;
  next_actions: string[];
  is_live: false;
};

type ProviderRecipe = {
  name: string;
  capability: string;
  inventory: string;
  settings: string;
  activity: string;
  oversight: string;
  docs: string;
};

const providers: Record<PlatformSource, ProviderRecipe> = {
  "microsoft-copilot": {
    name: "Microsoft 365 Copilot",
    capability: "Microsoft describes Copilot features across Microsoft 365 products.",
    inventory: "Entra / Microsoft 365 app and licence inventory",
    settings: "Tenant Copilot licences, policies and permitted integrations",
    activity: "Purview CopilotInteraction events",
    oversight: "Workflow owners and content-review procedures",
    docs: "https://learn.microsoft.com/en-us/purview/audit-copilot",
  },
  "power-automate": {
    name: "Power Automate / Copilot Studio",
    capability: "Microsoft offers AI actions and agents within the Power Platform.",
    inventory: "Power Platform environment and solution inventory",
    settings: "Flow definitions, enabled AI actions and run-only permissions",
    activity: "Per-flow AI-step traces / Copilot Studio interaction logs",
    oversight: "Approval steps, exception handling and human overrides",
    docs: "https://learn.microsoft.com/en-us/power-automate/dataverse/cloud-flow-run-metadata",
  },
  "google-gemini": {
    name: "Google Workspace Gemini",
    capability: "Google offers Gemini features across supported Workspace apps.",
    inventory: "Google Workspace app / licence inventory",
    settings: "Gemini settings, licences and organisational unit policies",
    activity: "Admin Reports Gemini in Workspace feature-utilisation events",
    oversight: "Document approval and human review practices",
    docs: "https://developers.google.com/workspace/admin/reports/v1/appendix/activity/gemini-in-workspace-apps",
  },
  "salesforce-agentforce": {
    name: "Salesforce Agentforce",
    capability: "Salesforce offers configurable AI agents and agent actions.",
    inventory: "Org and agent inventory",
    settings: "Enabled agents, topics, actions, permissions and guardrails",
    activity: "Agentforce GenAI session tracing (OTLP)",
    oversight: "Human handoff, action permissions and escalation records",
    docs: "https://developer.salesforce.com/docs/ai/agentforce/guide/otel-api.html",
  },
  airtable: {
    name: "Airtable",
    capability: "Airtable offers AI fields, automation AI actions and agents.",
    inventory: "Workspace/base inventory",
    settings: "AI field configurations, automations and agents",
    activity: "Enterprise AI_CREDIT_CONSUMED audit events",
    oversight: "Automation approvals and edits to AI-generated fields",
    docs: "https://support.airtable.com/articles/5959979753-tracking-ai-credit-consumption-in-airtable-audit-logs",
  },
  plinth: {
    name: "Plinth",
    capability: "Plinth describes AI-assisted features for funders and charities. Those are distinct potential uses.",
    inventory: "Organisation-specific service, fund and grants inventory",
    settings: "Configured screening, due-diligence and assessment steps",
    activity: "Supplier AI execution markers or separately collected run evidence",
    oversight: "Assessor visibility, edits, approvals, overrides and award decisions",
    docs: "https://docs.plinth.org.uk/",
  },
};

export const saasProviderRecipe = (platform: PlatformSource) => providers[platform];

const checkLabels: Record<SaasCoverageDimension, string> = {
  inventory: "Application in use",
  capability: "AI capabilities available",
  configuration: "AI features enabled",
  activity: "AI activity",
  human_review: "Human review",
  decision_influence: "Decision influence",
};

/**
 * Manual platform selection is an organisation-reported statement, not an
 * independently checked application inventory.
 */
export const buildSaasDiscoveryPlan = (input: {
  platform: PlatformSource;
  usage?: "unknown" | "reported_used" | "evaluating";
  assessment?: PlatformAssessment | null;
  checkedAt?: string;
}): SaasDiscoveryPlan => {
  const { platform, assessment } = input;
  const usage = input.usage ?? "unknown";
  const recipe = providers[platform];
  const imported = assessment?.report.source.provider === platform ? assessment : null;
  const hasAudit = Boolean(imported && imported.ai_events > 0);
  const hasRecords = Boolean(imported && imported.events_inspected > 0);

  const checks: SaasCoverageCheck[] = [
    {
      dimension: "inventory",
      title: checkLabels.inventory,
      state: usage === "reported_used" ? "organisation_reported" : "not_checked",
      summary: usage === "reported_used"
        ? "You indicated your organisation uses this platform. CRUX has not independently confirmed that."
        : usage === "evaluating"
          ? "You are exploring this platform. It is not recorded as installed or in use."
          : "Not yet confirmed whether your organisation uses the platform.",
      provenance: usage === "reported_used" ? "User-provided statement" : "No organisation inventory checked",
    },
    {
      dimension: "capability",
      title: checkLabels.capability,
      state: "supplier_described",
      summary: recipe.capability + " Availability to your organisation has not been checked.",
      provenance: "Supplier documentation, not tenant configuration",
    },
    {
      dimension: "configuration",
      title: checkLabels.configuration,
      state: "access_required",
      summary: "Not checked. " + recipe.settings + " could help establish which features are enabled.",
      provenance: "Requires authorised customer admin settings or supplier attestation",
    },
    {
      dimension: "activity",
      title: checkLabels.activity,
      state: hasAudit ? "observed_in_export"
        : hasRecords ? "no_match_in_export" : "access_required",
      summary: hasAudit
        ? imported!.ai_events + " matching AI activity event(s) in a supplied export; not authenticated against the provider."
        : hasRecords
          ? "No matching AI events in the " + imported!.events_inspected + " inspected entries. This does not establish non-use."
          : "Not checked. " + recipe.activity + " could provide direct evidence.",
      provenance: hasAudit || hasRecords
        ? "User-supplied local JSON; " + imported!.events_inspected + " entries inspected; source and coverage unverified"
        : "Requires an authorised audit source or bounded export",
      ...(hasAudit || hasRecords ? { checked_at: input.checkedAt ?? imported!.report.generated_at } : {}),
    },
    {
      dimension: "human_review",
      title: checkLabels.human_review,
      state: "not_checked",
      summary: "No verified approval or override evidence. " + recipe.oversight + " should be reviewed.",
      provenance: "Needs workflow evidence and confirmation from a responsible person",
    },
    {
      dimension: "decision_influence",
      title: checkLabels.decision_influence,
      state: "not_checked",
      summary: "Whether an AI output informed a decision or affected someone remains unknown.",
      provenance: "Requires linking specific AI steps, review and downstream decisions",
    },
  ];

  const routes: SaasEvidenceRoute[] = [
    {
      id: "inventory", label: "Check application inventory",
      purpose: recipe.inventory,
      requested_access: "Customer administrator read-only inventory access; do not request individual user content.",
      method: "admin_api", availability: "not_connected", documentation: recipe.docs,
    },
    {
      id: "settings", label: "Check enabled AI features",
      purpose: recipe.settings,
      requested_access: "Customer administrator settings or supplier configuration summary; least-privilege read.",
      method: "admin_api", availability: "not_connected", documentation: recipe.docs,
    },
    {
      id: "activity", label: "Check recorded AI activity",
      purpose: recipe.activity,
      requested_access: "Time-scoped AI audit metadata; redact prompts, responses, identities and record contents.",
      method: "audit_api", availability: "not_connected", documentation: recipe.docs,
    },
    {
      id: "oversight", label: "Review human oversight",
      purpose: recipe.oversight,
      requested_access: "Responsible workflow owner and relevant settings/aggregate approval or override records.",
      method: "review", availability: "external",
    },
    {
      id: "export", label: "Inspect an existing JSON export",
      purpose: "Run the current provider-specific, bounded, in-browser AI event classifier.",
      requested_access: "An appropriately redacted JSON file on this device only. Nothing is sent to CRUX.",
      method: "local_export", availability: "available_now",
    },
    {
      id: "supplier", label: "Request a supplier evidence package",
      purpose: "Ask for AI features, configuration, activity provenance, retention and human decision controls.",
      requested_access: "A supplier summary without customer, service-user or applicant records.",
      method: "supplier_request", availability: "external",
    },
  ];
  const next_actions: string[] = [];
  if (usage !== "reported_used") next_actions.push("Confirm whether your organisation uses " + recipe.name + ".");
  if (!hasAudit) next_actions.push("Check " + recipe.activity + " for verifiable AI activity; an export or supplier statement can be reviewed now.");
  next_actions.push("Review " + recipe.settings + " with a customer administrator to distinguish available from enabled features.");
  next_actions.push("Ask the workflow owner how AI outputs are reviewed and whether they affect decisions.");

  return {
    platform,
    name: recipe.name,
    usage,
    checks,
    routes,
    evidence_summary: hasAudit
      ? "An unverified export contains matching AI audit events; no live integration or decision trace is established."
      : hasRecords
        ? "A local export was inspected, but no recognised AI activity was found in that sample."
        : "No customer-specific AI execution evidence collected.",
    next_actions,
    is_live: false,
  };
};

export const supplierEvidenceRequest = (
  plan: SaasDiscoveryPlan,
  workflow?: { name: string; check: string; request: string },
): string => [
  "CRUX | Request for AI use evidence: " + plan.name,
  workflow ? "Workflow: " + workflow.name : "Workflow: please specify",
  "",
  "Please provide a privacy-preserving description of:",
  "1. Which AI features this customer can access and which are enabled.",
  "2. AI-specific activity event types, available audit periods and source provenance.",
  "3. How AI output is presented to staff and any human approval or override controls.",
  "4. Whether AI scores, recommendations or actions can influence downstream decisions.",
  "5. The available read-only API, event stream or recurring metadata export.",
  workflow ? "Specific question: " + workflow.check : "",
  workflow ? "Preferred evidence: " + workflow.request : "",
  "",
  "Please exclude prompts, responses, grant applications, service-user details,",
  "personal identifiers, financial account details and case notes.",
  "A documented absence of logging or access is a useful answer too.",
].filter(Boolean).join("\n");
