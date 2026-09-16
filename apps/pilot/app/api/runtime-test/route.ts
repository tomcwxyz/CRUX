import { generateText } from "ai";
import {
  createAISdkOnStepFinish,
  createInstrumentationSession,
  recordAISdkStep,
} from "@crux/instrumentation";

export const runtime = "nodejs";

const DEFAULT_PROMPT = "Reply with exactly CRUX_BROWSER_TEST_OK.";
const DEFAULT_MODEL = "anthropic/claude-3-haiku";

type TestMode = "demo" | "live";

type RequestBody = {
  mode?: TestMode;
  prompt?: string;
  model?: string;
};

const safeText = (value: unknown, fallback: string, max: number) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : fallback;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const mode: TestMode = body.mode === "live" ? "live" : "demo";
  const prompt = safeText(body.prompt, DEFAULT_PROMPT, 800);
  const model = safeText(body.model, process.env.CRUX_SMOKE_MODEL ?? DEFAULT_MODEL, 160);

  const runId = `run:browser-test:${Date.now()}`;
  const crux = createInstrumentationSession({
    runId,
    systemVersionRef: "system-version:browser-test:1.0",
  });

  try {
    let responseText: string;

    if (mode === "live") {
      // On Vercel, AI SDK model strings route through AI Gateway and use the
      // deployment's managed authentication where available. Do not gate this
      // on process.env: let the Gateway return the real authentication/runtime
      // error so the browser test reflects the deployed environment accurately.
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

    crux.finish("completed");
    const snapshot = crux.snapshot();
    const serialised = JSON.stringify(snapshot);
    const invocation = snapshot.events.find((event) => event.type === "ai_invocation");

    return Response.json({
      ok: true,
      mode,
      requestedModel: mode === "live" ? model : "demo-model-a",
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
