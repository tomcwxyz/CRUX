import { DiscoveryReportSchema, type DiscoveryReport, type DiscoverySignal } from "@crux/schemas";

/** Provider exports are *unverified, user-supplied* evidence, not live integrations. */
export type PlatformSource = "microsoft-copilot" | "power-automate" | "google-gemini" |
  "salesforce-agentforce" | "airtable" | "plinth";

export const platformSources: Array<{ id: PlatformSource; label: string; import_label: string; coverage: string }> = [
  { id: "microsoft-copilot", label: "Microsoft 365 Copilot", import_label: "Purview audit JSON", coverage: "Recorded AI interactions, not decisions or outcomes" },
  { id: "power-automate", label: "Power Automate / Copilot Studio", import_label: "FlowRun export JSON", coverage: "Flow executions alone do not prove AI activity" },
  { id: "google-gemini", label: "Google Workspace Gemini", import_label: "Admin Reports JSON", coverage: "Gemini feature utilisation, not model reasoning" },
  { id: "salesforce-agentforce", label: "Salesforce Agentforce", import_label: "Session Trace OTLP JSON", coverage: "Agent model spans; review decisions and actions separately" },
  { id: "airtable", label: "Airtable", import_label: "Audit / configuration JSON", coverage: "Enterprise AI credit events provide AI activity evidence; ordinary updates do not" },
  { id: "plinth", label: "Plinth", import_label: "Platform API / export JSON", coverage: "Case and service records do not establish AI use" },
];

export type PlatformAssessment = {
  report: DiscoveryReport;
  events_inspected: number;
  ai_events: number;
  evidence_level: "ai_activity" | "context_only" | "unknown";
  explanation: string;
  next_step: string;
};

const explanations: Record<PlatformSource, string> = {
  "microsoft-copilot": "A Copilot interaction audit event records AI activity, but does not explain authority or actual effect.",
  "power-automate": "A FlowRun record confirms a workflow execution, not an AI invocation or human decision.",
  "google-gemini": "Gemini feature utilisation establishes recorded AI use, but not its organisational purpose.",
  "salesforce-agentforce": "Agentforce GenAI spans record model activity but not necessarily actions or outcomes.",
  airtable: "Airtable Enterprise AI_CREDIT_CONSUMED audit events evidence an AI feature consuming credits; ordinary table changes do not.",
  plinth: "Plinth member, case and activity records are not AI execution logs.",
};
const obj = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {};
const records = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.slice(0, 1000).filter((item) => Object.keys(obj(item)).length > 0).map(obj) : [];
const arrayAt = (v: unknown, field: string) => records(obj(v)[field]);
const hostLabel = (v: unknown): string => {
  const map: Record<string, string> = { word: "Word", excel: "Excel", powerpoint: "PowerPoint",
    outlook: "Outlook", teams: "Teams", bizchat: "Copilot Chat", bing: "Bing",
    office: "Office", sharepoint: "SharePoint" };
  return map[String(v).toLowerCase()] ?? "Other Microsoft service";
};
const summarizeMicrosoft = (input: unknown) => {
  const rows = Array.isArray(input) ? records(input) : arrayAt(input, "records").length
    ? arrayAt(input, "records") : arrayAt(input, "value");
  const groups = new Map<string, number>();
  let count = 0;
  for (const row of rows) {
    let audit = row;
    if (typeof row.AuditData === "string") {
      try { audit = obj(JSON.parse(row.AuditData)); } catch { continue; }
    } else if (row.AuditData) audit = obj(row.AuditData);
    if (audit.Operation !== "CopilotInteraction" && audit.Operation !== "ConnectedAIAppInteraction") continue;
    count++;
    const host = hostLabel(obj(audit.CopilotEventData).AppHost);
    groups.set(host, (groups.get(host) ?? 0) + 1);
  }
  return { inspected: rows.length, count, groups };
};
const summarizeGoogle = (input: unknown) => {
  let inspected = 0, count = 0;
  for (const item of arrayAt(input, "items")) {
    if (obj(item.id).applicationName !== "gemini_in_workspace_apps") continue;
    for (const e of records(item.events).slice(0, 100)) {
      inspected++;
      if (e.name === "feature_utilization" && e.type === "ai_usage_event") count++;
    }
  }
  return { inspected, count, groups: new Map([["Gemini in Workspace", count]]) };
};
const summarizeSalesforce = (input: unknown) => {
  let inspected = 0, count = 0;
  for (const resource of arrayAt(input, "resourceSpans").slice(0, 100))
    for (const scope of arrayAt(resource, "scopeSpans").slice(0, 100))
      for (const span of arrayAt(scope, "spans").slice(0, 200)) {
        if (inspected >= 1000) break;
        inspected++;
        if (records(span.attributes).some((a) =>
          ["gen_ai.operation.name", "gen_ai.provider.name", "gen_ai.request.model"].includes(String(a.key)))) count++;
      }
  return { inspected, count, groups: new Map([["Agentforce model activity", count]]) };
};
const summarizeAirtable = (input: unknown) => {
  const rows = Array.isArray(input) ? records(input)
    : arrayAt(input, "events").length ? arrayAt(input, "events")
    : arrayAt(input, "value").length ? arrayAt(input, "value")
    : arrayAt(input, "records");
  const count = rows.filter((row) =>
    row.eventType === "AI_CREDIT_CONSUMED").length;
  return { inspected: rows.length, count,
    groups: new Map([["Airtable AI credit event", count]]) };
};
const contextCount = (input: unknown) => {
  if (Array.isArray(input)) return Math.min(input.length, 1000);
  for (const key of ["value", "records", "runs", "events", "items", "members", "cases"]) {
    if (Array.isArray(obj(input)[key])) return Math.min((obj(input)[key] as unknown[]).length, 1000);
  }
  return 0;
};

