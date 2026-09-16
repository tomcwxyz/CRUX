import type { CruxInstrumentationSession } from "./session.js";

export type AISdkUsageLike = {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  totalTokens?: number | undefined;
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
};

export type AISdkStepObservation = {
  finishReason?: string | undefined;
  usage?: AISdkUsageLike | undefined;
  /**
   * Current AI SDK step metadata exposes the model that produced the step here.
   * Keeping this structural avoids a runtime dependency on `ai` in CRUX core.
   */
  model?: {
    provider?: string | undefined;
    modelId?: string | undefined;
  } | undefined;
  /**
   * Older/current response metadata may also expose an id and model. Retained
   * for compatibility with framework versions and provider adapters that do so.
   */
  response?: {
    id?: string | undefined;
    model?: string | undefined;
  } | undefined;
  toolCalls?: Array<{ toolName?: string | undefined }> | undefined;
};

export type AISdkStepRefs = {
  componentRef?: string;
  processNodeRef?: string;
  disclosure?: "public" | "affected_party" | "trusted" | "internal";
};

/**
 * Maps the metadata available from an AI SDK step callback into one bounded
 * CRUX ai_invocation event.
 *
 * This intentionally does not import the `ai` package and does not copy text,
 * reasoning, prompts, tool arguments, tool results or provider payloads. The
 * adapter stays isolated from AI SDK version churn while keeping CRUX's
 * canonical contract provider-neutral.
 */
export const recordAISdkStep = (
  session: CruxInstrumentationSession,
  observation: AISdkStepObservation,
  refs: AISdkStepRefs = {},
) => {
  const usage = observation.usage;
  const inputTokens = usage?.inputTokens ?? usage?.promptTokens;
  const outputTokens = usage?.outputTokens ?? usage?.completionTokens;
  const observedModel = observation.response?.model ?? observation.model?.modelId;

  return session.record({
    type: "ai_invocation",
    ...(refs.componentRef ? { componentRef: refs.componentRef } : {}),
    ...(refs.processNodeRef ? { processNodeRef: refs.processNodeRef } : {}),
    ...(refs.disclosure ? { disclosure: refs.disclosure } : {}),
    summary: "AI model invocation completed.",
    attributes: {
      ...(observation.finishReason ? { finish_reason: observation.finishReason } : {}),
      ...(observation.model?.provider ? { provider: observation.model.provider } : {}),
      ...(observation.model?.modelId ? { request_model: observation.model.modelId } : {}),
      ...(observation.response?.id ? { response_id: observation.response.id } : {}),
      ...(observedModel ? { response_model: observedModel } : {}),
      ...(inputTokens !== undefined ? { input_tokens: inputTokens } : {}),
      ...(outputTokens !== undefined ? { output_tokens: outputTokens } : {}),
      ...(usage?.totalTokens !== undefined ? { total_tokens: usage.totalTokens } : {}),
      ...(observation.toolCalls ? { tool_call_count: observation.toolCalls.length } : {}),
    },
  });
};

/**
 * Returns a callback that can be passed directly to AI SDK `onStepFinish`.
 * The callback accepts the SDK result structurally and records only the bounded
 * metadata CRUX needs; content-bearing fields remain ignored.
 */
export const createAISdkOnStepFinish = (
  session: CruxInstrumentationSession,
  refs: AISdkStepRefs = {},
) =>
  (observation: AISdkStepObservation) => {
    recordAISdkStep(session, observation, refs);
  };

export const recordAISdkError = (
  session: CruxInstrumentationSession,
  error: unknown,
  refs: AISdkStepRefs = {},
) =>
  session.record({
    type: "error",
    ...(refs.componentRef ? { componentRef: refs.componentRef } : {}),
    ...(refs.processNodeRef ? { processNodeRef: refs.processNodeRef } : {}),
    ...(refs.disclosure ? { disclosure: refs.disclosure } : {}),
    summary: "AI runtime reported an error.",
    attributes: {
      error_type: error instanceof Error ? error.name : typeof error,
    },
  });
