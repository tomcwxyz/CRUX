import type { Event, Receipt, Run, Trace } from "@crux/schemas";

export type TraceBundleIssueCode =
  | "trace_run_mismatch"
  | "system_version_mismatch"
  | "missing_event"
  | "event_run_mismatch"
  | "non_monotonic_event_order"
  | "receipt_run_mismatch"
  | "receipt_trace_mismatch"
  | "receipt_system_version_mismatch";

export type TraceBundleIssue = {
  code: TraceBundleIssueCode;
  message: string;
  ref?: string;
};

export type TraceBundleValidation = {
  valid: boolean;
  issues: TraceBundleIssue[];
  ordered_events: Event[];
};

export const validateTraceBundle = ({
  run,
  events,
  trace,
  receipt,
}: {
  run: Run;
  events: Event[];
  trace: Trace;
  receipt?: Receipt;
}): TraceBundleValidation => {
  const issues: TraceBundleIssue[] = [];
  const eventById = new Map(events.map((event) => [event.id, event]));
  const orderedEvents: Event[] = [];

  if (trace.run_ref !== run.id) {
    issues.push({
      code: "trace_run_mismatch",
      message: `Trace ${trace.id} refers to ${trace.run_ref}, not run ${run.id}.`,
      ref: trace.id,
    });
  }

  if (trace.system_version_ref !== run.system_version_ref) {
    issues.push({
      code: "system_version_mismatch",
      message: "Trace and run refer to different system versions.",
      ref: trace.id,
    });
  }

  let previousSequence: number | undefined;
  for (const step of trace.steps) {
    const event = eventById.get(step.event_ref);
    if (!event) {
      issues.push({
        code: "missing_event",
        message: `Trace step refers to missing event ${step.event_ref}.`,
        ref: step.event_ref,
      });
      continue;
    }

    orderedEvents.push(event);

    if (event.run_ref !== run.id) {
      issues.push({
        code: "event_run_mismatch",
        message: `Event ${event.id} belongs to ${event.run_ref}, not run ${run.id}.`,
        ref: event.id,
      });
    }

    if (previousSequence !== undefined && event.sequence < previousSequence) {
      issues.push({
        code: "non_monotonic_event_order",
        message: `Trace event ${event.id} appears before an earlier sequence position.`,
        ref: event.id,
      });
    }
    previousSequence = event.sequence;
  }

  if (receipt) {
    if (receipt.run_ref !== run.id) {
      issues.push({
        code: "receipt_run_mismatch",
        message: `Receipt ${receipt.id} refers to ${receipt.run_ref}, not run ${run.id}.`,
        ref: receipt.id,
      });
    }
    if (receipt.trace_ref !== trace.id) {
      issues.push({
        code: "receipt_trace_mismatch",
        message: `Receipt ${receipt.id} refers to ${receipt.trace_ref}, not trace ${trace.id}.`,
        ref: receipt.id,
      });
    }
    if (receipt.system_version_ref !== run.system_version_ref) {
      issues.push({
        code: "receipt_system_version_mismatch",
        message: "Receipt and run refer to different system versions.",
        ref: receipt.id,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    ordered_events: orderedEvents,
  };
};
