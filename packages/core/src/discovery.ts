import {
  DiscoveryCandidateSchema,
  DiscoveryReportSchema,
  type DiscoveryCandidate,
  type DiscoveryConfidence,
  type DiscoveryReport,
  type DiscoverySignal,
} from "@crux/schemas";

const unique = (items: Array<string | undefined>): string[] =>
  [...new Set(items.filter((item): item is string => Boolean(item?.trim())).map((item) => item.trim()))];

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ai-use";

const humanise = (value: string) =>
  value
    .replace(/[._/-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

const confidenceFor = (signals: DiscoverySignal[]): DiscoveryConfidence => {
  const kinds = new Set(signals.map((signal) => signal.kind));
  if (kinds.has("model_call") && (kinds.has("workflow_job") || kinds.has("human_review_surface"))) {
    return "high";
  }
  if (
    kinds.has("model_call") ||
    kinds.has("runtime_observation") ||
    (kinds.has("ai_sdk") && kinds.has("provider_configuration"))
  ) {
    return "medium";
  }
  return "low";
};

const questionsFor = (signals: DiscoverySignal[]) => {
  const kinds = new Set(signals.map((signal) => signal.kind));
  const questions = ["purpose", "people_affected", "authority"] as const;
  return [
    ...questions,
    ...(kinds.has("decision_surface") ? (["challenge_route"] as const) : []),
    ...(kinds.has("action_surface") || kinds.has("tool_boundary")
      ? (["action_limits"] as const)
      : []),
  ];
};

const candidateFromSignals = (
  report: DiscoveryReport,
  groupKey: string,
  signals: DiscoverySignal[],
): DiscoveryCandidate => {
  const preferredLabel = signals.map((signal) => signal.candidate_label).find(Boolean);
  const name =
    preferredLabel ??
    (groupKey === "unscoped"
      ? `AI use in ${report.source.label}`
      : humanise(groupKey));

  const technologies = unique(signals.map((signal) => signal.technology));
  const aiBoundaries = unique(
    signals
      .filter((signal) => ["model_call", "ai_sdk", "ai_provider", "runtime_observation"].includes(signal.kind))
      .map((signal) => signal.label),
  );
  const workflowHints = unique(signals.map((signal) => signal.workflow_hint));
  const humanSurfaces = unique(
    signals.filter((signal) => signal.kind === "human_review_surface").map((signal) => signal.label),
  );
  const decisionSurfaces = unique(
    signals.filter((signal) => signal.kind === "decision_surface").map((signal) => signal.label),
  );
  const actionSurfaces = unique(
    signals
      .filter((signal) => signal.kind === "action_surface" || signal.kind === "tool_boundary")
      .map((signal) => signal.label),
  );

  const confidence = confidenceFor(signals);
  const evidenceKinds = unique(signals.map((signal) => signal.kind.replaceAll("_", " ")));
  const explanation =
    `CRUX found ${signals.length} technical signal${signals.length === 1 ? "" : "s"} ` +
    `(${evidenceKinds.join(", ")}). This is a candidate, not an organisational declaration.`;

  return DiscoveryCandidateSchema.parse({
    id: `candidate:${slug(report.source.label)}:${slug(groupKey)}`,
    status: "candidate",
    name,
    confidence,
    signal_refs: signals.map((signal) => signal.id),
    observed: {
      technologies,
      ai_boundaries: aiBoundaries,
      workflow_hints: workflowHints,
      human_surfaces: humanSurfaces,
      decision_surfaces: decisionSurfaces,
      action_surfaces: actionSurfaces,
    },
    unanswered: questionsFor(signals),
    explanation,
  });
};

export const suggestAIUseCandidates = (input: DiscoveryReport): DiscoveryCandidate[] => {
  const report = DiscoveryReportSchema.parse(input);
  const meaningful = report.signals.filter((signal) =>
    ["model_call", "ai_sdk", "ai_provider", "provider_configuration", "workflow_job", "human_review_surface", "decision_surface", "action_surface", "tool_boundary", "runtime_observation"].includes(signal.kind),
  );
  if (meaningful.length === 0) return [];

  const explicitGroups = new Map<string, DiscoverySignal[]>();
  const unscoped: DiscoverySignal[] = [];

  for (const signal of meaningful) {
    if (signal.workflow_hint) {
      const existing = explicitGroups.get(signal.workflow_hint) ?? [];
      existing.push(signal);
      explicitGroups.set(signal.workflow_hint, existing);
    } else {
      unscoped.push(signal);
    }
  }

  if (explicitGroups.size === 0) {
    return [candidateFromSignals(report, "unscoped", meaningful)];
  }

  const shared = unscoped.filter(
    (signal) =>
      signal.scope_hint === "shared" ||
      ["ai_sdk", "ai_provider", "provider_configuration"].includes(signal.kind),
  );
  const candidates = [...explicitGroups.entries()].map(([key, signals]) =>
    candidateFromSignals(report, key, [...shared, ...signals]),
  );

  const unshared = unscoped.filter((signal) => !shared.includes(signal));
  if (unshared.length > 0) {
    candidates.push(candidateFromSignals(report, "unscoped", unshared));
  }

  return candidates;
};
