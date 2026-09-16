import { z } from "zod";
import {
  evidenceEnvelopeSchema,
  eventSchema,
  observationSchema,
  runSchema,
  systemVersionIdSchema,
  timestampSchema,
  type Event,
  type Observation,
  type Run,
} from "@crux/schemas";
import {
  importEvidenceEnvelope,
  parsePortableBundle,
  validateBundleReferences,
  type CruxPortableBundle,
} from "@crux/formats";

export const producerIdentitySchema = z
  .object({
    id: z.string().min(1).max(160),
    kind: z.enum(["application", "ci", "evaluation", "otel_bridge", "manual", "other"]),
    name: z.string().min(1).max(240).optional(),
    version: z.string().min(1).max(120).optional(),
    external_ref: z.url().optional(),
  })
  .strict();

export const cruxIngestBatchSchema = z
  .object({
    format: z.literal("crux-ingest/0.1"),
    request_id: z.string().min(1).max(200),
    producer: producerIdentitySchema,
    received_at: timestampSchema.optional(),
    system_version_ref: systemVersionIdSchema.optional(),
    runs: z.array(runSchema).default([]),
    events: z.array(eventSchema).default([]),
    observations: z.array(observationSchema).default([]),
    evidence_envelopes: z.array(evidenceEnvelopeSchema).default([]),
  })
  .strict()
  .superRefine((batch, context) => {
    const hasRuntimeRecords =
      batch.runs.length > 0 || batch.events.length > 0 || batch.observations.length > 0;
    if (hasRuntimeRecords && !batch.system_version_ref) {
      context.addIssue({
        code: "custom",
        path: ["system_version_ref"],
        message: "Runtime ingestion requires an exact system_version_ref.",
      });
    }
  });

export type ProducerIdentity = z.infer<typeof producerIdentitySchema>;
export type CruxIngestBatch = z.infer<typeof cruxIngestBatchSchema>;

export type IngestRecordKind = "run" | "event" | "observation" | "evidence";
export type IngestRecordStatus = "accepted" | "already_present";

export type IngestAcceptance = {
  record_kind: IngestRecordKind;
  record_id: string;
  status: IngestRecordStatus;
  producer_ref: string;
  request_id: string;
  accepted_at: string;
};

export type IngestResult = {
  bundle: CruxPortableBundle;
  producer: ProducerIdentity;
  request_id: string;
  accepted_at: string;
  acceptances: IngestAcceptance[];
};

export type IngestOptions = {
  maxPayloadBytes?: number;
  maxRecords?: number;
  allowNonMetadataCapture?: boolean;
  allowFreeTextRuntimeFields?: boolean;
  additionalEventAttributeKeys?: string[];
  now?: string;
};

const DEFAULT_MAX_PAYLOAD_BYTES = 512_000;
const DEFAULT_MAX_RECORDS = 500;

const DEFAULT_EVENT_ATTRIBUTE_KEYS = new Set([
  "finish_reason",
  "provider",
  "request_model",
  "response_model",
  "response_id",
  "input_tokens",
  "output_tokens",
  "total_tokens",
  "tool_call_count",
  "operation",
  "workflow",
]);

const stableJson = (value: unknown) => JSON.stringify(value);
const sameRecord = (left: unknown, right: unknown) => stableJson(left) === stableJson(right);

const payloadBytes = (input: unknown) => {
  try {
    return new TextEncoder().encode(JSON.stringify(input)).byteLength;
  } catch {
    throw new Error("CRUX ingestion payload must be JSON serialisable.");
  }
};

const laterTimestamp = (left: string, right: string) =>
  Date.parse(right) > Date.parse(left) ? right : left;

const assertValidBundle = (bundle: CruxPortableBundle, prefix: string) => {
  const validation = validateBundleReferences(bundle);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `${prefix}${first ? `: ${first.path}: ${first.message}` : "."}`,
    );
  }
};

