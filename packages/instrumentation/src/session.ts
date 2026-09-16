import {
  eventSchema,
  runSchema,
  type DisclosureLevel,
  type Event,
  type EventType,
  type Run,
  type RunStatus,
  type CaptureMode,
} from "@crux/schemas";

export type InstrumentationAttributes = Event["attributes"];

export type InstrumentationEventInput = {
  type: EventType;
  occurredAt?: string;
  processNodeRef?: string;
  componentRef?: string;
  decisionRef?: string;
  actionRef?: string;
  humanRoleRef?: string;
  summary?: string;
  attributes?: InstrumentationAttributes;
  disclosure?: DisclosureLevel;
};

export type InstrumentationSessionOptions = {
  runId: string;
  systemVersionRef: string;
  startedAt?: string;
  disclosure?: DisclosureLevel;
  captureMode?: CaptureMode;
};

export type InstrumentationSnapshot = {
  run: Run;
  events: Event[];
};

const nowIso = () => new Date().toISOString();

const eventIdFor = (runId: string, sequence: number) => {
  const segment = runId.replace(/:/g, "-").replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
  return `event:${segment}-${sequence}`;
};

/**
 * A small in-process collector for bounded CRUX runtime provenance.
 *
 * It produces canonical Run/Event records but deliberately has no transport,
 * persistence, model-provider or application dependency. HTTP, OTLP and other
 * exporters can be layered on top later without changing the core contract.
 */
export class CruxInstrumentationSession {
  private run: Run;
  private events: Event[] = [];
  private finished = false;

  constructor(options: InstrumentationSessionOptions) {
    const startedAt = options.startedAt ?? nowIso();
    this.run = runSchema.parse({
      schema_version: "0.1",
      id: options.runId,
      system_version_ref: options.systemVersionRef,
      started_at: startedAt,
      status: "started",
      capture_mode: options.captureMode ?? "metadata_only",
      disclosure: options.disclosure ?? "internal",
      external_refs: [],
    });
  }

  record(input: InstrumentationEventInput): Event {
    if (this.finished) throw new Error("Cannot record an event after the CRUX run has finished.");

    const sequence = this.events.length + 1;
    const event = eventSchema.parse({
      schema_version: "0.1",
      id: eventIdFor(this.run.id, sequence),
      run_ref: this.run.id,
      sequence,
      occurred_at: input.occurredAt ?? nowIso(),
      type: input.type,
      ...(input.processNodeRef ? { process_node_ref: input.processNodeRef } : {}),
      ...(input.componentRef ? { component_ref: input.componentRef } : {}),
      ...(input.decisionRef ? { decision_ref: input.decisionRef } : {}),
      ...(input.actionRef ? { action_ref: input.actionRef } : {}),
      ...(input.humanRoleRef ? { human_role_ref: input.humanRoleRef } : {}),
      ...(input.summary ? { summary: input.summary } : {}),
      attributes: input.attributes ?? {},
      disclosure: input.disclosure ?? this.run.disclosure,
    });

    this.events.push(event);
    return structuredClone(event);
  }

  finish(status: Exclude<RunStatus, "started"> = "completed", completedAt = nowIso()): Run {
    if (this.finished) return structuredClone(this.run);

    this.run = runSchema.parse({
      ...this.run,
      status,
      completed_at: completedAt,
    });
    this.finished = true;
    return structuredClone(this.run);
  }

  snapshot(): InstrumentationSnapshot {
    return {
      run: structuredClone(this.run),
      events: structuredClone(this.events),
    };
  }
}

export const createInstrumentationSession = (options: InstrumentationSessionOptions) =>
  new CruxInstrumentationSession(options);
