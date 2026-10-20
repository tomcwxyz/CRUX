import { describe, expect, it } from "vitest";
import { assessPlatformExport, platformSources } from "../src/platformEvidence.js";
import { suggestAIUseCandidates } from "../src/discovery.js";

const generatedAt = "2026-10-20T11:00:00.000Z";
const assess = (platform: Parameters<typeof assessPlatformExport>[0]["platform"], data: unknown) =>
  assessPlatformExport({ platform, data, generatedAt });

describe("SaaS evidence discovery: never infer AI from ordinary records", () => {
  it("recognises Purview Copilot interactions without copying sensitive audit data", () => {
    const secret = "PERSONAL_PROMPT_CLIENT_HEALTH_DATA_MUST_NOT_ESCAPE";
    const result = assess("microsoft-copilot", [
      { AuditData: JSON.stringify({
        Operation: "CopilotInteraction",
        UserID: "user@example.org",
        CopilotEventData: { AppHost: "Word", Messages: [{ Content: secret }] },
      }) },
      { AuditData: JSON.stringify({
        Operation: "CopilotInteraction",
        CopilotEventData: { AppHost: "Word", Messages: [{ Content: secret }] },
      }) },
      { AuditData: JSON.stringify({ Operation: "FileAccessed", CopilotEventData: { AppHost: "Word" } }) },
    ]);
    expect(result.ai_events).toBe(2);
    expect(result.events_inspected).toBe(3);
    expect(result.evidence_level).toBe("ai_activity");
    expect(result.report.signals[0]?.kind).toBe("runtime_observation");
    expect(suggestAIUseCandidates(result.report)).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("user@example.org");
  });

  it("recognises Workspace Gemini utilisation but not generic Drive events", () => {
    const data = {
      items: [
        { id: { applicationName: "gemini_in_workspace_apps" }, actor: { email: "private@example.org" },
          events: [
            { name: "feature_utilization", type: "ai_usage_event", parameters: [{ name: "prompt", value: "secret" }] },
            { name: "irrelevant", type: "setting" },
          ] },
        { id: { applicationName: "drive" }, events: [
          { name: "feature_utilization", type: "ai_usage_event" },
        ] },
      ],
    };
    const result = assess("google-gemini", data);
    expect(result.ai_events).toBe(1);
    expect(result.events_inspected).toBe(2);
    expect(result.report.signals[0]?.technology).toBe("google-gemini");
    expect(JSON.stringify(result)).not.toContain("private@example.org");
  });

  it("recognises Agentforce OTLP GenAI spans but excludes prompt and unrelated spans", () => {
    const result = assess("salesforce-agentforce", {
      resourceSpans: [{ scopeSpans: [{ spans: [
        { name: "chat", attributes: [
          { key: "gen_ai.operation.name", value: { stringValue: "chat" } },
          { key: "gen_ai.input.messages", value: { stringValue: "CASE_NOTES_SECRET" } },
        ] },
        { name: "web request", attributes: [{ key: "http.request.method", value: { stringValue: "GET" } }] },
      ] }] }],
    });
    expect(result.events_inspected).toBe(2);
    expect(result.ai_events).toBe(1);
    expect(JSON.stringify(result)).not.toContain("CASE_NOTES_SECRET");
  });

  it.each([
    ["power-automate", { value: [{ name: "run-1", status: "Succeeded", workflow: "send_email" }] }],
    ["airtable", [{ eventType: "record.updated", record: { name: "sensitive person" } }]],
    ["plinth", { members: [{ name: "sensitive person", note: "SENSITIVE_CASE_BODY_39420" }] }],
  ] as const)("does not promote %s operational data to AI evidence", (platform, data) => {
    const result = assess(platform, data);
    expect(result.ai_events).toBe(0);
    expect(result.report.signals).toHaveLength(0);
    expect(suggestAIUseCandidates(result.report)).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("sensitive person");
    expect(JSON.stringify(result)).not.toContain("SENSITIVE_CASE_BODY_39420");
  });

  it("retains supported providers and explicit limitations", () => {
    expect(platformSources.map((item) => item.id)).toEqual([
      "microsoft-copilot", "power-automate", "google-gemini",
      "salesforce-agentforce", "airtable", "plinth",
    ]);
    const result = assess("plinth", { members: [{ id: "1" }] });
    expect(result.evidence_level).toBe("context_only");
    expect(result.report.limitations.join(" ")).toMatch(/not a verified live supplier connection/i);
  });
});