const assertRuntimePolicy = (
  run: Run,
  options: Required<Pick<IngestOptions, "allowNonMetadataCapture" | "allowFreeTextRuntimeFields">>,
) => {
  if (!options.allowNonMetadataCapture && run.capture_mode !== "metadata_only") {
    throw new Error(
      `Run ${run.id} uses capture mode ${run.capture_mode}; the default CRUX HTTP boundary accepts metadata_only runs only.`,
    );
  }
  if (!options.allowFreeTextRuntimeFields && run.subject_ref !== undefined) {
    throw new Error(
      `Run ${run.id} includes subject_ref; free-text/subject runtime fields are disabled on the default CRUX HTTP boundary.`,
    );
  }
};

const assertEventPolicy = (
  event: Event,
  allowedAttributeKeys: Set<string>,
  allowFreeTextRuntimeFields: boolean,
) => {
  if (!allowFreeTextRuntimeFields && event.summary !== undefined) {
    throw new Error(
      `Event ${event.id} includes summary; free-text runtime fields are disabled on the default CRUX HTTP boundary.`,
    );
  }

  const unexpected = Object.keys(event.attributes).filter((key) => !allowedAttributeKeys.has(key));
  if (unexpected.length > 0) {
    throw new Error(
      `Event ${event.id} contains runtime attribute keys that are not allow-listed: ${unexpected.join(", ")}.`,
    );
  }

  for (const [key, value] of Object.entries(event.attributes)) {
    if (typeof value === "string" && value.length > 240) {
      throw new Error(
        `Event ${event.id} attribute ${key} exceeds the 240-character metadata boundary.`,
      );
    }
  }
};

const acceptance = (
  kind: IngestRecordKind,
  id: string,
  status: IngestRecordStatus,
  batch: CruxIngestBatch,
  acceptedAt: string,
): IngestAcceptance => ({
  record_kind: kind,
  record_id: id,
  status,
  producer_ref: batch.producer.id,
  request_id: batch.request_id,
  accepted_at: acceptedAt,
});

/**
 * Applies a bounded semantic ingestion batch to a canonical CRUX bundle.
 *
 * This function is intentionally pure and storage-free. A future HTTP service
 * can persist the returned bundle and acceptance ledger transactionally without
 * changing the public transport contract.
 *
 * Runtime ingestion defaults to metadata-only. Free-text event summaries,
 * subject references, content capture and unknown runtime attribute keys are
 * rejected unless a caller explicitly opts into a broader policy.
 */
