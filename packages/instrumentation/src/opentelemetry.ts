import type { CruxInstrumentationSession } from "./session.js";

export type OpenTelemetryAttributeValue = string | number | boolean | string[] | number[] | boolean[] | undefined;

export type OpenTelemetryGenAISpanLike = {
  name?: string;
  occurredAt?: string;
  attributes: Record<string, OpenTelemetryAttributeValue>;
};

export type OpenTelemetryRefs = {
  componentRef?: string;
  processNodeRef?: string;
  actionRef?: string;
  disclosure?: "public" | "affected_party" | "trusted" | "internal";
};

const scalar = (value: OpenTelemetryAttributeValue): string | number | boolean | undefined =>
  Array.isArray(value) ? undefined : value;

const firstString = (value: OpenTelemetryAttributeValue): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? first : undefined;
  }
  return undefined;
};

/**
 * Maps a metadata-only OpenTelemetry GenAI span into a bounded CRUX event.
 *
 * Only a small allow-list of semantic-convention attributes is copied. Content
 * attributes such as gen_ai.input.messages and gen_ai.output.messages are
 * deliberately ignored even if they are present on the source span.
 */
export const recordOpenTelemetryGenAI = (
  session: CruxInstrumentationSession,
  span: OpenTelemetryGenAISpanLike,
  refs: OpenTelemetryRefs = {},
) => {
  const attributes = span.attributes;
  const operation = firstString(attributes["gen_ai.operation.name"]);
  const isToolExecution = operation === "execute_tool";
  const eventType = isToolExecution && refs.actionRef ? "action_executed" : isToolExecution ? "transformation" : "ai_invocation";

  return session.record({
    type: eventType,
    ...(span.occurredAt ? { occurredAt: span.occurredAt } : {}),
    ...(refs.componentRef ? { componentRef: refs.componentRef } : {}),
    ...(refs.processNodeRef ? { processNodeRef: refs.processNodeRef } : {}),
    ...(refs.actionRef ? { actionRef: refs.actionRef } : {}),
    ...(refs.disclosure ? { disclosure: refs.disclosure } : {}),
    summary: isToolExecution ? "Observed GenAI tool execution." : "Observed GenAI model operation.",
    attributes: {
      ...(operation ? { operation } : {}),
      ...(scalar(attributes["gen_ai.provider.name"]) !== undefined
        ? { provider: scalar(attributes["gen_ai.provider.name"]) as string | number | boolean }
        : {}),
      ...(scalar(attributes["gen_ai.request.model"]) !== undefined
        ? { request_model: scalar(attributes["gen_ai.request.model"]) as string | number | boolean }
        : {}),
      ...(scalar(attributes["gen_ai.response.model"]) !== undefined
        ? { response_model: scalar(attributes["gen_ai.response.model"]) as string | number | boolean }
        : {}),
      ...(scalar(attributes["gen_ai.response.id"]) !== undefined
        ? { response_id: scalar(attributes["gen_ai.response.id"]) as string | number | boolean }
        : {}),
      ...(scalar(attributes["gen_ai.usage.input_tokens"]) !== undefined
        ? { input_tokens: scalar(attributes["gen_ai.usage.input_tokens"]) as string | number | boolean }
        : {}),
      ...(scalar(attributes["gen_ai.usage.output_tokens"]) !== undefined
        ? { output_tokens: scalar(attributes["gen_ai.usage.output_tokens"]) as string | number | boolean }
        : {}),
      ...(firstString(attributes["gen_ai.response.finish_reasons"])
        ? { finish_reason: firstString(attributes["gen_ai.response.finish_reasons"])! }
        : {}),
      ...(scalar(attributes["gen_ai.workflow.name"]) !== undefined
        ? { workflow: scalar(attributes["gen_ai.workflow.name"]) as string | number | boolean }
        : {}),
    },
  });
};