/**
 * Classify only documented AI events. Return a CRUX discovery report containing
 * fixed labels and counts, NEVER prompts, users, customer records or raw exports.
 * No AI evidence => no candidate, not an assertion of absence.
 */
export const assessPlatformExport = ({
  platform, data, generatedAt,
}: { platform: PlatformSource; data: unknown; generatedAt: string }): PlatformAssessment => {
  const source = platformSources.find((s) => s.id === platform);
  if (!source) throw new Error("Unknown platform.");
  if (!Array.isArray(data) && Object.keys(obj(data)).length === 0) throw new Error("Choose a JSON array or object export.");
  const result = platform === "microsoft-copilot" ? summarizeMicrosoft(data)
    : platform === "google-gemini" ? summarizeGoogle(data)
    : platform === "salesforce-agentforce" ? summarizeSalesforce(data)
    : platform === "airtable" ? summarizeAirtable(data)
    : { inspected: contextCount(data), count: 0, groups: new Map<string, number>() };
  const signals: DiscoverySignal[] = [];
  for (const [host, count] of result.groups) {
    if (count === 0) continue;
    const hint = platform + ".activity." + signals.length;
    signals.push({
      id: "signal:platform:" + hint,
      kind: "runtime_observation",
      label: platform === "microsoft-copilot" ? "Copilot interaction (" + host + ")"
        : platform === "google-gemini" ? "Gemini feature utilisation"
          : platform === "airtable" ? "Airtable AI credit consumed" : "Agentforce model activity",
      confidence: "high",
      technology: platform,
      workflow_hint: hint,
      candidate_label: platform === "microsoft-copilot" ? "Copilot in " + host
        : platform === "google-gemini" ? "Gemini in Workspace"
          : platform === "airtable" ? "Airtable AI feature" : "Agentforce session",
      scope_hint: "use",
      evidence: [{ detail: count + " matching AI audit record(s) in a user-supplied export. Authenticity and completeness are unverified." }],
    });
  }
  const report = DiscoveryReportSchema.parse({
    format: "crux-discovery/0.1",
    generated_at: generatedAt,
    source: { kind: "platform", provider: platform, label: source.label + " (local export)" },
    signals,
    limitations: [
      explanations[platform],
      "This report comes from a user-supplied export, not a verified live supplier connection.",
      "Only fixed event categories and aggregate counts are retained; no user identities, case notes, prompts, responses or customer records are copied.",
      "No matching event does not mean no AI was used. Exports may be incomplete, filtered or outside supplier retention.",
      "Purpose, affected people, decisions, review authority and outcomes are not inferred.",
    ],
  });
  return {
    report,
    events_inspected: result.inspected,
    ai_events: result.count,
    evidence_level: result.count ? "ai_activity" : result.inspected ? "context_only" : "unknown",
    explanation: explanations[platform],
    next_step: result.count
      ? "Review the observed AI activity as a candidate and confirm what it means."
      : "Describe the specific AI feature or workflow and seek AI-specific execution evidence. Generic CRM records are insufficient.",
  };
};
