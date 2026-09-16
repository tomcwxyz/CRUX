import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import {
  compareDeclaredAndObservedModel,
  createAISdkOnStepFinish,
  createInstrumentationSession,
} from "../src/index.js";
import type { SystemVersion } from "@crux/schemas";

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: 4,
    text: 4,
    reasoning: undefined,
  },
};

const declaredVersion = {
  schema_version: "0.1",
  id: "system-version:eligibility:1.0",
  system_ref: "system:eligibility",
  version: "1.0",
  effective_from: "2026-09-16T00:00:00Z",
  process: {
    id: "process:eligibility",
    name: "Eligibility review",
    nodes: [
      {
        id: "node:eligibility-ai",
        type: "ai",
        name: "AI evidence extraction",
        component_ref: "component:eligibility-model",
        purpose: "Extract evidence for a human reviewer.",
        disclosure: "public",
      },
    ],
    edges: [],
  },
  components: [
    {
      id: "component:eligibility-model",
      kind: "model",
      name: "Eligibility model",
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

describe("AI SDK integration", () => {
  it("records the actual AI SDK step lifecycle without copying prompt or generated content", async () => {
    const session = createInstrumentationSession({
      runId: "run:ai-sdk-integration",
      systemVersionRef: declaredVersion.id,
      startedAt: "2026-09-16T08:00:00Z",
    });

    const privatePrompt = "PRIVATE: applicant has a sensitive circumstance";
    const privateOutput = "PRIVATE: extracted sensitive circumstance";

    const model = new MockLanguageModelV4({
      provider: "provider-b",
      modelId: "model-b",
      doGenerate: async () => ({
        content: [{ type: "text", text: privateOutput }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      }),
    });

    await generateText({
      model,
      prompt: privatePrompt,
      onStepFinish: createAISdkOnStepFinish(session, {
        componentRef: "component:eligibility-model",
        processNodeRef: "node:eligibility-ai",
      }),
    });

    session.finish("completed", "2026-09-16T08:00:01Z");
    const snapshot = session.snapshot();

    expect(snapshot.events).toHaveLength(1);
    const event = snapshot.events[0]!;
    expect(event.type).toBe("ai_invocation");
    expect(event.attributes.provider).toBe("provider-b");
    expect(event.attributes.request_model).toBe("model-b");
    expect(event.attributes.response_model).toBe("model-b");
    expect(event.attributes.input_tokens).toBe(10);
    expect(event.attributes.output_tokens).toBe(4);
    expect(event.attributes.total_tokens).toBe(14);

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain(privatePrompt);
    expect(serialized).not.toContain(privateOutput);

    const comparison = compareDeclaredAndObservedModel(declaredVersion, event);
    expect(comparison.fields).toEqual([
      {
        field: "provider",
        declared: "provider-a",
        observed: "provider-b",
        status: "divergence",
      },
      {
        field: "model_identifier",
        declared: "model-a",
        observed: "model-b",
        status: "divergence",
      },
    ]);
  });
});
