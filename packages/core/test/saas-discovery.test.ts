import { describe, expect, it } from "vitest";
import { assessPlatformExport, platformSources, plinthAIPatterns } from "../src/platformEvidence.js";
import { buildSaasDiscoveryPlan, supplierEvidenceRequest, saasProviderRecipe } from "../src/saasDiscovery.js";

const generatedAt = "2026-10-20T13:00:00.000Z";
const planFor = (platform: Parameters<typeof buildSaasDiscoveryPlan>[0]["platform"]) =>
  buildSaasDiscoveryPlan({ platform });

describe("SaaS discovery coverage and access contract", () => {
  it.each(platformSources.map((platform) => platform.id))("plans six evidence dimensions for %s without claiming live access", (platform) => {
    const plan = planFor(platform);
    expect(plan.is_live).toBe(false);
    expect(plan.checks.map((check) => check.dimension)).toEqual([
      "inventory", "capability", "configuration", "activity",
      "human_review", "decision_influence",
    ]);
    expect(plan.checks.map((check) => check.state)).toEqual([
      "not_checked", "supplier_described", "access_required",
      "access_required", "not_checked", "not_checked",
    ]);
    expect(plan.routes.map((route) => route.id)).toEqual([
      "inventory", "settings", "activity", "oversight", "export", "supplier",
    ]);
    expect(plan.routes.filter((route) => route.availability === "available_now").map((route) => route.id))
      .toEqual(["export"]);
    expect(plan.routes.filter((route) => route.method === "audit_api").every((route) => route.availability === "not_connected")).toBe(true);
  });

  it("distinguishes organisation-reported platform use from independently checked inventory", () => {
    const asserted = buildSaasDiscoveryPlan({ platform: "plinth", usage: "reported_used" });
    const inventory = asserted.checks.find((check) => check.dimension === "inventory")!;
    expect(inventory.state).toBe("organisation_reported");
    expect(inventory.provenance).toMatch(/User-provided/);
    expect(inventory.summary).toMatch(/not independently confirmed/i);
    const exploring = buildSaasDiscoveryPlan({ platform: "plinth", usage: "evaluating" });
    expect(exploring.checks[0]?.state).toBe("not_checked");
    expect(exploring.checks[0]?.summary).toMatch(/not recorded as installed/i);
  });

  it("marks only matching unverified audit records as activity evidence", () => {
    const assessment = assessPlatformExport({
      platform: "microsoft-copilot",
      generatedAt,
      data: [{ AuditData: JSON.stringify({
        Operation: "CopilotInteraction", CopilotEventData: { AppHost: "Word" },
        UserID: "PRIVATE_ACTOR", Prompt: "PRIVATE_PROMPT",
      }) }],
    });
    const plan = buildSaasDiscoveryPlan({ platform: "microsoft-copilot", assessment });
    const activity = plan.checks.find((check) => check.dimension === "activity")!;
    expect(activity.state).toBe("observed_in_export");
    expect(activity.provenance).toContain("source and coverage unverified");
    expect(activity.checked_at).toBe(generatedAt);
    expect(plan.checks.find((check) => check.dimension === "configuration")?.state).toBe("access_required");
    expect(plan.checks.find((check) => check.dimension === "decision_influence")?.state).toBe("not_checked");
    expect(JSON.stringify(plan)).not.toContain("PRIVATE_ACTOR");
    expect(JSON.stringify(plan)).not.toContain("PRIVATE_PROMPT");
  });

  it("does not claim non-use or promote generic Plinth grant records", () => {
    const assessment = assessPlatformExport({
      platform: "plinth", generatedAt,
      data: { applications: [{ status: "Rejected", applicant: "SENSITIVE_APPLICANT" }] },
    });
    const plan = buildSaasDiscoveryPlan({ platform: "plinth", assessment });
    expect(plan.checks.find((check) => check.dimension === "activity")?.state).toBe("no_match_in_export");
    expect(plan.evidence_summary).toMatch(/no recognised AI activity/i);
    expect(JSON.stringify(plan)).not.toContain("SENSITIVE_APPLICANT");
    expect(plan.next_actions.some((action) => action.toLowerCase().includes("supplier"))).toBe(true);
  });

  it("ignores assessment from the wrong platform", () => {
    const airtable = assessPlatformExport({
      platform: "airtable", generatedAt, data: [{ eventType: "AI_CREDIT_CONSUMED" }],
    });
    const google = buildSaasDiscoveryPlan({
      platform: "google-gemini", assessment: airtable, usage: "reported_used",
    });
    expect(google.checks.find((check) => check.dimension === "activity")?.state).toBe("access_required");
    expect(google.evidence_summary).toMatch(/No customer-specific/);
  });

  it("provides reviewable least-privilege requests with funder-specific questions", () => {
    const plan = planFor("plinth");
    const pattern = plinthAIPatterns.find((item) => item.id === "grant-assessment")!;
    const request = supplierEvidenceRequest(plan, pattern);
    expect(request).toContain("Assessment and draft scoring");
    expect(request).toContain("assessors see AI drafts");
    expect(request).toMatch(/exclude prompts/i);
    expect(request).toMatch(/override/i);
    expect(plan.routes.some((route) => route.purpose.includes("grant"))).toBe(true);
    expect(saasProviderRecipe("plinth").settings).toMatch(/due-diligence/);
  });
});
