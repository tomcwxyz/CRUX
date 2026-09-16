# CRUX implementation status

**Updated:** 16 September 2026

CRUX is now at `0.1-beta.0`. The standalone contract/tooling layer remains the foundation, a deliberately thin pilot authoring/viewer surface sits directly on top of the portable bundle, and the first metadata-only runtime/evidence integration path is now implemented and dogfooded against the same canonical contracts.

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
- review-required `crux-receipt-proposal/0.1` derived from observed event paths without inventing organisational outcome/authority/effect/challenge information

### Portable tooling

- canonical `crux-bundle/0.1`
- cross-record reference validation
- derived `crux-disclosure/0.1`
- JSON Schema export
- `crux validate`
- `crux inspect`
- `crux redact`
- `crux ingest-evidence`
- `crux schema`
- idempotent `EvidenceEnvelope` import with evidence-ID conflict detection
- internal-target validation for imported evidence
- automatic evidence ingestion does not create an `EvidenceLink` or upgrade a claim without explicit review
- explicit version/migration policy
- worked portable examples
- CI dogfooding of standalone CLI validation, evidence ingestion/replay and disclosure projection

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
- declared-versus-observed provider/model view scoped to the exact SystemVersion
- observed-behaviour view is currently restricted to the working/internal lens and displays only bounded provider/model metadata
- validated `examples/observed-divergence/crux.json` for manual pilot testing
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
- Vercel AI SDK structural mapping without importing the `ai` package into CRUX canonical/runtime core;
- actual AI SDK `generateText()` lifecycle test using `MockLanguageModelV4`, proving framework integration while keeping an external live-provider call separate;
- OpenTelemetry GenAI span mapping using a strict allow-list of metadata attributes;
- prompt/output/reasoning/tool-argument content excluded by default even when source telemetry contains it;
- declared-versus-observed provider/model reconciliation moved into `@crux/core` rather than owned by an adapter;
- exact-SystemVersion scoping for observed comparisons;
- divergence is surfaced for review rather than silently mutating the declaration;
- tests for canonical event production, content leakage prevention and fallback-model divergence;
- credential-free consequential pipeline dogfood that runs fallback model → human review → decision → action through the real instrumentation package;
- CI asserts runtime divergence while synthetic sensitive input/output content never enters the CRUX snapshot;
- CI/eval `EvidenceEnvelope` import and replay dogfooded through the standalone CLI;
- receipt-proposal generation dogfooded from the observed event chain without copying event summaries into the proposal.

Not yet implemented/proven:

- one smoke test against a real external model provider;
- HTTP/OTLP transport or persistence;
- declared-versus-observed checks for action/review-control semantics beyond provider/model metadata;
- deployed MCP server;
- hosted ingestion/auth/batching/idempotency.

Those remain deliberately downstream of validating the bounded local contracts and the external-provider smoke test.

## Current phase

`0.1-beta` real-world piloting plus a bounded pipeline-integration spike whose local contract path is now implemented.

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

The automated path now reaches:

```text
AI framework / OpenTelemetry
  → bounded runtime metadata
  → Run / Event
  → declared-versus-observed reconciliation
  → observed Trace
  → review-required receipt proposal

CI / eval tool
  → EvidenceEnvelope
  → idempotent evidence import
  → explicit later Claim ↔ Evidence review
```

The operating rule remains:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

The next useful evidence should come from structured dry-runs, non-author comprehension tests and one small external-provider smoke test rather than speculative schema or transport expansion. See `docs/PILOT.md` and `docs/PIPELINE_INTEGRATION.md`.

## Product boundary

CRUX remains standalone. TOPO, RACK, Ship Check and external evaluation/observability systems are optional context, practice or evidence producers/consumers. None is a CRUX runtime dependency.
