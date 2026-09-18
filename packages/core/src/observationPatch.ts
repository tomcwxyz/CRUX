import type { DiscoveryCandidate, DiscoveryReport } from "@crux/schemas";
import { buildObservationPlan } from "./observationPlan.js";

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
};

const safeWorkflow = (candidate: DiscoveryCandidate) =>
  candidate.observed.workflow_hints[0] ?? candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, ".");

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
      purpose: "Small opt-in metadata-only emitter. It should no-op unless all CRUX environment variables are present and must never make the application workflow fail.",
    },
    environment: [
      { name: "CRUX_INGEST_URL", purpose: "Authenticated CRUX runtime-ingest endpoint." },
      { name: "CRUX_INGEST_TOKEN", purpose: "Bearer credential for the configured ingest endpoint." },
      { name: "CRUX_SYSTEM_VERSION_REF", purpose: "Exact confirmed CRUX SystemVersion this observation belongs to." },
      { name: "CRUX_PRODUCER_ID", purpose: "Stable producer identity for idempotent provenance." },
    ],
    integration_snippet: `void emitCruxAIInvocation({\n  workflow: "${workflow}",\n  provider: /* existing provider name */,\n  operation: "generate",\n});`,
    review_checks: [
      "No prompt, completion, reasoning, retrieved document, source document, tool argument or tool result is included.",
      "The hook is disabled unless explicit CRUX configuration is present.",
      "Network or CRUX failures cannot fail the application workflow.",
      "The observation targets the confirmed workflow boundary rather than automatically instrumenting every shared provider call.",
      "A unit test asserts the emitted payload contains only allow-listed metadata.",
    ],
  };
};
