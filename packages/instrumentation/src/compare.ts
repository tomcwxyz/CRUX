import type { Event, SystemVersion } from "@crux/schemas";

export type DeclaredObservedField = {
  field: "provider" | "model_identifier";
  declared?: string;
  observed?: string;
  status: "match" | "divergence" | "declared_unknown" | "observed_missing";
};

export type DeclaredObservedComparison = {
  componentRef?: string;
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
 * Compares observed runtime model metadata with the model component declared on
 * the exact SystemVersion. It reports divergence; it does not mutate the
 * declaration or decide whether the difference is acceptable.
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
      ...(componentRef ? { componentRef } : {}),
      comparable: false,
      fields: [],
    };
  }

  const observedModel = stringAttribute(event, "response_model") ?? stringAttribute(event, "request_model");
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
    componentRef: component.id,
    comparable: true,
    fields: [
      compare("provider", declaredProvider, observedProvider),
      compare("model_identifier", declaredModel, observedModel),
    ],
  };
};
