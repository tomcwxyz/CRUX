import {
  traceSchema,
  type Event,
  type EventType,
  type Run,
  type Trace,
} from "@crux/schemas";

export const receiptProposalFormat = "crux-receipt-proposal/0.1" as const;

export type ReceiptProposalQuestionField =
  | "ai_involvement"
  | "effect_of_ai"
  | "human_involvement"
  | "final_authority"
  | "outcome"
  | "challenge";

export type ReceiptProposalQuestion = {
  field: ReceiptProposalQuestionField;
  question: string;
  reason: string;
};

export type ReceiptProposal = {
  format: typeof receiptProposalFormat;
  generated_at: string;
  run_ref: string;
  system_version_ref: string;
  trace_ref: string;
  observed_event_refs: string[];
  observed_event_types: EventType[];
  observed: {
    ai_invocation_count: number;
    human_review_count: number;
    override_count: number;
    decision_count: number;
    action_count: number;
    escalation_count: number;
  };
  suggested: {
    ai_summary: string;
    human_involvement?: string;
  };
  questions_to_resolve: ReceiptProposalQuestion[];
  source_content_included: false;
};

export type ReceiptProposalResult = {
  trace: Trace;
  proposal: ReceiptProposal;
};

const receiptRelevantTypes = new Set<EventType>([
  "ai_invocation",
  "recommendation",
  "human_review",
  "override",
  "decision",
  "action_proposed",
  "action_executed",
  "escalation",
  "error",
]);

const relationshipFor = (type: EventType, index: number) => {
  if (index === 0) return "starts" as const;
  switch (type) {
    case "recommendation":
      return "informs" as const;
    case "human_review":
      return "reviews" as const;
    case "override":
      return "overrides" as const;
    case "decision":
      return "decides" as const;
    case "action_proposed":
      return "triggers" as const;
    case "action_executed":
      return "executes" as const;
    case "escalation":
      return "escalates" as const;
    default:
      return "follows" as const;
  }
};

const labelFor = (type: EventType) => {
  switch (type) {
    case "ai_invocation":
      return "AI invocation";
    case "recommendation":
      return "recommendation";
    case "human_review":
      return "human review";
    case "override":
      return "override";
    case "decision":
      return "decision";
    case "action_proposed":
      return "action proposed";
    case "action_executed":
      return "action executed";
    case "escalation":
      return "escalation";
    case "error":
      return "error";
    default:
      return type.replaceAll("_", " ");
  }
};

const count = (events: Event[], type: EventType) =>
  events.filter((event) => event.type === type).length;

const traceIdFor = (run: Run) => `trace:proposal:${run.id.slice("run:".length)}`;

/**
 * Selects a bounded causal path from canonical runtime events and creates a
 * reviewable receipt proposal.
 *
 * The proposal deliberately does not attempt to construct a canonical Receipt.
 * Runtime telemetry can establish that model calls, reviews, decisions and
 * actions occurred; it cannot safely infer organisational meaning such as the
 * actual effect of AI, final authority, outcome or a person's challenge route.
 * Those remain explicit questions for human review.
 */
export const proposeReceiptFromObservedRun = (
  run: Run,
  events: Event[],
  options: { generatedAt?: string } = {},
): ReceiptProposalResult => {
  const wrongRun = events.find((event) => event.run_ref !== run.id);
  if (wrongRun) {
    throw new Error(
      `Event ${wrongRun.id} belongs to ${wrongRun.run_ref}, not observed run ${run.id}.`,
    );
  }

  const selected = [...events]
    .filter((event) => receiptRelevantTypes.has(event.type))
    .sort((left, right) => left.sequence - right.sequence);

  if (!selected.some((event) => event.type === "ai_invocation")) {
    throw new Error(`Run ${run.id} has no observed AI invocation from which to propose a receipt.`);
  }

  const generatedAt =
    options.generatedAt ??
    run.completed_at ??
    selected.at(-1)?.occurred_at ??
    run.started_at;

  const trace = traceSchema.parse({
    schema_version: "0.1",
    id: traceIdFor(run),
    run_ref: run.id,
    system_version_ref: run.system_version_ref,
    generated_at: generatedAt,
    steps: selected.map((event, index) => ({
      event_ref: event.id,
      relationship_to_previous: relationshipFor(event.type, index),
    })),
    summary: selected.map((event) => labelFor(event.type)).join(" → "),
    disclosure: "internal",
  });

  const aiInvocationCount = count(selected, "ai_invocation");
  const humanReviewCount = count(selected, "human_review");
  const overrideCount = count(selected, "override");
  const decisionCount = count(selected, "decision");
  const actionCount = count(selected, "action_executed");
  const escalationCount = count(selected, "escalation");
  const humanObserved = humanReviewCount + overrideCount > 0;

  const questions: ReceiptProposalQuestion[] = [
    {
      field: "ai_involvement",
      question: "What role did AI play in this case?",
      reason: "An invocation proves AI ran, but not whether its influence was assistive, informational, advisory, conditional or decisional.",
    },
    {
      field: "effect_of_ai",
      question: "What happened because of the AI output?",
      reason: "Event order alone does not establish causal organisational effect.",
    },
    ...(humanObserved
      ? [
          {
            field: "human_involvement" as const,
            question: "What did the human reviewer actually review or change?",
            reason: "A review or override event records participation but not the substance or quality of that review.",
          },
        ]
      : []),
    {
      field: "final_authority",
      question: "Who or what had final authority for the consequential outcome?",
      reason: "A decision event does not by itself prove the authority model declared by the organisation.",
    },
    {
      field: "outcome",
      question: "What was the actual outcome for the affected person or process?",
      reason: "CRUX does not infer an outcome from tool execution or workflow completion.",
    },
    {
      field: "challenge",
      question: "Is there a relevant challenge, appeal or correction route for this outcome?",
      reason: "Challenge information is organisational policy, not runtime telemetry.",
    },
  ];

  return {
    trace,
    proposal: {
      format: receiptProposalFormat,
      generated_at: generatedAt,
      run_ref: run.id,
      system_version_ref: run.system_version_ref,
      trace_ref: trace.id,
      observed_event_refs: selected.map((event) => event.id),
      observed_event_types: selected.map((event) => event.type),
      observed: {
        ai_invocation_count: aiInvocationCount,
        human_review_count: humanReviewCount,
        override_count: overrideCount,
        decision_count: decisionCount,
        action_count: actionCount,
        escalation_count: escalationCount,
      },
      suggested: {
        ai_summary: `${aiInvocationCount} AI model invocation${aiInvocationCount === 1 ? " was" : "s were"} observed.`,
        ...(humanObserved
          ? {
              human_involvement: `${humanReviewCount} human review event${humanReviewCount === 1 ? " was" : "s were"} observed${overrideCount > 0 ? `, with ${overrideCount} override event${overrideCount === 1 ? "" : "s"}` : ""}.`,
            }
          : {}),
      },
      questions_to_resolve: questions,
      source_content_included: false,
    },
  };
};