export const ingestCruxBatch = (
  bundleInput: unknown,
  batchInput: unknown,
  options: IngestOptions = {},
): IngestResult => {
  const maxPayloadBytes = options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
  const maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS;
  const allowNonMetadataCapture = options.allowNonMetadataCapture ?? false;
  const allowFreeTextRuntimeFields = options.allowFreeTextRuntimeFields ?? false;
  const acceptedAt = timestampSchema.parse(options.now ?? new Date().toISOString());

  const size = payloadBytes(batchInput);
  if (size > maxPayloadBytes) {
    throw new Error(
      `CRUX ingestion payload is ${size} bytes; maximum accepted size is ${maxPayloadBytes} bytes.`,
    );
  }

  const bundle = parsePortableBundle(bundleInput);
  assertValidBundle(bundle, "Cannot ingest into an invalid CRUX bundle");
  const batch = cruxIngestBatchSchema.parse(batchInput);

  const recordCount =
    batch.runs.length +
    batch.events.length +
    batch.observations.length +
    batch.evidence_envelopes.length;
  if (recordCount > maxRecords) {
    throw new Error(
      `CRUX ingestion batch contains ${recordCount} records; maximum accepted count is ${maxRecords}.`,
    );
  }

  if (
    batch.system_version_ref &&
    !bundle.system_versions.some((version) => version.id === batch.system_version_ref)
  ) {
    throw new Error(
      `Ingestion batch targets missing system version ${batch.system_version_ref}.`,
    );
  }

  const allowedAttributeKeys = new Set([
    ...DEFAULT_EVENT_ATTRIBUTE_KEYS,
    ...(options.additionalEventAttributeKeys ?? []),
  ]);
  const acceptances: IngestAcceptance[] = [];

  let working = structuredClone(bundle);

  for (const run of batch.runs) {
    if (run.system_version_ref !== batch.system_version_ref) {
      throw new Error(
        `Run ${run.id} targets ${run.system_version_ref}, but the batch targets ${batch.system_version_ref}.`,
      );
    }
    assertRuntimePolicy(run, { allowNonMetadataCapture, allowFreeTextRuntimeFields });

    const existing = working.runs.find((item) => item.id === run.id);
    if (existing) {
      if (!sameRecord(existing, run)) {
        throw new Error(`Run ID conflict for ${run.id}: a different run already exists.`);
      }
      acceptances.push(acceptance("run", run.id, "already_present", batch, acceptedAt));
      continue;
    }

    working.runs.push(run);
    acceptances.push(acceptance("run", run.id, "accepted", batch, acceptedAt));
  }

  for (const event of batch.events) {
    assertEventPolicy(event, allowedAttributeKeys, allowFreeTextRuntimeFields);

    const run = working.runs.find((item) => item.id === event.run_ref);
    if (!run) {
      throw new Error(`Event ${event.id} references missing run ${event.run_ref}.`);
    }
    if (run.system_version_ref !== batch.system_version_ref) {
      throw new Error(
        `Event ${event.id} belongs to run ${run.id} for ${run.system_version_ref}, but the batch targets ${batch.system_version_ref}.`,
      );
    }

    const existing = working.events.find((item) => item.id === event.id);
    if (existing) {
      if (!sameRecord(existing, event)) {
        throw new Error(`Event ID conflict for ${event.id}: a different event already exists.`);
      }
      acceptances.push(acceptance("event", event.id, "already_present", batch, acceptedAt));
      continue;
    }

    const sequenceCollision = working.events.find(
      (item) => item.run_ref === event.run_ref && item.sequence === event.sequence,
    );
    if (sequenceCollision) {
      throw new Error(
        `Event sequence conflict for run ${event.run_ref}: sequence ${event.sequence} is already used by ${sequenceCollision.id}.`,
      );
    }

    working.events.push(event);
    acceptances.push(acceptance("event", event.id, "accepted", batch, acceptedAt));
  }

  for (const observation of batch.observations) {
    if (observation.system_version_ref !== batch.system_version_ref) {
      throw new Error(
        `Observation ${observation.id} targets ${observation.system_version_ref}, but the batch targets ${batch.system_version_ref}.`,
      );
    }

    const existing = working.observations.find((item) => item.id === observation.id);
    if (existing) {
      if (!sameRecord(existing, observation)) {
        throw new Error(
          `Observation ID conflict for ${observation.id}: a different observation already exists.`,
        );
      }
      acceptances.push(
        acceptance("observation", observation.id, "already_present", batch, acceptedAt),
      );
      continue;
    }

    working.observations.push(observation);
    acceptances.push(acceptance("observation", observation.id, "accepted", batch, acceptedAt));
  }

  working.generated_at = laterTimestamp(working.generated_at, acceptedAt);
  working = parsePortableBundle(working);
  assertValidBundle(working, "Runtime ingestion would make the CRUX bundle invalid");

  for (const envelope of batch.evidence_envelopes) {
    const result = importEvidenceEnvelope(working, envelope);
    working = result.bundle;
    acceptances.push(
      acceptance("evidence", result.evidence.id, result.status === "imported" ? "accepted" : "already_present", batch, acceptedAt),
    );
  }

  working.generated_at = laterTimestamp(working.generated_at, acceptedAt);
  working = parsePortableBundle(working);
  assertValidBundle(working, "Ingestion would make the CRUX bundle invalid");

  return {
    bundle: working,
    producer: batch.producer,
    request_id: batch.request_id,
    accepted_at: acceptedAt,
    acceptances,
  };
};

export const createMetadataOnlyRuntimeBatch = (input: {
  requestId: string;
  producer: ProducerIdentity;
  systemVersionRef: string;
  runs: Run[];
  events: Event[];
  observations?: Observation[];
  receivedAt?: string;
}): CruxIngestBatch =>
  cruxIngestBatchSchema.parse({
    format: "crux-ingest/0.1",
    request_id: input.requestId,
    producer: input.producer,
    ...(input.receivedAt ? { received_at: input.receivedAt } : {}),
    system_version_ref: input.systemVersionRef,
    runs: input.runs.map((run) => ({ ...run, subject_ref: undefined })),
    events: input.events.map(({ summary: _summary, ...event }) => event),
    observations: input.observations ?? [],
    evidence_envelopes: [],
  });
