import assert from "node:assert/strict";
import { generateText } from "ai";
import {
  createAISdkOnStepFinish,
  createInstrumentationSession,
} from "../dist/index.js";

const hasGatewayAuth = Boolean(
  process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN,
);

if (!hasGatewayAuth) {
  console.log(
    "CRUX external-provider smoke skipped: set AI_GATEWAY_API_KEY (or VERCEL_OIDC_TOKEN) to run it.",
  );
  process.exit(0);
}

const model = process.env.CRUX_SMOKE_MODEL ?? "anthropic/claude-3-haiku";
const privatePrompt = "PRIVATE CRUX SMOKE CONTENT. Reply with exactly CRUX_SMOKE_OK.";

const crux = createInstrumentationSession({
  runId: `run:gateway-smoke:${Date.now()}`,
  systemVersionRef: "system-version:gateway-smoke:1.0",
});

const result = await generateText({
  model,
  prompt: privatePrompt,
  maxOutputTokens: 16,
  onStepFinish: createAISdkOnStepFinish(crux, {
    componentRef: "component:gateway-smoke-model",
    processNodeRef: "node:gateway-smoke-model",
  }),
});

crux.finish("completed");
const snapshot = crux.snapshot();
const serialised = JSON.stringify(snapshot);

assert.ok(snapshot.events.length >= 1, "Expected at least one CRUX runtime event.");
assert.ok(
  snapshot.events.some((event) => event.type === "ai_invocation"),
  "Expected an ai_invocation CRUX event.",
);
assert.equal(
  serialised.includes(privatePrompt),
  false,
  "Prompt content must not enter the CRUX snapshot.",
);
assert.equal(
  serialised.includes(result.text),
  false,
  "Generated content must not enter the CRUX snapshot.",
);

const invocation = snapshot.events.find((event) => event.type === "ai_invocation");

console.log("CRUX external-provider smoke passed.");
console.log(JSON.stringify({
  requestedModel: model,
  eventType: invocation?.type,
  observedProvider: invocation?.attributes.provider ?? null,
  observedRequestModel: invocation?.attributes.request_model ?? null,
  observedResponseModel: invocation?.attributes.response_model ?? null,
  inputTokens: invocation?.attributes.input_tokens ?? null,
  outputTokens: invocation?.attributes.output_tokens ?? null,
  contentCaptured: false,
}, null, 2));
