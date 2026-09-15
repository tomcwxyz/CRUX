import { describe, expect, it } from "vitest";
import {
  inspectBundle,
  parsePortableBundle,
  portableBundleJsonSchema,
  redactBundle,
  validateBundleReferences,
  type CruxPortableBundle,
} from "../src/index.js";

const timestamp = "2026-09-15T10:00:00+00:00";

const fixture: CruxPortableBundle = {
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
  ai_uses: [
    {
      schema_version: "0.1",
      id: "ai-use:funding-review",
      organisation_ref: "organisation:example",
      name: "Funding review",
      purpose: "Help staff find eligibility evidence.",
      public_summary: "AI helps staff find evidence but does not decide awards.",
      status: "active",
      people_affected: ["funding applicants"],
      consequential: true,
      system_refs: ["system:funding-assistant"],
      disclosure: "public",
      external_refs: [],
      created_at: timestamp,
    },
  ],
  systems: [
    {
      schema_version: "0.1",
      id: "system:funding-assistant",
      name: "Funding Assistant",
      description: "Extracts eligibility evidence for staff review.",
      ai_use_refs: ["ai-use:funding-review"],
      influence: ["informational"],
      agency: "none",
      status: "active",
      current_version_ref: "system-version:funding-assistant:2.3",
      disclosure: "public",
      external_refs: [],
      created_at: timestamp,
    },
  ],
  system_versions: [
    {
      schema_version: "0.1",
      id: "system-version:funding-assistant:2.3",
      system_ref: "system:funding-assistant",
      version: "2.3",
      effective_from: timestamp,
      process: {
        id: "process:funding-review",
        name: "Funding review",
        nodes: [
          {
            id: "node:application",
            type: "input",
            name: "Application",
            disclosure: "public",
          },
          {
            id: "node:review-output",
            type: "output",
            name: "Evidence findings",
            disclosure: "public",
          },
        ],
        edges: [{ from: "node:application", to: "node:review-output", carries: [] }],
      },
      components: [],
      data_sources: [],
      human_roles: [],
      decisions: [],
      actions: [],
      risks: [],
      safeguards: [],
      disclosure: "public",
      external_refs: [],
      published_at: timestamp,
    },
  ],
  claims: [
    {
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
      status: "active",
      disclosure: "public",
      created_at: timestamp,
    },
  ],
  evidence: [
    {
      schema_version: "0.1",
      id: "evidence:decision-authority:1",
      kind: "system_configuration",
      summary: "The configured process contains no AI rejection action.",
      source: {
        kind: "native",
        producer: { name: "crux" },
      },
      targets: [
        {
          kind: "system_version",
          ref: "system-version:funding-assistant:2.3",
        },
      ],
      freshness: { observed_at: timestamp },
      limitations: [],
      external_refs: [],
      disclosure: "public",
    },
  ],
  evidence_links: [
    {
      schema_version: "0.1",
      id: "evidence-link:no-rejection:1",
      claim_ref: "claim:no-autonomous-rejection",
      evidence_ref: "evidence:decision-authority:1",
      relationship: "supports",
      created_at: timestamp,
    },
  ],
  evaluation_definitions: [],
  evaluation_runs: [],
  evaluation_cases: [],
  runs: [
    {
      schema_version: "0.1",
      id: "run:funding:24861",
      system_version_ref: "system-version:funding-assistant:2.3",
      started_at: timestamp,
      completed_at: "2026-09-15T10:00:12+00:00",
      status: "completed",
      capture_mode: "metadata_only",
      disclosure: "internal",
      external_refs: [],
    },
  ],
  events: [
    {
      schema_version: "0.1",
      id: "event:funding:24861:ai",
      run_ref: "run:funding:24861",
      sequence: 1,
      occurred_at: "2026-09-15T10:00:03+00:00",
      type: "ai_invocation",
      summary: "AI extracted eligibility evidence.",
      attributes: { internal_route: "provider-route-a" },
      disclosure: "internal",
    },
    {
      schema_version: "0.1",
      id: "event:funding:24861:review",
      run_ref: "run:funding:24861",
      sequence: 2,
      occurred_at: "2026-09-15T10:00:08+00:00",
      type: "human_review",
      summary: "A funding officer reviewed the original application.",
      attributes: {},
      disclosure: "affected_party",
    },
  ],
  traces: [
    {
      schema_version: "0.1",
      id: "trace:funding:24861",
      run_ref: "run:funding:24861",
      system_version_ref: "system-version:funding-assistant:2.3",
      generated_at: "2026-09-15T10:00:12+00:00",
      steps: [
        { event_ref: "event:funding:24861:ai", relationship_to_previous: "starts" },
        { event_ref: "event:funding:24861:review", relationship_to_previous: "reviews" },
      ],
      summary: "AI evidence extraction led to human review.",
      disclosure: "affected_party",
    },
  ],
  receipts: [
    {
      schema_version: "0.1",
      id: "receipt:funding:af-24861",
      run_ref: "run:funding:24861",
      trace_ref: "trace:funding:24861",
      system_version_ref: "system-version:funding-assistant:2.3",
      occurred_at: "2026-09-15T10:00:12+00:00",
      ai_involvement: ["informational"],
      ai_summary: "AI identified eligibility evidence.",
      effect_of_ai: "The findings prompted human review.",
      human_involvement: "A funding officer checked the original application.",
      final_authority: "human",
      outcome: "The funding officer made the eligibility decision.",
      source_content_included: false,
      disclosure: "affected_party",
      external_refs: [],
    },
  ],
  observations: [],
};

describe("portable CRUX bundle", () => {
  it("parses and validates a coherent standalone bundle", () => {
    const parsed = parsePortableBundle(fixture);
    const validation = validateBundleReferences(parsed);
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it("reports broken cross-references independently of structural parsing", () => {
    const broken: CruxPortableBundle = {
      ...fixture,
      evidence_links: [
        {
          ...fixture.evidence_links[0]!,
          evidence_ref: "evidence:missing:1",
        },
      ],
    };
    const validation = validateBundleReferences(broken);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "missing_evidence")).toBe(true);
  });

  it("inspects claims using the same evidence-resolution rules as CRUX core", () => {
    const inspection = inspectBundle(fixture, "2026-09-15T12:00:00+00:00");
    expect(inspection.claim_statuses[0]?.status).toBe("supported");
    expect(inspection.summary).toContain("Reference validation: valid");
  });

  it("creates a public disclosure bundle without affected-person provenance", () => {
    const projected = redactBundle(fixture, "public");
    expect(projected.organisations).toHaveLength(1);
    expect(projected.claim_evidence_links).toEqual([
      {
        claim_ref: "claim:no-autonomous-rejection",
        evidence_ref: "evidence:decision-authority:1",
        relationship: "supports",
      },
    ]);
    expect(projected.trace_views).toEqual([]);
    expect(projected.evaluation_definitions).toEqual([]);
  });

  it("creates an affected-person trace projection without leaking internal event attributes", () => {
    const projected = redactBundle(fixture, "affected_party");
    expect(projected.trace_views).toHaveLength(1);
    const view = projected.trace_views[0]!;
    expect(view.events).toHaveLength(1);
    expect(view.events[0]?.type).toBe("human_review");
    expect(view.events[0]?.causal_context_incomplete).toBe(true);
    expect("attributes" in view.events[0]!).toBe(false);
    expect(view.receipt?.id).toBe("receipt:funding:af-24861");
  });

  it("exports JSON Schema for independent validators", () => {
    expect(portableBundleJsonSchema).toBeTypeOf("object");
    expect(portableBundleJsonSchema).toHaveProperty("$schema");
  });
});
