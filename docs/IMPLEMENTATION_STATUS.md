# CRUX implementation status

**Updated:** 15 September 2026

CRUX is now at `0.1-beta.0`. The standalone contract/tooling layer remains the foundation, a deliberately thin pilot authoring/viewer surface sits directly on top of the portable bundle, and a first metadata-only runtime instrumentation spike is being tested against the same canonical Run/Event contracts.

## Implemented

### Evidence spine

- Claim / Evidence / EvidenceLink
- EvaluationDefinition / EvaluationRun
- neutral EvidenceEnvelope
- provider-neutral external evidence contracts

### Organisational/process model

- Organisation / AIUse / System / SystemVersion
- influence and agency as separate concepts
- process graphs, components and data sources
- multiple human roles and local decision authority
- bounded actions
- risks and safeguards
- explicit unknown/not-disclosed/withheld supplier states

### Evidence resolution

- declared/supported/qualified/contradicted/stale/unknown
- version and organisational scope resolution
- broad/narrow evidence handling
- freshness and review windows
- conflict preservation
- unresolved/inapplicable evidence reporting
- disclosure filtering
- evidence summaries without a trust score

### Provenance and learning

- Run / Event / Trace / Receipt / Observation
- metadata-first capture
- causal traces rather than raw-log-as-explanation
- trace/run/event/receipt consistency validation
- affected-person receipt representation
- privacy-safe trace projections with hidden-context signals
- proposal-first EvaluationCase promotion from receipts/incidents

### Portable tooling

- canonical `crux-bundle/0.1`
- cross-record reference validation
- derived `crux-disclosure/0.1`
- JSON Schema export
- `crux validate`
- `crux inspect`
- `crux redact`
- `crux schema`
- explicit version/migration policy
- worked portable examples
- CI dogfooding of the standalone CLI

### Beta pilot surface

- `apps/pilot` Next.js application
- open/import a local canonical CRUX JSON bundle
- working/public/affected-person disclosure lenses
- organisation, AI-use, system/process, claim/evidence and receipt views
- guided multi-use authoring: add and switch between 2–3 materially different AI uses without creating application-only records
- explicit influence and agency authoring
- multiple accountable human roles, including whether they can override AI and see original source information
- decision-point authoring with consequence, final authority, AI influence, responsible role, review-before-effect and challenge route
- bounded action authoring with initiator, approval requirement, reversibility, scope and escalation
- process graph decision/action nodes kept aligned with their canonical authority records
- manual evidence authoring with kind, relationship, disclosure and limitations; supporting evidence changes derived claim state rather than merely changing presentation
- metadata-first specific-case receipt authoring that creates a valid Run → Event → Trace → Receipt chain
- receipt authoring stores no source content by default and requires explicit human involvement when human/hybrid final authority is claimed
- questions-to-resolve prompts that surface missing transparency without a score
- downloadable pilot-session sheet for comparable authoring and comprehension testing
- canonical/public/affected-person JSON export
- no account, database or hidden application-only canonical state
- structural and cross-reference validation before canonical/disclosure export
- invalid in-progress edits remain visibly a working draft
- starter bundle deliberately includes a declared but unevidenced claim

### Beta pipeline integration spike

Implemented on `beta/pipeline-instrumentation` for validation before merge:

- `packages/instrumentation` as a framework-independent metadata-first runtime collector;
- canonical Run/Event generation with no hosted CRUX dependency;
- Vercel AI SDK step-callback mapping without importing the `ai` package into CRUX core;
- OpenTelemetry GenAI span mapping using a strict allow-list of metadata attributes;
- prompt/output/reasoning/tool-argument content excluded by default even when source telemetry contains it;
- declared-versus-observed model/provider comparison against the exact SystemVersion;
- divergence is surfaced for review rather than silently mutating the declaration;
- tests for canonical event production, content leakage prevention and fallback-model divergence;
- credential-free consequential pipeline dogfood that runs fallback model → human review → decision → action through the real instrumentation package;
- CI asserts the runtime dogfood records the model divergence while synthetic sensitive input/output content never enters the CRUX snapshot.

Not yet implemented:

- a live AI provider/framework pipeline test;
- HTTP/OTLP transport or persistence;
- CI EvidenceEnvelope automatic ingestion;
- automatic trace-to-receipt proposal generation from live telemetry;
- declared-versus-observed presentation in the pilot viewer;
- deployed MCP server;
- hosted ingestion/auth/batching/idempotency.

Those remain deliberately downstream of proving the runtime mapping contract.

## Current phase

`0.1-beta` real-world piloting plus a bounded pipeline-integration spike.

The thin application covers enough of the intended pilot loop to run structured dry-runs with real organisational examples:

```text
purpose
  → AI influence / agency
  → human roles / decision authority / actions
  → specific-case receipt
  → claims
  → evidence
  → working / public / affected-person views
```

In parallel, the pipeline spike tests the complementary automated path:

```text
live AI framework / OpenTelemetry
  → bounded runtime metadata
  → Run / Event
  → declared-versus-observed comparison
  → later: Trace / receipt proposal / production evidence
```

The operating rule is:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

The next useful evidence should come from structured dry-runs, non-author comprehension tests and one small live instrumented AI pipeline rather than speculative schema expansion. See `docs/PILOT.md` and `docs/PIPELINE_INTEGRATION.md`.

## Product boundary

CRUX remains standalone. TOPO, RACK, Ship Check and external evaluation/observability systems are optional context, practice or evidence producers/consumers. None is a CRUX runtime dependency.
