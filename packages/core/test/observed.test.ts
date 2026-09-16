import { describe, expect, it } from "vitest";
import type { Event, SystemVersion } from "@crux/schemas";
import {
  compareDeclaredAndObservedModel,
  compareDeclaredAndObservedModels,
  hasDeclaredObservedDivergence,
} from "../src/observed.js";

const version = {
  schema_version: "0.1",
  id: "system-version:funding:2.3",
  system_ref: "system:funding",
  version: "2.3",
  effective_from: "2026-09-16T00:00:00Z",
  process: { id: "process:funding", name: "Funding", nodes: [], edges: [] },
  components: [
    {
      id: "component:funding-model",
      kind: "model",
      name: "Funding model",
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
} as SystemVersion;

const event = {
  schema_version: "0.1",
  id: "event:funding:1",
  run_ref: "run:funding:1",
  sequence: 1,
  occurred_at: "2026-09-16T08:00:00Z",
  type: "ai_invocation",
  component_ref: "component:funding-model",
  attributes: {
    provider: "provider-a",
    request_model: "model-a",
    response_model: "model-b",
  },
  disclosure: "internal",
} as Event;

describe("declared versus observed reconciliation", () => {
  it("reports divergence without changing declared state", () => {
    const comparison = compareDeclaredAndObservedModel(version, event);

    expect(comparison.componentName).toBe("Funding model");
    expect(comparison.fields).toEqual([
      {
        field: "provider",
        declared: "provider-a",
        observed: "provider-a",
        status: "match",
      },
      {
        field: "model_identifier",
        declared: "model-a",
        observed: "model-b",
        status: "divergence",
      },
    ]);
    expect(hasDeclaredObservedDivergence(comparison)).toBe(true);
    expect(version.components[0]?.model_identifier).toEqual({ status: "known", value: "model-a" });
  });

  it("summarises only AI invocation observations", () => {
    const review = {
      ...event,
      id: "event:funding:2",
      sequence: 2,
      type: "human_review",
      attributes: {},
    } as Event;

    expect(compareDeclaredAndObservedModels(version, [event, review])).toHaveLength(1);
  });
});
