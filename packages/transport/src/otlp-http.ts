import {
  createInstrumentationSession,
  recordOpenTelemetryGenAI,
  type OpenTelemetryAttributeValue,
  type OpenTelemetryRefs,
} from "@crux/instrumentation";
import {
  createMetadataOnlyRuntimeBatch,
  type CruxIngestBatch,
  type ProducerIdentity,
} from "./ingest.js";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const scalarAnyValue = (value: unknown): string | number | boolean | undefined => {
  if (!isRecord(value)) return undefined;
  if (typeof value.stringValue === "string") return value.stringValue;
  if (typeof value.boolValue === "boolean") return value.boolValue;
  if (typeof value.doubleValue === "number") return value.doubleValue;
  if (typeof value.doubleValue === "string" && value.doubleValue.trim()) {
    const parsed = Number(value.doubleValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value.intValue === "number") return value.intValue;
  if (typeof value.intValue === "string" && value.intValue.trim()) {
    const parsed = Number(value.intValue);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }
  return undefined;
};

const anyValue = (value: unknown): OpenTelemetryAttributeValue => {
  const scalar = scalarAnyValue(value);
  if (scalar !== undefined) return scalar;
  if (!isRecord(value) || !isRecord(value.arrayValue)) return undefined;

  const values = asArray(value.arrayValue.values)
    .map((item) => scalarAnyValue(item))
    .filter((item): item is string | number | boolean => item !== undefined);

  if (values.length === 0) return undefined;
  if (values.every((item) => typeof item === "string")) return values as string[];
  if (values.every((item) => typeof item === "number")) return values as number[];
  if (values.every((item) => typeof item === "boolean")) return values as boolean[];
  return undefined;
};

const attributesFromOtlp = (input: unknown): Record<string, OpenTelemetryAttributeValue> => {
  const output: Record<string, OpenTelemetryAttributeValue> = {};
  for (const attribute of asArray(input)) {
    if (!isRecord(attribute) || typeof attribute.key !== "string" || !attribute.key) continue;
    const value = anyValue(attribute.value);
    if (value !== undefined) output[attribute.key] = value;
  }
  return output;
};

const unixNanoToIso = (value: unknown): string | undefined => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  try {
    const nanos = BigInt(value);
    return new Date(Number(nanos / 1_000_000n)).toISOString();
  } catch {
    return undefined;
  }
};

const extractSpans = (payload: unknown) => {
  if (!isRecord(payload)) throw new Error("OTLP/HTTP JSON payload must be an object.");

  const spans: Array<{
    name?: string;
    occurredAt?: string;
    attributes: Record<string, OpenTelemetryAttributeValue>;
  }> = [];

  for (const resourceSpan of asArray(payload.resourceSpans)) {
    if (!isRecord(resourceSpan)) continue;
    for (const scopeSpan of asArray(resourceSpan.scopeSpans)) {
      if (!isRecord(scopeSpan)) continue;
      for (const span of asArray(scopeSpan.spans)) {
        if (!isRecord(span)) continue;
        const attributes = attributesFromOtlp(span.attributes);
        if (!Object.keys(attributes).some((key) => key.startsWith("gen_ai."))) continue;
        spans.push({
          ...(typeof span.name === "string" ? { name: span.name } : {}),
          ...(unixNanoToIso(span.startTimeUnixNano)
            ? { occurredAt: unixNanoToIso(span.startTimeUnixNano)! }
            : {}),
          attributes,
        });
      }
    }
  }

  return spans;
};

export type OtlpHttpBridgeInput = {
  requestId: string;
  runId: string;
  systemVersionRef: string;
  producer?: ProducerIdentity;
  refs?: OpenTelemetryRefs;
  receivedAt?: string;
  maxSpans?: number;
};

/**
 * Translates OTLP/HTTP JSON trace payloads through the existing bounded
 * OpenTelemetry GenAI mapper, then emits the same `crux-ingest/0.1` batch used
 * by direct semantic producers.
 *
 * This is intentionally a bridge, not an OTLP backend. Only spans containing
 * GenAI semantic-convention attributes are considered, and the downstream
 * mapper copies only its metadata allow-list. Message/prompt/output attributes
 * may be present in the OTLP source but never enter the CRUX batch by default.
 */
export const otlpHttpJsonToCruxBatch = (
  payload: unknown,
  input: OtlpHttpBridgeInput,
): CruxIngestBatch => {
  const spans = extractSpans(payload);
  const maxSpans = input.maxSpans ?? 250;
  if (spans.length === 0) {
    throw new Error("OTLP/HTTP JSON payload contains no GenAI spans CRUX can map.");
  }
  if (spans.length > maxSpans) {
    throw new Error(
      `OTLP/HTTP JSON payload contains ${spans.length} GenAI spans; bridge limit is ${maxSpans}.`,
    );
  }

  const session = createInstrumentationSession({
    runId: input.runId,
    systemVersionRef: input.systemVersionRef,
    ...(spans[0]?.occurredAt ? { startedAt: spans[0].occurredAt } : {}),
  });

  for (const span of spans) {
    recordOpenTelemetryGenAI(session, span, input.refs ?? {});
  }
  session.finish("completed", spans.at(-1)?.occurredAt ?? new Date().toISOString());

  const snapshot = session.snapshot();
  return createMetadataOnlyRuntimeBatch({
    requestId: input.requestId,
    producer:
      input.producer ??
      ({
        id: "producer:crux-otlp-http-bridge",
        kind: "otel_bridge",
        name: "CRUX OTLP/HTTP bridge",
        version: "0.1",
      } satisfies ProducerIdentity),
    systemVersionRef: input.systemVersionRef,
    runs: [snapshot.run],
    events: snapshot.events,
    ...(input.receivedAt ? { receivedAt: input.receivedAt } : {}),
  });
};
