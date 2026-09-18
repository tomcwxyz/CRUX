import {
  DiscoveryReportSchema,
  type DiscoveryReport,
} from "@crux/schemas";

export type GatewayDiscoveryObservation = {
  id: string;
  application: string;
  workflow?: string;
  provider: string;
  model?: string;
  invocation_count: number;
  first_seen?: string;
  last_seen?: string;
};

const humanise = (value: string) =>
  value
    .replace(/[._/-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();

export const discoveryReportFromGateway = (input: {
  gateway: string;
  label: string;
  generatedAt: string;
  observations: GatewayDiscoveryObservation[];
  externalRef?: string;
}): DiscoveryReport =>
  DiscoveryReportSchema.parse({
    format: "crux-discovery/0.1",
    generated_at: input.generatedAt,
    source: {
      kind: "gateway",
      provider: input.gateway,
      label: input.label,
      ...(input.externalRef ? { external_ref: input.externalRef } : {}),
    },
    signals: input.observations.map((observation) => {
      const workflowHint = observation.workflow ?? observation.application;
      const dateRange =
        observation.first_seen && observation.last_seen
          ? ` between ${observation.first_seen} and ${observation.last_seen}`
          : "";
      return {
        id: `signal:runtime:${observation.id}`,
        kind: "runtime_observation",
        label: observation.model
          ? `${observation.model} model activity`
          : `${observation.provider} model activity`,
        confidence: "high",
        technology: observation.provider,
        workflow_hint: workflowHint,
        candidate_label: humanise(workflowHint),
        scope_hint: "use",
        evidence: [
          {
            detail:
              `${observation.invocation_count} metadata-only invocation${observation.invocation_count === 1 ? "" : "s"} observed${dateRange}. ` +
              `Provider: ${observation.provider}${observation.model ? `; model: ${observation.model}` : ""}.`,
          },
        ],
      };
    }),
    limitations: [
      "Gateway metadata can establish that model activity occurred, but cannot establish why the AI was used, who was affected or who held decision authority.",
      "Prompt, response and reasoning content are not required for this discovery report.",
      "Application and workflow labels are technical hints, not organisational declarations.",
    ],
  });
