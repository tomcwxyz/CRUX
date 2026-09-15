import { z } from "zod";
import {
  aiUseSchema,
  claimSchema,
  evidenceLinkSchema,
  evidenceSchema,
  evaluationCaseSchema,
  evaluationDefinitionSchema,
  evaluationRunSchema,
  eventSchema,
  observationSchema,
  organisationSchema,
  receiptSchema,
  runSchema,
  systemSchema,
  systemVersionSchema,
  timestampSchema,
  traceSchema,
  type AIUse,
  type AISystem,
  type Claim,
  type Evidence,
  type EvidenceLink,
  type EvaluationCase,
  type EvaluationDefinition,
  type EvaluationRun,
  type Event,
  type Observation,
  type Organisation,
  type Receipt,
  type Run,
  type SystemVersion,
  type Trace,
} from "@crux/schemas";
import { validateTraceBundle } from "@crux/core/trace";

export const portableBundleSchema = z
  .object({
    format: z.literal("crux-bundle/0.1"),
    generated_at: timestampSchema,
    organisations: z.array(organisationSchema).default([]),
    ai_uses: z.array(aiUseSchema).default([]),
    systems: z.array(systemSchema).default([]),
    system_versions: z.array(systemVersionSchema).default([]),
    claims: z.array(claimSchema).default([]),
    evidence: z.array(evidenceSchema).default([]),
    evidence_links: z.array(evidenceLinkSchema).default([]),
    evaluation_definitions: z.array(evaluationDefinitionSchema).default([]),
    evaluation_runs: z.array(evaluationRunSchema).default([]),
    evaluation_cases: z.array(evaluationCaseSchema).default([]),
    runs: z.array(runSchema).default([]),
    events: z.array(eventSchema).default([]),
    traces: z.array(traceSchema).default([]),
    receipts: z.array(receiptSchema).default([]),
    observations: z.array(observationSchema).default([]),
  })
  .strict();

export type CruxPortableBundle = z.infer<typeof portableBundleSchema>;

export type BundleValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type BundleValidationResult = {
  valid: boolean;
  issues: BundleValidationIssue[];
};

type Identified = { id: string };

const indexById = <T extends Identified>(values: T[]) =>
  new Map(values.map((value) => [value.id, value] as const));

const checkDuplicates = (
  label: string,
  values: Identified[],
  issues: BundleValidationIssue[],
) => {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value.id)) {
      issues.push({
        code: "duplicate_id",
        path: `${label}[${index}].id`,
        message: `Duplicate ${label} ID ${value.id}.`,
      });
    }
    seen.add(value.id);
  }
};

const requireRef = (
  exists: boolean,
  code: string,
  path: string,
  message: string,
  issues: BundleValidationIssue[],
) => {
  if (!exists) issues.push({ code, path, message });
};

const allCollections = (bundle: CruxPortableBundle): Array<[string, Identified[]]> => [
  ["organisations", bundle.organisations],
  ["ai_uses", bundle.ai_uses],
  ["systems", bundle.systems],
  ["system_versions", bundle.system_versions],
  ["claims", bundle.claims],
  ["evidence", bundle.evidence],
  ["evidence_links", bundle.evidence_links],
  ["evaluation_definitions", bundle.evaluation_definitions],
  ["evaluation_runs", bundle.evaluation_runs],
  ["evaluation_cases", bundle.evaluation_cases],
  ["runs", bundle.runs],
  ["events", bundle.events],
  ["traces", bundle.traces],
  ["receipts", bundle.receipts],
  ["observations", bundle.observations],
];

