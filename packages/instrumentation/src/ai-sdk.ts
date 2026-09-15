import type { CruxInstrumentationSession } from "./session.js";

export type AISdkUsageLike = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
};

export type AISdkStepObservation = {
  finishReason?: string;
  usage?: AISdkUsageLike;
  response?: {
    id?: string;
    model?: string;
  };
  toolCalls?: Array<{ toolName?: string }>;
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

  return session.record({
    type: "ai_invocation",
    ...(refs.componentRef ? { componentRef: refs.componentRef } : {}),
    ...(refs.processNodeRef ? { processNodeRef: refs.processNodeRef } : {}),
    ...(refs.disclosure ? { disclosure: refs.disclosure } : {}),
    summary: "AI model invocation completed.",
    attributes: {
      ...(observation.finishReason ? { finish_reason: observation.finishReason } : {}),
      ...(observation.response?.id ? { response_id: observation.response.id } : {}),
      ...(observation.response?.model ? { response_model: observation.response.model } : {}),
      ...(inputTokens !== undefined ? { input_tokens: inputTokens } : {}),
      ...(outputTokens !== undefined ? { output_tokens: outputTokens } : {}),
      ...(usage?.totalTokens !== undefined ? { total_tokens: usage.totalTokens } : {}),
      ...(observation.toolCalls ? { tool_call_count: observation.toolCalls.length } : {}),
    },
  });
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
