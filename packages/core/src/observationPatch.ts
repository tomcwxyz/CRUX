import type { DiscoveryCandidate, DiscoveryReport } from "@crux/schemas";
import { buildObservationPlan } from "./observationPlan.js";

export type ObservationPatchGeneration =
  | {
      state: "manual_review_required";
      reason: string;
    }
  | {
      state: "adapter_available";
      adapter_id: "open-recs-source-extract";
      reason: string;
    };

export type ObservationPatchProposal = {
  status: "proposal";
  target_path?: string;
  add_file: {
    path: string;
    purpose: string;
  };
  environment: Array<{ name: string; purpose: string }>;
  integration_snippet: string;
  review_checks: string[];
  generation: ObservationPatchGeneration;
};

const safeWorkflow = (candidate: DiscoveryCandidate) =>
  candidate.observed.workflow_hints[0] ??
  candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, ".");

const exactAdapterFor = ({
  report,
  candidate,
  targetPath,
}: {
  report: DiscoveryReport;
  candidate: DiscoveryCandidate;
  targetPath?: string;
}): ObservationPatchGeneration => {
  const repository =
    report.source.external_ref?.replace(/\/$/, "") ??
    report.source.label.split("#")[0];

  const workflows = new Set(candidate.observed.workflow_hints);

  if (
    repository === "https://github.com/tomcwxyz/open-recs-local" &&
    workflows.has("source.extract") &&
    targetPath === "src/lib/jobs/handlers/extract.ts"
  ) {
    return {
      state: "adapter_available",
      adapter_id: "open-recs-source-extract",
      reason:
        "CRUX has a deterministic adapter for the already-tested Open Recs source.extract observation change. The adapter still validates exact source anchors before it can produce a patch.",
    };
  }

  return {
    state: "manual_review_required",
    reason:
      "CRUX can describe the smallest observation change here, but it does not yet have a deterministic adapter that can safely produce exact repository edits.",
  };
};

export const buildObservationPatchProposal = (
  report: DiscoveryReport,
  candidate: DiscoveryCandidate,
): ObservationPatchProposal => {
  const plan = buildObservationPlan(report, candidate);
  const workflow = safeWorkflow(candidate);

  return {
    status: "proposal",
    ...(plan.primary_path ? { target_path: plan.primary_path } : {}),
    add_file: {
      path: "src/lib/crux/observe.ts",
      purpose:
        "Small opt-in metadata-only emitter. It should no-op unless all CRUX environment variables are present and must never make the application workflow fail.",
    },
    environment: [
      {
        name: "CRUX_INGEST_URL",
        purpose: "Authenticated CRUX runtime-ingest endpoint.",
      },
      {
        name: "CRUX_INGEST_TOKEN",
        purpose: "Bearer credential for the configured ingest endpoint.",
      },
      {
        name: "CRUX_SYSTEM_VERSION_REF",
        purpose:
          "Exact confirmed CRUX SystemVersion this observation belongs to.",
      },
      {
        name: "CRUX_PRODUCER_ID",
        purpose: "Stable producer identity for idempotent provenance.",
      },
    ],
    integration_snippet: `void emitCruxAIInvocation({\n  workflow: "${workflow}",\n  provider: /* existing provider name */,\n  operation: "generate",\n});`,
    review_checks: [
      "No prompt, completion, reasoning, retrieved document, source document, tool argument or tool result is included.",
      "The hook is disabled unless explicit CRUX configuration is present.",
      "Network or CRUX failures cannot fail the application workflow.",
      "The observation targets the confirmed workflow boundary rather than automatically instrumenting every shared provider call.",
      "A unit test asserts the emitted payload contains only allow-listed metadata.",
    ],
    generation: exactAdapterFor({
      report,
      candidate,
      targetPath: plan.primary_path,
    }),
  };
};