export const validateBundleReferences = (
  bundle: CruxPortableBundle,
): BundleValidationResult => {
  const issues: BundleValidationIssue[] = [];

  for (const [label, values] of allCollections(bundle)) {
    checkDuplicates(label, values, issues);
  }

  const organisations = indexById<Organisation>(bundle.organisations);
  const aiUses = indexById<AIUse>(bundle.ai_uses);
  const systems = indexById<AISystem>(bundle.systems);
  const versions = indexById<SystemVersion>(bundle.system_versions);
  const claims = indexById<Claim>(bundle.claims);
  const evidence = indexById<Evidence>(bundle.evidence);
  const definitions = indexById<EvaluationDefinition>(bundle.evaluation_definitions);
  const runs = indexById<Run>(bundle.runs);
  const events = indexById<Event>(bundle.events);
  const traces = indexById<Trace>(bundle.traces);

  for (const [index, use] of bundle.ai_uses.entries()) {
    requireRef(
      organisations.has(use.organisation_ref),
      "missing_organisation",
      `ai_uses[${index}].organisation_ref`,
      `AI use ${use.id} references missing organisation ${use.organisation_ref}.`,
      issues,
    );
    for (const [refIndex, ref] of use.system_refs.entries()) {
      requireRef(
        systems.has(ref),
        "missing_system",
        `ai_uses[${index}].system_refs[${refIndex}]`,
        `AI use ${use.id} references missing system ${ref}.`,
        issues,
      );
    }
  }

  for (const [index, system] of bundle.systems.entries()) {
    for (const [refIndex, ref] of system.ai_use_refs.entries()) {
      requireRef(
        aiUses.has(ref),
        "missing_ai_use",
        `systems[${index}].ai_use_refs[${refIndex}]`,
        `System ${system.id} references missing AI use ${ref}.`,
        issues,
      );
    }
    if (system.current_version_ref) {
      const currentVersion = versions.get(system.current_version_ref);
      requireRef(
        currentVersion !== undefined,
        "missing_current_version",
        `systems[${index}].current_version_ref`,
        `System ${system.id} references missing current version ${system.current_version_ref}.`,
        issues,
      );
      if (currentVersion && currentVersion.system_ref !== system.id) {
        issues.push({
          code: "current_version_wrong_system",
          path: `systems[${index}].current_version_ref`,
          message: `Current version ${currentVersion.id} belongs to ${currentVersion.system_ref}, not ${system.id}.`,
        });
      }
    }
  }

  for (const [index, version] of bundle.system_versions.entries()) {
    requireRef(
      systems.has(version.system_ref),
      "missing_system",
      `system_versions[${index}].system_ref`,
      `System version ${version.id} references missing system ${version.system_ref}.`,
      issues,
    );
    if (version.supersedes) {
      requireRef(
        versions.has(version.supersedes),
        "missing_superseded_version",
        `system_versions[${index}].supersedes`,
        `System version ${version.id} supersedes missing version ${version.supersedes}.`,
        issues,
      );
    }
  }

  for (const [index, link] of bundle.evidence_links.entries()) {
    requireRef(
      claims.has(link.claim_ref),
      "missing_claim",
      `evidence_links[${index}].claim_ref`,
      `Evidence link ${link.id} references missing claim ${link.claim_ref}.`,
      issues,
    );
    requireRef(
      evidence.has(link.evidence_ref),
      "missing_evidence",
      `evidence_links[${index}].evidence_ref`,
      `Evidence link ${link.id} references missing evidence ${link.evidence_ref}.`,
      issues,
    );
  }

  for (const [index, evaluationRun] of bundle.evaluation_runs.entries()) {
    const definition = definitions.get(evaluationRun.definition_ref);
    requireRef(
      definition !== undefined,
      "missing_evaluation_definition",
      `evaluation_runs[${index}].definition_ref`,
      `Evaluation run ${evaluationRun.id} references missing definition ${evaluationRun.definition_ref}.`,
      issues,
    );
    if (definition && definition.version !== evaluationRun.definition_version) {
      issues.push({
        code: "evaluation_definition_version_mismatch",
        path: `evaluation_runs[${index}].definition_version`,
        message: `Evaluation run ${evaluationRun.id} expects definition version ${evaluationRun.definition_version}, but the bundle contains ${definition.version}.`,
      });
    }
    if (evaluationRun.evidence_ref) {
      requireRef(
        evidence.has(evaluationRun.evidence_ref),
        "missing_evidence",
        `evaluation_runs[${index}].evidence_ref`,
        `Evaluation run ${evaluationRun.id} references missing evidence ${evaluationRun.evidence_ref}.`,
        issues,
      );
    }
  }

  for (const [index, evaluationCase] of bundle.evaluation_cases.entries()) {
    requireRef(
      versions.has(evaluationCase.system_version_ref),
      "missing_system_version",
      `evaluation_cases[${index}].system_version_ref`,
      `Evaluation case ${evaluationCase.id} references missing system version ${evaluationCase.system_version_ref}.`,
      issues,
    );
    for (const [refIndex, ref] of evaluationCase.evaluation_definition_refs.entries()) {
      requireRef(
        definitions.has(ref),
        "missing_evaluation_definition",
        `evaluation_cases[${index}].evaluation_definition_refs[${refIndex}]`,
        `Evaluation case ${evaluationCase.id} references missing definition ${ref}.`,
        issues,
      );
    }
  }

  for (const [index, run] of bundle.runs.entries()) {
    requireRef(
      versions.has(run.system_version_ref),
      "missing_system_version",
      `runs[${index}].system_version_ref`,
      `Run ${run.id} references missing system version ${run.system_version_ref}.`,
      issues,
    );
  }

  for (const [index, event] of bundle.events.entries()) {
    requireRef(
      runs.has(event.run_ref),
      "missing_run",
      `events[${index}].run_ref`,
      `Event ${event.id} references missing run ${event.run_ref}.`,
      issues,
    );
  }

  for (const [index, trace] of bundle.traces.entries()) {
    const run = runs.get(trace.run_ref);
    requireRef(
      run !== undefined,
      "missing_run",
      `traces[${index}].run_ref`,
      `Trace ${trace.id} references missing run ${trace.run_ref}.`,
      issues,
    );
    for (const [stepIndex, step] of trace.steps.entries()) {
      requireRef(
        events.has(step.event_ref),
        "missing_event",
        `traces[${index}].steps[${stepIndex}].event_ref`,
        `Trace ${trace.id} references missing event ${step.event_ref}.`,
        issues,
      );
    }

    if (run) {
      const traceEvents = bundle.events.filter((event) =>
        trace.steps.some((step) => step.event_ref === event.id),
      );
      const traceReceipts = bundle.receipts.filter((receipt) => receipt.trace_ref === trace.id);
      const validations = traceReceipts.length > 0
        ? traceReceipts.map((receipt) => validateTraceBundle({ run, events: traceEvents, trace, receipt }))
        : [validateTraceBundle({ run, events: traceEvents, trace })];

      for (const validation of validations) {
        for (const traceIssue of validation.issues) {
          issues.push({
            code: `trace_${traceIssue.code}`,
            path: `traces[${index}]`,
            message: traceIssue.message,
          });
        }
      }
    }
  }

  for (const [index, receipt] of bundle.receipts.entries()) {
    requireRef(
      runs.has(receipt.run_ref),
      "missing_run",
      `receipts[${index}].run_ref`,
      `Receipt ${receipt.id} references missing run ${receipt.run_ref}.`,
      issues,
    );
    requireRef(
      traces.has(receipt.trace_ref),
      "missing_trace",
      `receipts[${index}].trace_ref`,
      `Receipt ${receipt.id} references missing trace ${receipt.trace_ref}.`,
      issues,
    );
    requireRef(
      versions.has(receipt.system_version_ref),
      "missing_system_version",
      `receipts[${index}].system_version_ref`,
      `Receipt ${receipt.id} references missing system version ${receipt.system_version_ref}.`,
      issues,
    );
  }

  for (const [index, observation] of bundle.observations.entries()) {
    requireRef(
      versions.has(observation.system_version_ref),
      "missing_system_version",
      `observations[${index}].system_version_ref`,
      `Observation ${observation.id} references missing system version ${observation.system_version_ref}.`,
      issues,
    );
  }

  return { valid: issues.length === 0, issues };
};

export const parsePortableBundle = (input: unknown): CruxPortableBundle =>
  portableBundleSchema.parse(input);
