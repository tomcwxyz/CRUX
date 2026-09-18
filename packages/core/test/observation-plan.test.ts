import { describe, expect, it } from "vitest";
import { DiscoveryReportSchema } from "@crux/schemas";
import { suggestAIUseCandidates } from "../src/discovery.js";
import { buildObservationPlan } from "../src/observationPlan.js";

describe("buildObservationPlan", () => {
  it("prefers a use-level workflow boundary over shared provider instrumentation", () => {
    const report = DiscoveryReportSchema.parse({
      format: "crux-discovery/0.1",
      generated_at: "2026-09-18T20:00:00.000Z",
      source: { kind: "source_code", provider: "github-probe", label: "example/app" },
      signals: [
        { id: "shared", kind: "model_call", label: "Vercel AI SDK structured generation", confidence: "high", scope_hint: "shared", evidence: [{ path: "src/lib/providers/llm.ts", detail: "shared provider" }] },
        { id: "flow", kind: "workflow_job", label: "source.extract", confidence: "high", workflow_hint: "source.extract", candidate_label: "Recommendation extraction", scope_hint: "use", evidence: [{ path: "src/lib/jobs/handlers/extract.ts", line: 80, detail: "workflow" }] },
        { id: "call", kind: "model_call", label: "Structured generation through the project LLM provider", confidence: "high", technology: "llm-provider", workflow_hint: "source.extract", candidate_label: "Recommendation extraction", scope_hint: "use", evidence: [{ path: "src/lib/jobs/handlers/extract.ts", line: 180, detail: "call" }] },
      ],
      limitations: [],
    });
    const candidate = suggestAIUseCandidates(report)[0]!;
    const plan = buildObservationPlan(report, candidate);
    expect(plan.primary_path).toBe("src/lib/jobs/handlers/extract.ts");
    expect(plan.strategy).toBe("workflow_metadata_hook");
    expect(plan.excluded_content).toContain("prompt text");
  });
});
