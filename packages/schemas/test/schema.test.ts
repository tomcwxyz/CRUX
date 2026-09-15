import { describe, expect, it } from "vitest";
import {
  claimSchema,
  evidenceEnvelopeSchema,
  evidenceLinkSchema,
  evaluationDefinitionSchema,
  evaluationRunSchema,
} from "../src/index.js";

const timestamp = "2026-09-15T10:30:00+00:00";

const claim = {
  schema_version: "0.1",
  id: "claim:no-autonomous-rejection",
  type: "control",
  statement: "AI cannot independently reject a funding application.",
  applies_to: [
    {
      kind: "system_version",
      ref: "system-version:funding-assistant:2.3",
    },
  ],
  owner_role: "Head of Funding",
  status: "active",
  disclosure: "public",
  created_at: timestamp,
};

const evaluationDefinition = {
  schema_version: "0.1",
  id: "evaluation-definition:evidence-recall:1",
  version: "1",
  name: "Eligibility evidence recall",
  evaluation_type: "capability",
  purpose: "Test whether relevant eligibility evidence is reliably identified.",
  evaluates: [
    {
      kind: "claim",
      ref: "claim:reliable-evidence-identification",
    },
    {
      kind: "risk",
      ref: "risk:missing-evidence",
    },
  ],
  method: {
    kind: "labelled_dataset",
    description: "Compare extracted evidence with applications labelled by two funding officers.",
  },
  metrics: [
    {
      name: "recall",
      unit: "ratio",
      acceptance: ">= 0.90",
    },
  ],
  limitations: ["Historic applications may not represent future applications."],
  created_at: timestamp,
};

describe("CRUX evidence spine", () => {
  it("accepts a version-scoped organisational claim", () => {
    expect(claimSchema.parse(claim).id).toBe("claim:no-autonomous-rejection");
  });

  it("accepts a reusable evaluation definition and run", () => {
    expect(evaluationDefinitionSchema.parse(evaluationDefinition).evaluation_type).toBe("capability");

    const run = evaluationRunSchema.parse({
      schema_version: "0.1",
      id: "evaluation-run:evidence-recall:2026-09",
      definition_ref: "evaluation-definition:evidence-recall:1",
      definition_version: "1",
      targets: [
        {
          kind: "system_version",
          ref: "system-version:funding-assistant:2.3",
        },
      ],
      conducted_at: timestamp,
      runner: {
        name: "Example Foundation evaluation suite",
        version: "2026.09",
      },
      dataset: {
        description: "100 previously reviewed applications.",
      },
      results: [
        {
          name: "recall",
          value: 0.94,
          unit: "ratio",
        },
      ],
      outcome: "pass",
      limitations: [],
      external_refs: [],
    });

    expect(run.outcome).toBe("pass");
  });

  it("accepts external RACK-style verification as neutral evidence", () => {
    const envelope = evidenceEnvelopeSchema.parse({
      schema_version: "0.1",
      generated_at: timestamp,
      producer: {
        name: "rack",
        version: "0.1.0-alpha",
        uri: "https://github.com/tomcwxyz/rack",
      },
      evidence: {
        schema_version: "0.1",
        id: "evidence:rack:meaningful-verification:2026-09-15",
        kind: "evaluation",
        summary: "Configured working practice passed the bounded verification step.",
        source: {
          kind: "external_tool",
          producer: {
            name: "rack",
            version: "0.1.0-alpha",
            uri: "https://github.com/tomcwxyz/rack",
          },
        },
        targets: [
          {
            kind: "practice",
            ref: "practice:meaningful-verification",
          },
        ],
        freshness: {
          observed_at: timestamp,
        },
        result: {
          outcome: "pass",
          summary: "Bounded verification completed without a failing result.",
          metrics: [],
        },
        limitations: ["The result applies only to the configured verification step."],
        external_refs: [],
        disclosure: "internal",
      },
      external_refs: [],
    });

    expect(envelope.evidence.source.producer.name).toBe("rack");
  });

  it("accepts external Ship Check-style assurance without treating it as broad proof", () => {
    const envelope = evidenceEnvelopeSchema.parse({
      schema_version: "0.1",
      generated_at: timestamp,
      producer: {
        name: "ship-check",
        version: "0.0.0-alpha.7",
        uri: "https://github.com/tomcwxyz/Ship-check",
      },
      evidence: {
        schema_version: "0.1",
        id: "evidence:ship-check:secure-build:2026-09-15",
        kind: "assurance",
        summary: "Secure Build checks completed without high-severity findings.",
        source: {
          kind: "external_tool",
          producer: {
            name: "ship-check",
            version: "0.0.0-alpha.7",
            uri: "https://github.com/tomcwxyz/Ship-check",
          },
        },
        targets: [
          {
            kind: "repository",
            ref: "https://github.com/example/example-ai-service",
          },
        ],
        freshness: {
          observed_at: timestamp,
        },
        result: {
          outcome: "pass",
          summary: "No high-severity finding was triggered by the checks that ran.",
          metrics: [],
        },
        limitations: ["Absence of a finding is not proof that the system is secure."],
        external_refs: [],
        disclosure: "trusted",
      },
      external_refs: [],
    });

    expect(envelope.evidence.limitations[0]).toContain("not proof");
  });

  it("links evidence to claims with an explicit relationship", () => {
    const link = evidenceLinkSchema.parse({
      schema_version: "0.1",
      id: "evidence-link:no-autonomous-rejection:1",
      claim_ref: "claim:no-autonomous-rejection",
      evidence_ref: "evidence:decision-authority:2026-09",
      relationship: "supports",
      rationale: "The configuration and decision-authority test show that rejection requires human authority.",
      created_at: timestamp,
    });

    expect(link.relationship).toBe("supports");
  });

  it("rejects undeclared fields rather than silently widening the contract", () => {
    expect(() => claimSchema.parse({ ...claim, trust_score: 97 })).toThrow();
  });

  it("rejects stale-window metadata that ends before evidence was observed", () => {
    expect(() => evidenceEnvelopeSchema.parse({
      schema_version: "0.1",
      generated_at: timestamp,
      producer: { name: "custom-eval" },
      evidence: {
        schema_version: "0.1",
        id: "evidence:custom:1",
        kind: "evaluation",
        summary: "Example evidence",
        source: {
          kind: "external_tool",
          producer: { name: "custom-eval" },
        },
        targets: [{ kind: "system", ref: "system:example" }],
        freshness: {
          observed_at: "2026-09-15T10:30:00+00:00",
          review_after: "2026-09-14T10:30:00+00:00",
        },
        limitations: [],
        external_refs: [],
        disclosure: "internal",
      },
      external_refs: [],
    })).toThrow();
  });
});
