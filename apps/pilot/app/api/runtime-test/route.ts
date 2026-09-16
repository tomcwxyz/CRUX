import { generateText } from "ai";
import { compareDeclaredAndObservedModel } from "@crux/core/observed";
import {
  createAISdkOnStepFinish,
  createInstrumentationSession,
  proposeReceiptFromObservedRun,
  recordAISdkStep,
} from "@crux/instrumentation";
import { systemVersionSchema } from "@crux/schemas";

export const runtime = "nodejs";

const DEFAULT_PROMPT = "Reply with exactly CRUX_BROWSER_TEST_OK.";
const DEFAULT_MODEL = "anthropic/claude-3-haiku";
const DEFAULT_DECLARED_MODEL = "openai/gpt-5-mini";

type TestMode = "demo" | "live";
type TestScenario = "model" | "workflow" | "divergence";

type RequestBody = {
  mode?: TestMode;
  scenario?: TestScenario;
  prompt?: string;
  model?: string;
  declaredModel?: string;
};

const safeText = (value: unknown, fallback: string, max: number) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : fallback;

const makeDeclaredVersion = (
  declaredModel: string,
  declaredProvider: string,
  publishedAt: string,
) =>
  systemVersionSchema.parse({
    schema_version: "0.1",
    id: "system-version:browser-test:1.0",
    system_ref: "system:browser-test",
    version: "1.0",
    effective_from: publishedAt,
    process: {
      id: "process:browser-test",
      name: "Browser runtime test",
      nodes: [
        {
          id: "node:browser-test-model",
          type: "ai",
          name: "AI model call",
          component_ref: "component:browser-test-model",
          purpose: "Run a synthetic browser test without retaining source content.",
          disclosure: "internal",
        },
      ],
      edges: [],
    },
    components: [
      {
        id: "component:browser-test-model",
        kind: "model",
        name: "Declared browser test model",
        provider: { status: "known", value: declaredProvider },
        model_identifier: { status: "known", value: declaredModel },
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
    disclosure: "internal",
    external_refs: [],
    published_at: publishedAt,
  });

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const mode: TestMode = body.mode === "live" ? "live" : "demo";
  const scenario: TestScenario =
    body.scenario === "workflow" || body.scenario === "divergence"
      ? body.scenario
      : "model";
  const prompt = safeText(body.prompt, DEFAULT_PROMPT, 800);
  const model = safeText(body.model, process.env.CRUX_SMOKE_MODEL ?? DEFAULT_MODEL, 160);
  const declaredModel = safeText(body.declaredModel, DEFAULT_DECLARED_MODEL, 160);

  const runId = `run:browser-test:${Date.now()}`;
  const crux = createInstrumentationSession({
    runId,
    systemVersionRef: "system-version:browser-test:1.0",
  });

  try {
    let responseText: string;

    if (mode === "live") {
      const result = await generateText({
        model,
        prompt,
        maxOutputTokens: 40,
        onStepFinish: createAISdkOnStepFinish(crux, {
          componentRef: "component:browser-test-model",
          processNodeRef: "node:browser-test-model",
        }),
      });
      responseText = result.text;
    } else {
      responseText = "CRUX_BROWSER_DEMO_OK";
      recordAISdkStep(
        crux,
        {
          finishReason: "stop",
          usage: { inputTokens: 11, outputTokens: 4, totalTokens: 15 },
          model: {
            provider: "demo-provider",
            modelId: "demo-model-b",
          },
          response: {
            id: "demo-response-1",
            model: "demo-model-b",
          },
        },
        {
          componentRef: "component:browser-test-model",
          processNodeRef: "node:browser-test-model",
        },
      );
    }

    if (scenario === "workflow") {
      crux.record({
        type: "human_review",
        processNodeRef: "node:browser-human-review",
        humanRoleRef: "role:browser-reviewer",
        summary: "Synthetic reviewer checked the AI contribution before a decision.",
        attributes: { synthetic_test: true, review_before_effect: true },
      });
      crux.record({
        type: "decision",
        processNodeRef: "node:browser-decision",
        decisionRef: "decision:browser-routing",
        humanRoleRef: "role:browser-reviewer",
        summary: "Synthetic reviewer made the final test decision.",
        attributes: { synthetic_test: true, final_authority: "human" },
      });
      crux.record({
        type: "action_executed",
        processNodeRef: "node:browser-action",
        actionRef: "action:browser-route",
        summary: "Synthetic bounded action executed after the human decision.",
        attributes: { synthetic_test: true, reversible: true },
      });
    }

    crux.finish("completed");
    const snapshot = crux.snapshot();
    const invocation = snapshot.events.find((event) => event.type === "ai_invocation");

    const workflow =
      scenario === "workflow"
        ? proposeReceiptFromObservedRun(snapshot.run, snapshot.events)
        : undefined;

    const observedProvider =
      typeof invocation?.attributes.provider === "string"
        ? invocation.attributes.provider
        : mode === "live"
          ? "gateway"
          : "demo-provider";

    const comparison =
      scenario === "divergence" && invocation
        ? compareDeclaredAndObservedModel(
            makeDeclaredVersion(
              mode === "demo" && !body.declaredModel ? "demo-model-a" : declaredModel,
              observedProvider,
              snapshot.run.started_at,
            ),
            invocation,
          )
        : undefined;

    const serialised = JSON.stringify({ snapshot, workflow, comparison });

    return Response.json({
      ok: true,
      mode,
      scenario,
      runtimeModel: mode === "live" ? model : "demo-model-b",
      ...(scenario === "divergence"
        ? {
            declaredModel:
              mode === "demo" && !body.declaredModel ? "demo-model-a" : declaredModel,
          }
        : {}),
      responseText,
      crux: {
        run: snapshot.run,
        events: snapshot.events,
        observedProvider: invocation?.attributes.provider ?? null,
        observedRequestModel: invocation?.attributes.request_model ?? null,
        observedResponseModel: invocation?.attributes.response_model ?? null,
        inputTokens: invocation?.attributes.input_tokens ?? null,
        outputTokens: invocation?.attributes.output_tokens ?? null,
        promptCaptured: serialised.includes(prompt),
        responseCaptured:
          responseText.length > 0 ? serialised.includes(responseText) : false,
      },
      ...(workflow
        ? {
            workflow: {
              trace: workflow.trace,
              proposal: workflow.proposal,
            },
          }
        : {}),
      ...(comparison ? { comparison } : {}),
    });
  } catch (error) {
    crux.finish("failed");
    return Response.json(
      {
        ok: false,
        code: "runtime_test_failed",
        message: error instanceof Error ? error.message : "The runtime test failed.",
      },
      { status: 500 },
    );
  }
}
