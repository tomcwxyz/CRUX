import type {
  DisclosureLevel,
  Event,
  Receipt,
  Trace,
  TraceStep,
} from "@crux/schemas";

const disclosureRank: Record<DisclosureLevel, number> = {
  public: 0,
  affected_party: 1,
  trusted: 2,
  internal: 3,
};

const visibleAt = (level: DisclosureLevel, maximum: DisclosureLevel) =>
  disclosureRank[level] <= disclosureRank[maximum];

export type ProjectedTraceEvent = {
  id: string;
  sequence: number;
  occurred_at: string;
  type: Event["type"];
  summary?: string;
  relationship_to_previous: TraceStep["relationship_to_previous"];
  causal_context_incomplete: boolean;
};

export type ProjectedReceipt = Pick<
  Receipt,
  | "id"
  | "system_version_ref"
  | "occurred_at"
  | "ai_involvement"
  | "ai_summary"
  | "effect_of_ai"
  | "human_involvement"
  | "final_authority"
  | "outcome"
  | "challenge"
  | "source_content_included"
>;

export type TraceProjection = {
  trace_visible: boolean;
  trace_id?: string;
  system_version_ref?: string;
  summary?: string;
  events: ProjectedTraceEvent[];
  hidden_event_count: number;
  receipt?: ProjectedReceipt;
};

export const projectTraceForDisclosure = ({
  trace,
  events,
  receipt,
  maximumLevel,
}: {
  trace: Trace;
  events: Event[];
  receipt?: Receipt;
  maximumLevel: DisclosureLevel;
}): TraceProjection => {
  const receiptProjection =
    receipt && visibleAt(receipt.disclosure, maximumLevel)
      ? {
          id: receipt.id,
          system_version_ref: receipt.system_version_ref,
          occurred_at: receipt.occurred_at,
          ai_involvement: receipt.ai_involvement,
          ai_summary: receipt.ai_summary,
          effect_of_ai: receipt.effect_of_ai,
          ...(receipt.human_involvement
            ? { human_involvement: receipt.human_involvement }
            : {}),
          final_authority: receipt.final_authority,
          outcome: receipt.outcome,
          ...(receipt.challenge ? { challenge: receipt.challenge } : {}),
          source_content_included: receipt.source_content_included,
        }
      : undefined;

  if (!visibleAt(trace.disclosure, maximumLevel)) {
    return {
      trace_visible: false,
      events: [],
      hidden_event_count: trace.steps.length,
      ...(receiptProjection ? { receipt: receiptProjection } : {}),
    };
  }

  const eventById = new Map(events.map((event) => [event.id, event]));
  const projected: ProjectedTraceEvent[] = [];
  let hidden = 0;
  let lastVisibleCanonicalIndex: number | undefined;

  for (const [index, step] of trace.steps.entries()) {
    const event = eventById.get(step.event_ref);
    if (!event || !visibleAt(event.disclosure, maximumLevel)) {
      hidden += 1;
      continue;
    }

    const gapBefore =
      index > 0 &&
      (lastVisibleCanonicalIndex === undefined || lastVisibleCanonicalIndex !== index - 1);

    projected.push({
      id: event.id,
      sequence: event.sequence,
      occurred_at: event.occurred_at,
      type: event.type,
      ...(event.summary ? { summary: event.summary } : {}),
      relationship_to_previous:
        projected.length === 0 ? "starts" : step.relationship_to_previous,
      causal_context_incomplete: projected.length === 0 ? index > 0 : gapBefore,
    });

    lastVisibleCanonicalIndex = index;
  }

  return {
    trace_visible: true,
    trace_id: trace.id,
    system_version_ref: trace.system_version_ref,
    ...(trace.summary ? { summary: trace.summary } : {}),
    events: projected,
    hidden_event_count: hidden,
    ...(receiptProjection ? { receipt: receiptProjection } : {}),
  };
};
