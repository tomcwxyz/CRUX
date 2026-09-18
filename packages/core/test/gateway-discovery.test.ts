import { describe, expect, it } from "vitest";
import { suggestAIUseCandidates } from "../src/discovery.js";
import { discoveryReportFromGateway } from "../src/gatewayDiscovery.js";

describe("discoveryReportFromGateway", () => {
  it("feeds gateway metadata into the same discovery-before-declaration flow", () => {
    const report = discoveryReportFromGateway({
      gateway: "vercel-ai-gateway",
      label: "CRUX production gateway observation",
      generatedAt: "2026-09-18T17:15:45.515Z",
      observations: [{
        id: "crux-live-runtime-1",
        application: "crux",
        workflow: "live.runtime",
        provider: "gateway",
        model: "anthropic/claude-3-haiku",
        invocation_count: 1,
        first_seen: "2026-09-18T17:15:41.775Z",
        last_seen: "2026-09-18T17:15:45.515Z",
      }],
    });

    expect(report.source.kind).toBe("gateway");
    expect(report.signals[0]?.kind).toBe("runtime_observation");
    expect(JSON.stringify(report)).not.toContain('"purpose"');

    const candidates = suggestAIUseCandidates(report);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe("Live Runtime");
    expect(candidates[0]?.confidence).toBe("medium");
    expect(candidates[0]?.unanswered).toEqual(["purpose", "people_affected", "authority"]);
  });
});
