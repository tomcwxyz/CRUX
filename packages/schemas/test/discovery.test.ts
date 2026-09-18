import { describe, expect, it } from "vitest";
import { DiscoveryReportSchema } from "../src/discovery.js";

describe("DiscoveryReportSchema", () => {
  it("keeps discovery evidence separate from organisational meaning", () => {
    const report = DiscoveryReportSchema.parse({
      format: "crux-discovery/0.1",
      generated_at: "2026-09-18T18:00:00.000Z",
      source: { kind: "source_code", provider: "ship-check", label: "open-recs-local" },
      signals: [{
        id: "signal:model-call:1",
        kind: "model_call",
        label: "Vercel AI SDK model call",
        confidence: "high",
        technology: "ai",
        workflow_hint: "source.extract",
        evidence: [{ path: "src/lib/providers/llm/openai-compat.ts", line: 47, detail: "generateText call" }],
      }],
      limitations: ["Source inspection cannot establish organisational purpose or authority."],
    });
    expect(report.signals[0]?.kind).toBe("model_call");
    expect((report as unknown as Record<string, unknown>).purpose).toBeUndefined();
  });
});
