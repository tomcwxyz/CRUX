import type { Event, SystemVersion } from "@crux/schemas";

export type DeclaredObservedField = {
  field: "provider" | "model_identifier";
  declared?: string;
  observed?: string;
  status: "match" | "divergence" | "declared_unknown" | "observed_missing";
};

export type DeclaredObservedComparison = {
  eventRef?: string;
  runRef?: string;
  occurredAt?: string;
  componentRef?: string;
  componentName?: string;
  comparable: boolean;
  fields: DeclaredObservedField[];
};

const stringAttribute = (event: Event, key: string) => {
  const value = event.attributes[key];
  return typeof value === "string" ? value : undefined;
};

const declaredValue = (
  value: { status: string; value?: string | undefined } | undefined,
) => value?.status === "known" ? value.value : undefined;

/**
 * Reconciles one observed AI invocation with the model component declared on
 * the exact SystemVersion.
 *
 * This belongs in CRUX core rather than an instrumentation adapter: adapters
 * report observations, while core owns the semantics of comparing observed
 * behaviour with organisational declarations. Divergence is descriptive only;
 * this function never mutates the declaration or decides whether a difference
 * is acceptable.
 */
export const compareDeclaredAndObservedModel = (
  version: SystemVersion,
  event: Event,
): DeclaredObservedComparison => {
  const componentRef = event.component_ref;
  const component = componentRef
    ? version.components.find((item) => item.id === componentRef && item.kind === "model")
    : undefined;

  if (!component) {
    return {
      eventRef: event.id,
      runRef: event.run_ref,
      occurredAt: event.occurred_at,
      ...(componentRef ? { componentRef } : {}),
      comparable: false,
      fields: [],
    };
  }

  const observedModel =
    stringAttribute(event, "response_model") ?? stringAttribute(event, "request_model");
  const observedProvider = stringAttribute(event, "provider");
  const declaredModel = declaredValue(component.model_identifier);
  const declaredProvider = declaredValue(component.provider);

  const compare = (
    field: DeclaredObservedField["field"],
    declared: string | undefined,
    observed: string | undefined,
  ): DeclaredObservedField => {
    if (!declared) {
      return {
        field,
        ...(observed ? { observed } : {}),
        status: "declared_unknown",
      };
    }
    if (!observed) {
      return {
        field,
        declared,
        status: "observed_missing",
      };
    }
    return {
      field,
      declared,
      observed,
      status: declared === observed ? "match" : "divergence",
    };
  };

  return {
    eventRef: event.id,
    runRef: event.run_ref,
    occurredAt: event.occurred_at,
    componentRef: component.id,
    componentName: component.name,
    comparable: true,
    fields: [
      compare("provider", declaredProvider, observedProvider),
      compare("model_identifier", declaredModel, observedModel),
    ],
  };
};

/**
 * Returns model observations relevant to one exact SystemVersion. Callers must
 * provide events already associated with runs for that version; this helper
 * intentionally does not guess version membership from event metadata alone.
 */
export const compareDeclaredAndObservedModels = (
  version: SystemVersion,
  events: Event[],
): DeclaredObservedComparison[] =>
  events
    .filter((event) => event.type === "ai_invocation")
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => compareDeclaredAndObservedModel(version, event));

export const hasDeclaredObservedDivergence = (
  comparison: DeclaredObservedComparison,
) => comparison.fields.some((field) => field.status === "divergence");
