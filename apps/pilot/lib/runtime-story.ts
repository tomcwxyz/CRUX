export type ModelCheckField = {
  field: string;
  declared?: string;
  observed?: string;
  status: "match" | "divergence" | "declared_unknown" | "observed_missing";
};

export type ModelCheck = {
  runRef?: string;
  eventRef?: string;
  fields: ModelCheckField[];
  comparable: boolean;
};

/** A run is meaningful only against the specific declared version it belongs to. */
export function latestRunModelCheck<T extends ModelCheck>(
  comparisons: T[],
  runRef: string | null,
): T | null {
  if (!runRef) return null;
  return [...comparisons].reverse().find((comparison) => comparison.runRef === runRef && comparison.comparable) ?? null;
}

export type CheckExplanation = {
  kind: "missing" | "attention" | "incomplete" | "match";
  heading: string;
  explanation: string;
  rows: Array<{
    label: string;
    expected: string;
    seen: string;
    meaning: string;
    kind: "missing" | "attention" | "incomplete" | "match";
  }>;
};

const fieldLabel = (field: string) =>
  field === "model_identifier" ? "AI model" : field === "provider" ? "AI provider" : field.replaceAll("_", " ");

const fieldStatus = (field: ModelCheckField) => {
  if (field.status === "divergence") return { kind: "attention" as const, meaning: "Different — worth checking" };
  if (field.status === "declared_unknown") return { kind: "incomplete" as const, meaning: field.observed ? "New information to record" : "Not enough information" };
  if (field.status === "observed_missing") return { kind: "incomplete" as const, meaning: "Not reported in this run" };
  return { kind: "match" as const, meaning: "Matches this recorded detail" };
};

export function explainModelCheck(comparison: ModelCheck | null): CheckExplanation {
  if (!comparison) return {
    kind: "missing",
    heading: "No model details to compare yet",
    explanation: "Run the example to see what the system reports. A missing observation doesn't mean the AI hasn't been used.",
    rows: [],
  };
  const rows = comparison.fields.map((field) => ({
    label: fieldLabel(field.field),
    expected: field.declared ?? "Not recorded",
    seen: field.observed ?? "Not reported",
    ...fieldStatus(field),
  }));
  const diffs = rows.filter((row) => row.kind === "attention");
  const incomplete = rows.filter((row) => row.kind === "incomplete");
  if (diffs.length) return {
    kind: "attention",
    heading: "Something was different",
    explanation: "Some model/provider details in this run differ from the description. CRUX flags them for a person to check; it does not change the record automatically.",
    rows,
  };
  if (incomplete.length) return {
    kind: "incomplete",
    heading: "The run told us something new",
    explanation: "CRUX observed model/provider information that wasn't fully recorded in the description. That is a gap to review, not proof something went wrong.",
    rows,
  };
  return {
    kind: "match",
    heading: "The model details matched",
    explanation: "The model/provider details reported in this run matched what was recorded. This doesn't establish that every decision or safeguard worked.",
    rows,
  };
}

export function reviewStage(
  latestRunRef: string | null,
  pendingRunRef: string | null,
  reviewedRunRef: string | null,
): "no_run" | "needs_review" | "reviewed" | "observed_without_case" {
  if (!latestRunRef) return "no_run";
  if (reviewedRunRef === latestRunRef) return "reviewed";
  if (pendingRunRef === latestRunRef) return "needs_review";
  return "observed_without_case";
}
