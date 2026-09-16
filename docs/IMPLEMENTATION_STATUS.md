# CRUX implementation status

**Updated:** 16 September 2026

CRUX is now at `0.1-beta.0`. The standalone contract/tooling layer remains the foundation, a deliberately thin pilot authoring/viewer surface sits directly on top of the portable bundle, and the first metadata-only runtime, evidence and transport paths are implemented against the same canonical contracts.

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
- browser-first `/test` surface with progressive model-call, workflow, declared-versus-observed and transport-boundary tests
- browser workflow test records a real AI invocation followed by synthetic human review → decision → bounded action, then derives a review-required receipt proposal
- browser divergence test creates an actual declared SystemVersion and reconciles it with the observed invocation through `@crux/core`
- browser transport test demonstrates first ingestion, idempotent replay, stable-ID conflict rejection, content-policy rejection and OTLP adaptation
- downloadable pilot-session sheet for comparable authoring and comprehension testing
- canonical/public/affected-person JSON export
- no account, database or hidden application-only canonical state
- structural and cross-reference validation before canonical/disclosure export
- invalid in-progress edits remain visibly a working draft
- starter bundle deliberately includes a declared but unevidenced claim

### Beta pipeline and transport integration spike

Implemented on `beta/pipeline-instrumentation` for validation before merge:

- `packages/instrumentation` as a framework-independent metadata-first runtime collector;
- canonical Run/Event generation with no hosted CRUX dependency;
- Vercel AI SDK structural mapping without importing the `ai` package into CRUX canonical/runtime core;
- actual AI SDK `generateText()` lifecycle test using `MockLanguageModelV4`;
- real external-provider browser smoke test through Vercel AI Gateway using `anthropic/claude-3-haiku`;
- the live smoke test proved prompt and model output remained outside the CRUX snapshot while provider/model/token metadata was retained;
- OpenTelemetry GenAI span mapping using a strict allow-list of metadata attributes;
- prompt/output/reasoning/tool-argument content excluded by default even when source telemetry contains it;
- declared-versus-observed provider/model reconciliation in `@crux/core`, scoped to the exact SystemVersion;
- divergence surfaced for review rather than silently mutating the declaration;
- credential-free consequential pipeline dogfood: fallback model → human review → decision → action;
- idempotent CI/eval `EvidenceEnvelope` import and replay;
- review-required receipt-proposal generation from observed event chains;
- human acceptance of the deployed Workflow and Declared-versus-observed browser tests;
- `packages/transport` as a storage-free canonical semantic ingestion boundary;
- versioned `crux-ingest/0.1` batch containing Run, Event, Observation and EvidenceEnvelope records;
- explicit producer identity and per-record acceptance provenance;
- exact SystemVersion targeting for runtime observations;
- idempotent same-record replay and hard rejection of same-ID/different-record conflicts;
- duplicate Run event-sequence rejection;
- default HTTP transport policy that permits metadata-only capture and rejects subject refs, free-text event summaries and non-allow-listed runtime attributes;
- payload/record-count boundaries;
- EvidenceEnvelope import through the same transport without silently creating EvidenceLinks;
- OTLP/HTTP JSON GenAI bridge that maps through the existing OpenTelemetry allow-list into the same `crux-ingest/0.1` contract;
- regression fixture proving OTLP input/output message fields do not enter the CRUX batch;
- stateless `/api/ingest-test` Next route returning an updated portable bundle plus acceptance ledger with `persistence: none`;
- browser Test 4 for direct semantic ingestion and OTLP adaptation.

Not yet implemented/proven:

- human acceptance of browser Test 4's transport explanation;
- durable transport persistence and transactional ingestion ledger;
- producer authentication/authorisation, tenancy or API keys/OIDC;
- delivery queues/retries/rate limiting;
- declared-versus-observed checks for action/review-control semantics beyond provider/model metadata;
- deployed MCP server.

Durable storage/auth/workspaces remain deliberately downstream of accepting the transport semantics rather than being allowed to define them.

## Current phase

`0.1-beta` real-world piloting plus a bounded pipeline/transport spike. The runtime, reconciliation and storage-free write-contract paths are now implemented; durable service infrastructure is intentionally not.

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
AI application / framework
  → bounded runtime metadata
  → crux-ingest/0.1
  → Run / Event / Observation
  → declared-versus-observed reconciliation
  → observed Trace
  → review-required receipt proposal

OpenTelemetry / OTLP
  → strict GenAI metadata mapping
  → crux-ingest/0.1
  → same CRUX semantic boundary

CI / eval tool
  → EvidenceEnvelope
  → crux-ingest/0.1
  → idempotent evidence import
  → explicit later Claim ↔ Evidence review
```

The operating rule remains:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

The next useful evidence should come from human acceptance of browser Test 4, then structured organisational dry-runs and non-author comprehension testing. Only after that should the beta spike choose durable persistence and producer authentication. See `docs/PILOT.md`, `docs/PIPELINE_INTEGRATION.md` and `docs/TRANSPORT_DECISION.md`.

## Product boundary

CRUX remains standalone. TOPO, RACK, Ship Check and external evaluation/observability systems are optional context, practice or evidence producers/consumers. None is a CRUX runtime dependency.
