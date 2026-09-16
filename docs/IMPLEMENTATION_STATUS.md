# CRUX implementation status

**Updated:** 16 September 2026

CRUX is now at `0.1-beta.0`. The standalone contract/tooling layer remains the foundation, a deliberately thin pilot authoring/viewer surface sits directly on top of the portable bundle, and the beta branch now proves the path from live AI execution through bounded telemetry, reconciliation, semantic transport and the first durable-ingress abstraction.

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
- guided multi-use authoring
- explicit influence and agency authoring
- multiple accountable human roles
- decision-point authoring with consequence, final authority, AI influence, responsible role, review-before-effect and challenge route
- bounded action authoring with initiator, approval requirement, reversibility, scope and escalation
- process graph decision/action nodes kept aligned with canonical authority records
- manual evidence authoring with relationship, disclosure and limitations
- metadata-first specific-case receipt authoring producing a valid Run → Event → Trace → Receipt chain
- receipt authoring stores no source content by default and requires explicit human involvement when human/hybrid final authority is claimed
- questions-to-resolve prompts without a score
- declared-versus-observed provider/model view scoped to the exact SystemVersion
- observed-behaviour view restricted to working/internal lens with bounded provider/model metadata
- validated `examples/observed-divergence/crux.json`
- browser-first `/test` surface with model-call, workflow, declared-versus-observed and transport-boundary tests
- downloadable pilot-session sheet
- canonical/public/affected-person JSON export
- no account/database requirement for the standalone pilot
- validation before canonical/disclosure export

### Beta pipeline integration · accepted browser path

Implemented on `beta/pipeline-instrumentation`:

- `packages/instrumentation` framework-independent metadata-first runtime collector;
- canonical Run/Event generation with no hosted CRUX dependency;
- Vercel AI SDK mapping and actual `generateText()` lifecycle test;
- real external-provider browser smoke test through Vercel AI Gateway;
- prompt/model output excluded while provider/model/token metadata retained;
- OpenTelemetry GenAI mapping using a strict metadata allow-list;
- prompt/output/reasoning/tool-argument content excluded by default;
- declared-versus-observed provider/model reconciliation in `@crux/core` scoped to exact SystemVersion;
- consequential pipeline dogfood: model → human review → decision → action;
- CI/eval EvidenceEnvelope import and replay;
- observed trace → review-required receipt proposal;
- human acceptance of browser Workflow and Declared-versus-observed tests.

### Transport contract · accepted

- `packages/transport` as the storage-free semantic write boundary;
- versioned `crux-ingest/0.1` batches for Run/Event/Observation/EvidenceEnvelope;
- exact SystemVersion targeting;
- producer identity and per-record acceptance provenance;
- identical record replay is idempotent;
- same-ID/different-record conflicts rejected;
- duplicate Run event sequence conflicts rejected;
- default metadata-only transport policy rejects subject refs, free-text event summaries and non-allow-listed runtime attributes;
- payload/record-count boundaries;
- EvidenceEnvelope enters through the same boundary without silent EvidenceLink creation;
- OTLP/HTTP JSON GenAI bridge → existing OTel mapper → same ingestion contract;
- OTLP regression fixture proves input/output message fields do not enter the CRUX batch;
- stateless `/api/ingest-test` route returns updated portable bundle + acceptance ledger with no persistence;
- browser Test 4 human-accepted: first ingestion accepted, exact replay safe, stable-ID conflict rejected, free-text runtime field rejected, OTLP metadata accepted, prompt/output excluded.

### Durable ingress · active

- `DurableIngestStore` abstraction around the pure semantic ingestion function;
- `ingestCruxBatchDurably(...)` service layer;
- in-memory reference store for local/CI contract tests;
- request idempotency key `(scope_ref, producer_ref, request_id)`;
- exact request replay returns the original acceptance ledger without a second commit;
- changed batch under the same request key is rejected;
- authenticated principal/context separated from self-declared producer provenance;
- explicit `runtime:write` and `evidence:write` authorisation capabilities;
- optimistic scope revision contract for concurrency;
- `docs/DURABLE_INGRESS.md` records the service/storage boundary;
- first PostgreSQL migration stores portable bundle JSONB, scope revision, request ledger and acceptance ledger;
- `@crux/adapter-postgres` driver-neutral adapter package started, so managed Neon deployment does not become a core CRUX dependency.

Not yet implemented/proven:

- real PostgreSQL/Neon transaction test against the migration;
- managed producer credential/OIDC registration and scope resolution;
- retry loop/policy for competing revision updates;
- retention/deletion policy for internal runtime provenance;
- asynchronous batching/delivery guarantees and rate limiting;
- declared-versus-observed checks for action/review-control semantics beyond provider/model metadata;
- deployed MCP server.

## Current phase

`0.1-beta` real-world piloting plus durable-ingress implementation around accepted pipeline and transport contracts.

The human-authored path remains:

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
  → crux-ingest/0.1
  → declared-versus-observed reconciliation
  → observed Trace
  → review-required receipt proposal

CI / eval tool
  → EvidenceEnvelope
  → same semantic transport
  → explicit later Claim ↔ Evidence review
```

The durable service path is now being proved as:

```text
authenticated principal
  → authorised producer + scope + capability
  → request-level idempotency
  → pure CRUX semantic ingestion
  → transactional portable bundle + acceptance ledger
```

The operating rule remains:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

The next infrastructure acceptance point is a real PostgreSQL transaction test of commit/replay/conflict/concurrency using the new adapter and migration. In parallel, organisational dry-runs and non-author comprehension testing remain essential product evidence.

## Product boundary

CRUX remains standalone. TOPO, RACK, Ship Check and external evaluation/observability systems are optional context, practice or evidence producers/consumers. None is a CRUX runtime dependency.
