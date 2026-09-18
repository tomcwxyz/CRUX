import { describe, expect, it } from "vitest";
import { createDiscoveryDeclaration, suggestAIUseCandidates } from "@crux/core";
import { portableBundleFromDiscoveryDeclaration } from "../src/discovery-declaration.js";
import { validateBundleReferences } from "../src/bundle.js";

describe("portableBundleFromDiscoveryDeclaration", () => {
  it("creates a valid portable bundle without inventing claims or evidence", () => {
    const report = {
      format: "crux-discovery/0.1" as const,
      generated_at: "2026-09-18T20:30:00.000Z",
      source: { kind: "source_code" as const, provider: "ship-check", label: "example/app" },
      signals: [{
        id: "call",
        kind: "model_call" as const,
        label: "Anthropic messages call",
        confidence: "high" as const,
        technology: "anthropic",
        workflow_hint: "ask",
        candidate_label: "Ask",
        scope_hint: "use" as const,
        evidence: [{ path: "server/example/ask/orchestrator.py", detail: "messages.create" }],
      }],
      limitations: [],
    };
    const candidate = suggestAIUseCandidates(report)[0]!;
    const declaration = createDiscoveryDeclaration({
      report,
      candidate,
      confirmation: {
        organisation_name: "Example Organisation",
        purpose: "Answer questions using selected evidence.",
        people_affected: ["staff"],
        consequential: false,
        power: "suggest",
      },
      now: "2026-09-18T20:45:00.000Z",
    });
    const bundle = portableBundleFromDiscoveryDeclaration(declaration);

    expect(validateBundleReferences(bundle)).toEqual({ valid: true, issues: [] });
    expect(bundle.claims).toEqual([]);
    expect(bundle.evidence).toEqual([]);
    expect(bundle.system_versions[0]?.id).toBe(declaration.system_version_ref);
  });
});
