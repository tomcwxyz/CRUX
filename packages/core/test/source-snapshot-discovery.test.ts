import { describe, expect, it } from "vitest";
import { discoverAIFromSourceSnapshot } from "../src/sourceSnapshotDiscovery.js";
import { suggestAIUseCandidates } from "../src/discovery.js";

describe("discoverAIFromSourceSnapshot", () => {
  it("finds multiple use-level workflows while keeping provider infrastructure shared", () => {
    const report = discoverAIFromSourceSnapshot({
      provider: "github-probe",
      label: "example/open-recs",
      externalRef: "https://github.com/example/open-recs",
      generatedAt: "2026-09-18T20:00:00.000Z",
      files: [
        { path: "package.json", content: '{"dependencies":{"ai":"^6","@ai-sdk/openai-compatible":"^2"}}' },
        { path: "src/app/api/chat-search/route.ts", content: "const result = streamText({ model, prompt });" },
        { path: "src/lib/jobs/handlers/extract.ts", content: "const queue = 'source.extract'; await ctx.providers.llm.generateStructured({ prompt, schema });" },
        { path: "src/lib/providers/llm/openai-compat.ts", content: "export interface LlmProvider {}\nconst result = generateText({ model, prompt });" },
        { path: "docs/plan.md", content: "source.extract generateText({ prompt: secret })" },
        { path: "src/lib/jobs/handlers/extract.test.ts", content: "source.extract generateText({ prompt: secret })" },
      ],
    });

    expect(report.signals.every((signal) => signal.evidence.every((evidence) => !evidence.path?.includes("docs/")))).toBe(true);
    expect(report.signals.every((signal) => signal.evidence.every((evidence) => !evidence.path?.includes(".test.")))).toBe(true);

    const candidates = suggestAIUseCandidates(report);
    expect(candidates.map((candidate) => candidate.name)).toContain("Chat Search");
    expect(candidates.map((candidate) => candidate.name)).toContain("Extract Source");
    expect(candidates).toHaveLength(2);
  });

  it("discovers a Python Anthropic ask workflow without application-specific rules", () => {
    const report = discoverAIFromSourceSnapshot({
      provider: "github-probe",
      label: "example/soundings",
      externalRef: "https://github.com/example/soundings",
      generatedAt: "2026-09-18T20:30:00.000Z",
      files: [
        {
          path: "server/soundings/ask/orchestrator.py",
          content: [
            "from anthropic import Anthropic",
            "class AskOrchestrator:",
            "    async def run(self):",
            "        client = Anthropic(api_key='x')",
            "        response = client.messages.create(model='claude-sonnet', messages=[])",
          ].join("\n"),
        },
        {
          path: "server/soundings/ask/test_orchestrator.py",
          content: "from anthropic import Anthropic\nclient.messages.create(model='test', messages=[])",
        },
      ],
    });

    const candidates = suggestAIUseCandidates(report);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe("Ask");
    expect(candidates[0]?.confidence).toBe("high");
    expect(candidates[0]?.observed.technologies).toContain("anthropic");
    expect(report.signals.every((signal) =>
      signal.evidence.every((evidence) => !evidence.path?.includes("test_orchestrator.py")),
    )).toBe(true);
  });
});
