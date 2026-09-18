import type { DiscoveryCandidate, DiscoveryReport, DiscoverySignal } from "@crux/schemas";

export type ObservationPlan = {
  candidate_ref: string;
  candidate_name: string;
  strategy: "workflow_metadata_hook" | "ai_sdk_step_hook" | "runtime_connector";
  rationale: string;
  primary_path?: string;
  supporting_paths: string[];
  metadata: string[];
  excluded_content: string[];
  configuration: string[];
  patch_shape: string[];
};

const evidencePaths = (signals: DiscoverySignal[]) =>
  [...new Set(signals.flatMap((signal) => signal.evidence.map((item) => item.path).filter((path): path is string => Boolean(path))))];

export const buildObservationPlan = (
  report: DiscoveryReport,
  candidate: DiscoveryCandidate,
): ObservationPlan => {
  const signals = candidate.signal_refs
    .map((ref) => report.signals.find((signal) => signal.id === ref))
    .filter((signal): signal is DiscoverySignal => Boolean(signal));

  const scopedModelCalls = signals.filter(
    (signal) => signal.kind === "model_call" && signal.scope_hint !== "shared",
  );
  const runtime = signals.find((signal) => signal.kind === "runtime_observation");
  const aiSdk = scopedModelCalls.find((signal) => /AI SDK/i.test(signal.label));
  const primary = scopedModelCalls[0] ?? signals.find((signal) => signal.kind === "workflow_job");
  const paths = evidencePaths(signals);

  if (runtime) {
    return {
      candidate_ref: candidate.id,
      candidate_name: candidate.name,
      strategy: "runtime_connector",
      rationale: "Runtime metadata already reaches the discovery boundary, so the smallest next step is to keep that connector active and bind its observations to the confirmed CRUX system version.",
      supporting_paths: [],
      metadata: ["provider", "request_model", "response_model", "finish_reason", "token counts", "workflow"],
      excluded_content: ["prompt text", "model output", "reasoning", "retrieved documents", "tool arguments and results"],
      configuration: ["CRUX system-version reference", "producer identity", "authenticated ingest scope"],
      patch_shape: ["No application source patch is required when the runtime connector already observes this boundary."],
    };
  }

  return {
    candidate_ref: candidate.id,
    candidate_name: candidate.name,
    strategy: aiSdk ? "ai_sdk_step_hook" : "workflow_metadata_hook",
    rationale: primary?.evidence[0]?.path
      ? `CRUX found a use-level AI boundary in ${primary.evidence[0].path}. Instrument that workflow boundary before considering shared provider-wide telemetry.`
      : "Instrument the narrowest confirmed workflow boundary rather than the whole application.",
    ...(primary?.evidence[0]?.path ? { primary_path: primary.evidence[0].path } : {}),
    supporting_paths: paths.filter((path) => path !== primary?.evidence[0]?.path).slice(0, 4),
    metadata: ["workflow", "provider", "request_model", "response_model", "finish_reason", "token counts"],
    excluded_content: ["prompt text", "model output", "reasoning", "source documents", "tool arguments and results"],
    configuration: ["CRUX_INGEST_URL", "CRUX_SYSTEM_VERSION_REF", "CRUX_PRODUCER_ID"],
    patch_shape: [
      "Add a tiny metadata-only observation helper that is disabled unless CRUX configuration is present.",
      "Emit one bounded run/event around the confirmed workflow boundary.",
      "Make telemetry failure non-blocking so CRUX can never break the application workflow.",
      "Add a unit test proving prompt/model-output content is not included in the emitted payload.",
    ],
  };
};
