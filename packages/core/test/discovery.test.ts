import { describe, expect, it } from "vitest";
import { suggestAIUseCandidates } from "../src/discovery.js";

describe("suggestAIUseCandidates", () => {
  it("groups technical evidence without treating it as a declaration", () => {
    const candidates = suggestAIUseCandidates({
      format: "crux-discovery/0.1",
      generated_at: "2026-09-18T18:00:00.000Z",
      source: { kind: "source_code", provider: "ship-check", label: "open-recs-local" },
      signals: [
        { id: "sdk", kind: "ai_sdk", label: "Vercel AI SDK", confidence: "high", technology: "ai", evidence: [{ path: "package.json", detail: "AI SDK dependency" }] },
        { id: "provider", kind: "provider_configuration", label: "Swappable LLM provider", confidence: "high", technology: "openai-compatible", evidence: [{ path: "src/lib/providers/index.ts", detail: "LLM provider factory" }] },
        { id: "call", kind: "model_call", label: "Structured model generation", confidence: "high", technology: "ai", workflow_hint: "source.extract", candidate_label: "Recommendation extraction", evidence: [{ path: "src/lib/providers/llm/openai-compat.ts", line: 70, detail: "generateObject" }] },
        { id: "job", kind: "workflow_job", label: "source.extract", confidence: "high", workflow_hint: "source.extract", candidate_label: "Recommendation extraction", evidence: [{ path: "docs/design.md", detail: "Extraction job" }] },
      ],
      limitations: ["Static source inspection cannot establish purpose, affected people or decision authority."],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe("Recommendation extraction");
    expect(candidates[0]?.confidence).toBe("high");
    expect(candidates[0]?.unanswered).toEqual(["purpose", "people_affected", "authority"]);
    expect(candidates[0]?.observed.technologies).toContain("ai");
  });

  it("accepts a non-code gateway producer with the same contract", () => {
    const candidates = suggestAIUseCandidates({
      format: "crux-discovery/0.1",
      generated_at: "2026-09-18T18:00:00.000Z",
      source: { kind: "gateway", provider: "example-gateway", label: "support-service" },
      signals: [
        { id: "runtime", kind: "runtime_observation", label: "Claude model calls", confidence: "high", technology: "anthropic", workflow_hint: "support.reply", candidate_label: "Support reply assistance", evidence: [{ detail: "42 metadata-only invocations observed." }] },
      ],
      limitations: ["Gateway metadata cannot establish why the model was used."],
    });
    expect(candidates[0]?.name).toBe("Support reply assistance");
    expect(candidates[0]?.unanswered).toContain("authority");
  });

  it("does not turn an unscoped review clue into a separate AI use", () => {
    const candidates = suggestAIUseCandidates({
      format: "crux-discovery/0.1",
      generated_at: "2026-09-18T20:30:00.000Z",
      source: { kind: "source_code", provider: "ship-check", label: "example/soundings" },
      signals: [
        {
          id: "ask-call",
          kind: "model_call",
          label: "Anthropic messages call",
          confidence: "high",
          technology: "anthropic",
          workflow_hint: "ask",
          candidate_label: "Ask",
          evidence: [{ path: "server/example/ask/orchestrator.py", detail: "messages.create" }],
        },
        {
          id: "review-clue",
          kind: "human_review_surface",
          label: "Human review surface",
          confidence: "medium",
          evidence: [{ path: "server/example/db/review_status.py", detail: "review status field" }],
        },
      ],
      limitations: [],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe("Ask");
    expect(candidates[0]?.signal_refs).not.toContain("review-clue");
  });
});
