import { describe, expect, it } from "vitest";
import { redactBundle, type CruxPortableBundle } from "../src/index.js";

const timestamp = "2026-09-15T12:00:00+00:00";

const emptyBundle = (): CruxPortableBundle => ({
  format: "crux-bundle/0.1",
  generated_at: timestamp,
  organisations: [],
  ai_uses: [],
  systems: [],
  system_versions: [],
  claims: [],
  evidence: [],
  evidence_links: [],
  evaluation_definitions: [],
  evaluation_runs: [],
  evaluation_cases: [],
  runs: [],
  events: [],
  traces: [],
  receipts: [],
  observations: [],
});

describe("disclosure target filtering", () => {
  it("preserves public external practice evidence without requiring RACK objects inside CRUX", () => {
    const bundle = emptyBundle();
    bundle.evidence.push({
      schema_version: "0.1",
      id: "evidence:rack:practice:1",
      kind: "evaluation",
      summary: "External working-practice verification evidence.",
      source: {
        kind: "external_tool",
        producer: { name: "rack" },
      },
      targets: [{ kind: "practice", ref: "practice:meaningful-verification" }],
      freshness: { observed_at: timestamp },
      limitations: [],
      external_refs: [],
      disclosure: "public",
    });

    const projected = redactBundle(bundle, "public");
    expect(projected.evidence).toHaveLength(1);
  });

  it("does not leak a reference to a hidden CRUX-owned system", () => {
    const bundle = emptyBundle();
    bundle.evidence.push({
      schema_version: "0.1",
      id: "evidence:hidden-system:1",
      kind: "evaluation",
      summary: "Evidence whose target is not disclosed.",
      source: {
        kind: "native",
        producer: { name: "crux" },
      },
      targets: [{ kind: "system", ref: "system:hidden" }],
      freshness: { observed_at: timestamp },
      limitations: [],
      external_refs: [],
      disclosure: "public",
    });

    const projected = redactBundle(bundle, "public");
    expect(projected.evidence).toEqual([]);
  });

  it("preserves evidence targeting a visible claim", () => {
    const bundle = emptyBundle();
    bundle.claims.push({
      schema_version: "0.1",
      id: "claim:external-practice-boundary",
      type: "control",
      statement: "A practice boundary is externally verifiable.",
      applies_to: [{ kind: "practice", ref: "practice:boundary" }],
      status: "active",
      disclosure: "public",
      created_at: timestamp,
    });
    bundle.evidence.push({
      schema_version: "0.1",
      id: "evidence:claim-target:1",
      kind: "evaluation",
      summary: "Evidence aimed directly at the published claim.",
      source: {
        kind: "external_tool",
        producer: { name: "external-eval" },
      },
      targets: [{ kind: "claim", ref: "claim:external-practice-boundary" }],
      freshness: { observed_at: timestamp },
      limitations: [],
      external_refs: [],
      disclosure: "public",
    });

    const projected = redactBundle(bundle, "public");
    expect(projected.claims).toHaveLength(1);
    expect(projected.evidence).toHaveLength(1);
  });
});
