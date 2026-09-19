import { describe, expect, it } from "vitest";
import { DiscoveryReportSchema } from "@crux/schemas";
import { suggestAIUseCandidates } from "../src/discovery.js";
import { buildObservationPatchProposal } from "../src/observationPatch.js";

describe("buildObservationPatchProposal", () => {
  it("keeps the generated patch opt-in and reviewable", () => {
    const report = DiscoveryReportSchema.parse({
      format: "crux-discovery/0.1",
      generated_at: "2026-09-18T20:30:00.000Z",
      source: { kind: "source_code", provider: "github-probe", label: "example/app" },
      signals: [
        { id: "flow", kind: "workflow_job", label: "source.extract", confidence: "high", workflow_hint: "source.extract", candidate_label: "Recommendation extraction", scope_hint: "use", evidence: [{ path: "src/lib/jobs/handlers/extract.ts", detail: "workflow" }] },
        { id: "call", kind: "model_call", label: "Structured generation through the project LLM provider", confidence: "high", technology: "llm-provider", workflow_hint: "source.extract", candidate_label: "Recommendation extraction", scope_hint: "use", evidence: [{ path: "src/lib/jobs/handlers/extract.ts", detail: "call" }] },
      ],
      limitations: [],
    });
    const candidate = suggestAIUseCandidates(report)[0]!;
    const proposal = buildObservationPatchProposal(report, candidate);
    expect(proposal.target_path).toBe("src/lib/jobs/handlers/extract.ts");
    expect(proposal.environment.map((item) => item.name)).toEqual([
      "CRUX_INGEST_URL",
      "CRUX_INGEST_TOKEN",
      "CRUX_SYSTEM_VERSION_REF",
      "CRUX_PRODUCER_ID",
    ]);
    expect(proposal.review_checks.join(" ")).toContain("No prompt");
    expect(proposal.generation.state).toBe("manual_review_required");
  });

  it("marks the proven Open Recs source.extract adapter as available", () => {
    const report = DiscoveryReportSchema.parse({
      format: "crux-discovery/0.1",
      generated_at: "2026-09-19T11:55:00.000Z",
      source: {
        kind: "source_code",
        provider: "github-probe",
        label: "tomcwxyz/open-recs-local#master",
        external_ref: "https://github.com/tomcwxyz/open-recs-local",
      },
      signals: [
        {
          id: "flow",
          kind: "workflow_job",
          label: "source.extract",
          confidence: "high",
          workflow_hint: "source.extract",
          candidate_label: "Extract Source",
          scope_hint: "use",
          evidence: [{
            path: "src/lib/jobs/handlers/extract.ts",
            detail: "workflow",
          }],
        },
        {
          id: "call",
          kind: "model_call",
          label: "Structured generation through the project LLM provider",
          confidence: "high",
          technology: "llm-provider",
          workflow_hint: "source.extract",
          candidate_label: "Extract Source",
          scope_hint: "use",
          evidence: [{
            path: "src/lib/jobs/handlers/extract.ts",
            detail: "call",
          }],
        },
      ],
      limitations: [],
    });

    const candidate = suggestAIUseCandidates(report)[0]!;
    const proposal = buildObservationPatchProposal(report, candidate);

    expect(proposal.generation).toEqual({
      state: "adapter_available",
      adapter_id: "open-recs-source-extract",
      reason: expect.stringContaining("deterministic adapter"),
    });
  });

  it("marks the CI-tested Soundings Ask adapter as available", () => {
    const report = DiscoveryReportSchema.parse({
      format: "crux-discovery/0.1",
      generated_at: "2026-09-19T20:50:00.000Z",
      source: {
        kind: "source_code",
        provider: "github-probe",
        label: "tomcwxyz/soundings#main",
        external_ref: "https://github.com/tomcwxyz/soundings",
      },
      signals: [
        {
          id: "flow",
          kind: "workflow_job",
          label: "ask",
          confidence: "high",
          workflow_hint: "ask",
          candidate_label: "Ask",
          scope_hint: "use",
          evidence: [{
            path: "server/soundings/ask/orchestrator.py",
            detail: "workflow",
          }],
        },
        {
          id: "provider",
          kind: "ai_provider",
          label: "Anthropic SDK",
          confidence: "high",
          technology: "anthropic",
          workflow_hint: "ask",
          candidate_label: "Ask",
          scope_hint: "use",
          evidence: [{
            path: "server/soundings/ask/orchestrator.py",
            detail: "provider",
          }],
        },
        {
          id: "call",
          kind: "model_call",
          label: "Anthropic messages call",
          confidence: "high",
          technology: "anthropic",
          workflow_hint: "ask",
          candidate_label: "Ask",
          scope_hint: "use",
          evidence: [{
            path: "server/soundings/ask/orchestrator.py",
            detail: "call",
          }],
        },
      ],
      limitations: [],
    });

    const candidate = suggestAIUseCandidates(report)[0]!;
    const proposal = buildObservationPatchProposal(report, candidate);

    expect(proposal.generation).toEqual({
      state: "adapter_available",
      adapter_id: "soundings-ask",
      reason: expect.stringContaining("Soundings Ask"),
    });
    expect(proposal.add_file.path).toBe(
      "server/soundings/ask/crux_observe.py",
    );
    expect(proposal.integration_snippet).toContain(
      "emit_crux_ai_invocation",
    );
    expect(proposal.integration_snippet).toContain(
      'operation="messages.create"',
    );
  });
});
