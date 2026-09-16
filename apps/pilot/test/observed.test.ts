import { describe, expect, it } from "vitest";
import type { CruxPortableBundle } from "@crux/formats";
import { observedBehaviourForVersion } from "../lib/observed";

const timestamp = "2026-09-16T08:00:00Z";

const bundle: CruxPortableBundle = {
  format: "crux-bundle/0.1",
  generated_at: timestamp,
  organisations: [],
  ai_uses: [],
  systems: [],
  system_versions: [
    {
      schema_version: "0.1",
      id: "system-version:example:1",
      system_ref: "system:example",
      version: "1",
      effective_from: timestamp,
      process: { id: "process:example", name: "Example", nodes: [], edges: [] },
      components: [
        {
          id: "component:example-model",
          kind: "model",
          name: "Example model",
          provider: { status: "known", value: "provider-a" },
          model_identifier: { status: "known", value: "model-a" },
          externally_provided: true,
          disclosure: "internal",
          external_refs: [],
        },
      ],
      data_sources: [],
      human_roles: [],
      decisions: [],
      actions: [],
      risks: [],
      safeguards: [],
      disclosure: "public",
      external_refs: [],
    },
    {
      schema_version: "0.1",
      id: "system-version:example:2",
      system_ref: "system:example",
      version: "2",
      effective_from: "2026-09-16T09:00:00Z",
      process: { id: "process:example:2", name: "Example v2", nodes: [], edges: [] },
      components: [
        {
          id: "component:example-model",
          kind: "model",
          name: "Example model",
          provider: { status: "known", value: "provider-a" },
          model_identifier: { status: "known", value: "model-b" },
          externally_provided: true,
          disclosure: "internal",
          external_refs: [],
        },
      ],
      data_sources: [],
      human_roles: [],
      decisions: [],
      actions: [],
      risks: [],
      safeguards: [],
      disclosure: "public",
      external_refs: [],
    },
  ],
  claims: [],
  evidence: [],
  evidence_links: [],
  evaluation_definitions: [],
  evaluation_runs: [],
  evaluation_cases: [],
  runs: [
    {
      schema_version: "0.1",
      id: "run:example:1",
      system_version_ref: "system-version:example:1",
      started_at: timestamp,
      completed_at: "2026-09-16T08:00:01Z",
      status: "completed",
      capture_mode: "metadata_only",
      disclosure: "internal",
      external_refs: [],
    },
    {
      schema_version: "0.1",
      id: "run:example:2",
      system_version_ref: "system-version:example:2",
      started_at: "2026-09-16T09:00:00Z",
      completed_at: "2026-09-16T09:00:01Z",
      status: "completed",
      capture_mode: "metadata_only",
      disclosure: "internal",
      external_refs: [],
    },
  ],
  events: [
    {
      schema_version: "0.1",
      id: "event:example:1",
      run_ref: "run:example:1",
      sequence: 1,
      occurred_at: timestamp,
      type: "ai_invocation",
      component_ref: "component:example-model",
      attributes: { provider: "provider-a", response_model: "model-b" },
      disclosure: "internal",
    },
    {
      schema_version: "0.1",
      id: "event:example:2",
      run_ref: "run:example:2",
      sequence: 1,
      occurred_at: "2026-09-16T09:00:00Z",
      type: "ai_invocation",
      component_ref: "component:example-model",
      attributes: { provider: "provider-a", response_model: "model-b" },
      disclosure: "internal",
    },
  ],
  traces: [],
  receipts: [],
  observations: [],
};

describe("pilot observed behaviour", () => {
  it("compares runtime observations only against their exact system version", () => {
    const version1 = observedBehaviourForVersion(bundle, "system-version:example:1");
    const version2 = observedBehaviourForVersion(bundle, "system-version:example:2");

    expect(version1.observationCount).toBe(1);
    expect(version1.divergenceCount).toBe(1);
    expect(version2.observationCount).toBe(1);
    expect(version2.divergenceCount).toBe(0);
  });
});
