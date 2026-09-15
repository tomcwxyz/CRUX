import { describe, expect, it } from "vitest";
import type { SystemVersion } from "@crux/schemas";
import {
  compareDeclaredAndObservedModel,
  createInstrumentationSession,
  recordAISdkStep,
  recordOpenTelemetryGenAI,
} from "../src/index.js";

const createSession = () =>
  createInstrumentationSession({
    runId: "run:pipeline-test",
    systemVersionRef: "system-version:funding:2.3",
    startedAt: "2026-09-15T15:00:00Z",
  });

const version = {
  schema_version: "0.1",
  id: "system-version:funding:2.3",
  system_ref: "system:funding",
  version: "2.3",
  effective_from: "2026-09-15T00:00:00Z",
  process: {
    id: "process:funding",
    name: "Funding review",
    nodes: [
      {
        id: "node:funding-ai",
        type: "ai",
        name: "AI review",
        component_ref: "component:funding-model",
        purpose: "Highlight relevant evidence.",
        disclosure: "public",
      },
    ],
    edges: [],
  },
  components: [
    {
      id: "component:funding-model",
      kind: "model",
      name: "Review model",
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

describe("CRUX runtime instrumentation", () => {
  it("creates canonical metadata-only Run and Event records", () => {
    const session = createSession();
    session.record({
      type: "human_review",
      humanRoleRef: "role:funding-officer",
      summary: "A funding officer reviewed the original source.",
      occurredAt: "2026-09-15T15:01:00Z",
    });
    session.finish("completed", "2026-09-15T15:02:00Z");

    const snapshot = session.snapshot();
    expect(snapshot.run.capture_mode).toBe("metadata_only");
    expect(snapshot.run.status).toBe("completed");
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]?.sequence).toBe(1);
    expect(snapshot.events[0]?.id).toBe("event:run-pipeline-test-1");
  });

  it("maps AI SDK step metadata without copying generated content", () => {
    const session = createSession();
    const event = recordAISdkStep(
      session,
      {
        finishReason: "stop",
        usage: { inputTokens: 120, outputTokens: 42, totalTokens: 162 },
        response: { id: "response-123", model: "model-b" },
        toolCalls: [{ toolName: "lookupEligibility" }],
      },
      {
        componentRef: "component:funding-model",
        processNodeRef: "node:funding-ai",
      },
    );

    expect(event.type).toBe("ai_invocation");
    expect(event.attributes).toEqual({
      finish_reason: "stop",
      response_id: "response-123",
      response_model: "model-b",
      input_tokens: 120,
      output_tokens: 42,
      total_tokens: 162,
      tool_call_count: 1,
    });
    expect(JSON.stringify(event)).not.toContain("lookupEligibility");
  });

  it("maps OpenTelemetry GenAI metadata while ignoring prompt and output content", () => {
    const session = createSession();
    const event = recordOpenTelemetryGenAI(
      session,
      {
        occurredAt: "2026-09-15T15:01:00Z",
        attributes: {
          "gen_ai.operation.name": "chat",
          "gen_ai.provider.name": "provider-a",
          "gen_ai.request.model": "model-a",
          "gen_ai.response.model": "model-b",
          "gen_ai.response.id": "response-otel-1",
          "gen_ai.usage.input_tokens": 90,
          "gen_ai.usage.output_tokens": 30,
          "gen_ai.response.finish_reasons": ["stop"],
          "gen_ai.workflow.name": "funding-review",
          "gen_ai.input.messages": "PRIVATE APPLICATION TEXT",
          "gen_ai.output.messages": "PRIVATE MODEL OUTPUT",
        },
      },
      {
        componentRef: "component:funding-model",
        processNodeRef: "node:funding-ai",
      },
    );

    const serialized = JSON.stringify(event);
    expect(event.attributes.response_model).toBe("model-b");
    expect(event.attributes.workflow).toBe("funding-review");
    expect(serialized).not.toContain("PRIVATE APPLICATION TEXT");
    expect(serialized).not.toContain("PRIVATE MODEL OUTPUT");
  });

  it("surfaces declared versus observed fallback-model divergence without mutating truth", () => {
    const session = createSession();
    const event = recordOpenTelemetryGenAI(
      session,
      {
        attributes: {
          "gen_ai.operation.name": "chat",
          "gen_ai.provider.name": "provider-a",
          "gen_ai.request.model": "model-a",
          "gen_ai.response.model": "model-b",
        },
      },
      { componentRef: "component:funding-model" },
    );

    const comparison = compareDeclaredAndObservedModel(version, event);
    expect(comparison.comparable).toBe(true);
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
    expect(version.components[0]?.model_identifier).toEqual({ status: "known", value: "model-a" });
  });
});
