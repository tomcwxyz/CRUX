import { describe, expect, it } from "vitest";
import { importEvidenceEnvelope, type CruxPortableBundle } from "../src/index.js";

const timestamp = "2026-09-16T08:00:00+00:00";

const bundle: CruxPortableBundle = {
  format: "crux-bundle/0.1",
  generated_at: timestamp,
  organisations: [
    {
      schema_version: "0.1",
      id: "organisation:example",
      name: "Example Foundation",
      disclosure: "public",
      external_refs: [],
      created_at: timestamp,
    },
  ],
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
};

const envelope = {
  schema_version: "0.1",
  generated_at: "2026-09-16T08:05:00+00:00",
  producer: {
    name: "example-ci",
    version: "1.0.0",
    uri: "https://example.org/ci",
  },
  evidence: {
    schema_version: "0.1",
    id: "evidence:ci:eligibility-eval-42",
    kind: "evaluation",
    title: "Eligibility regression suite",
    summary: "The bounded regression suite completed successfully.",
    source: {
      kind: "external_tool",
      producer: {
        name: "example-ci",
        version: "1.0.0",
        uri: "https://example.org/ci",
      },
      source_ref: "https://example.org/runs/42",
    },
    targets: [{ kind: "organisation", ref: "organisation:example" }],
    freshness: { observed_at: "2026-09-16T08:04:00+00:00" },
    result: {
      outcome: "pass",
      summary: "24 of 24 acceptance cases passed.",
      metrics: [{ name: "acceptance_cases_passed", value: 24, unit: "cases" }],
    },
    limitations: ["This suite covers configured acceptance cases, not all real-world behaviour."],
    external_refs: ["https://example.org/runs/42"],
    disclosure: "trusted",
  },
  external_refs: ["https://example.org/runs/42"],
};

describe("EvidenceEnvelope import", () => {
  it("imports external evidence without silently linking it to a claim", () => {
    const result = importEvidenceEnvelope(bundle, envelope);

    expect(result.status).toBe("imported");
    expect(result.bundle.evidence).toHaveLength(1);
    expect(result.bundle.evidence[0]?.id).toBe("evidence:ci:eligibility-eval-42");
    expect(result.bundle.evidence_links).toEqual([]);
    expect(result.bundle.generated_at).toBe("2026-09-16T08:05:00+00:00");
  });

  it("is idempotent when CI replays the same envelope", () => {
    const first = importEvidenceEnvelope(bundle, envelope);
    const replay = importEvidenceEnvelope(first.bundle, envelope);

    expect(replay.status).toBe("already_present");
    expect(replay.bundle.evidence).toHaveLength(1);
  });

  it("rejects reuse of an evidence ID for different evidence", () => {
    const first = importEvidenceEnvelope(bundle, envelope);
    const changed = {
      ...envelope,
      evidence: {
        ...envelope.evidence,
        summary: "A materially different result tried to reuse the same stable ID.",
      },
    };

    expect(() => importEvidenceEnvelope(first.bundle, changed)).toThrow(
      /Evidence ID conflict/,
    );
  });

  it("rejects missing internal CRUX targets", () => {
    const missingTarget = {
      ...envelope,
      evidence: {
        ...envelope.evidence,
        id: "evidence:ci:missing-target",
        targets: [{ kind: "organisation", ref: "organisation:missing" }],
      },
    };

    expect(() => importEvidenceEnvelope(bundle, missingTarget)).toThrow(
      /targets missing organisation organisation:missing/,
    );
  });
});
