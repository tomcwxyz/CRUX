# CRUX implementation status

**Updated:** 16 September 2026

CRUX is at `0.1-beta.0`. The portable contracts and standalone tooling remain the foundation; the pilot app now sits on top of the same canonical bundle while the runtime path has been proven from live AI execution through bounded telemetry, semantic transport and durable PostgreSQL persistence.

The operating rule remains:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

## Implemented

### Evidence and organisational model

- Claim / Evidence / EvidenceLink
- EvaluationDefinition / EvaluationRun
- neutral EvidenceEnvelope
- Organisation / AIUse / System / SystemVersion
- influence and agency as separate concepts
- process graphs, components and data sources
- multiple human roles and local decision authority
- bounded actions, risks and safeguards
- explicit unknown / withheld / supplier-undisclosed states

### Evidence resolution

- `declared | supported | qualified | contradicted | stale | unknown`
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
- proposal-first EvaluationCase promotion
- review-required `crux-receipt-proposal/0.1` from observed causal paths without inventing organisational outcome, authority, effect or challenge information

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
- idempotent EvidenceEnvelope import with conflict detection
- automatic evidence ingestion does not create an EvidenceLink or upgrade a claim
- explicit version/migration policy
- worked portable examples
- CI dogfooding of validation, evidence ingestion/replay and disclosure projection

### Beta pilot surface

- `apps/pilot` Next.js application
- local canonical CRUX JSON open/import
- working/public/affected-person disclosure lenses
- organisation, AI-use, system/process, claim/evidence and receipt views
- guided multi-use authoring
- explicit influence/agency authoring
- multiple accountable human roles
- decision-point authoring with consequence, authority, AI influence, responsible role, review-before-effect and challenge route
- bounded-action authoring with initiator, approval, reversibility, scope and escalation
- process graph alignment with canonical authority/action records
- manual evidence authoring with relationship, disclosure and limitations
- metadata-first specific-case receipt authoring producing Run → Event → Trace → Receipt
- questions-to-resolve prompts without a score
- declared-versus-observed provider/model view scoped to exact SystemVersion
- browser `/test` surface for live model, workflow, declared-versus-observed, transport and durable-ingress acceptance
- structured pilot-session sheet
- canonical/public/affected-person JSON export
- validation before canonical/disclosure export

### Pipeline integration · accepted

- `@crux/instrumentation` framework-independent metadata-first collector
- canonical Run/Event generation with no hosted CRUX dependency
- Vercel AI SDK mapping and real `generateText()` lifecycle test
- real external-provider call through Vercel AI Gateway
- prompt/output excluded while bounded provider/model/token metadata is retained
- OpenTelemetry GenAI mapping with a strict metadata allow-list
- declared-versus-observed reconciliation in `@crux/core` scoped to exact SystemVersion
- consequential workflow dogfood: model → human review → decision → bounded action
- CI/eval EvidenceEnvelope import and replay
- observed trace → review-required receipt proposal
- browser Workflow and Declared-versus-observed tests human-accepted

### Transport contract · accepted

- `@crux/transport` storage-free semantic write boundary
- versioned `crux-ingest/0.1` batches for Run/Event/Observation/EvidenceEnvelope
- exact SystemVersion targeting
- producer identity and per-record acceptance provenance
- identical replay idempotency
- same-ID/different-record conflict rejection
- duplicate Run event-sequence rejection
- metadata-only content policy and strict runtime allow-list
- payload/record-count boundaries
- EvidenceEnvelope through the same boundary without silent EvidenceLink creation
- OTLP/HTTP GenAI bridge into the same ingestion contract
- regression fixture proving input/output message content is excluded
- stateless `/api/ingest-test`
- browser Test 4 human-accepted

### Durable ingress · accepted beta path

- `DurableIngestStore` around the pure semantic ingestion function
- `ingestCruxBatchDurably(...)` service layer
- in-memory reference store for local/CI tests
- durable request key `(scope_ref, producer_ref, request_id)`
- exact request replay returns the original acceptance ledger without a second commit
- changed batch under the same request key is rejected
- authenticated principal/context separated from producer provenance
- explicit `runtime:write` and `evidence:write` capabilities
- optimistic scope revision contract
- driver-neutral `@crux/adapter-postgres`
- PostgreSQL migration storing canonical bundle JSONB, revision, request ledger and acceptance ledger
- real Neon migration and transaction acceptance
- reconnect/replay recovery on fresh reads
- optimistic concurrency conflict and fresh retry proven
- forced rollback proven atomic
- production-safe synthetic `/api/durable-ingest-test`
- production Test 5 human-run through HTTP
- Test 5 proved commit → replay → changed-request conflict end-to-end
- persisted production-test state remained one scope revision, one request ledger entry, one Run and one Event
- production `postgres.js` JSONB binding bug discovered by Test 5 and fixed without weakening schema constraints
- browser test now surfaces non-JSON server errors rather than hiding them behind JSON parse failures

## Current phase

The main beta uncertainty has moved from infrastructure to usefulness and comprehension.

Human-authored path:

```text
purpose
  → AI influence / agency
  → human roles / decision authority / actions
  → specific-case receipt
  → claims
  → evidence
  → working / public / affected-person views
```

Automated path:

```text
AI framework / OpenTelemetry
  → bounded runtime metadata
  → Run / Event
  → crux-ingest/0.1
  → declared-versus-observed reconciliation
  → observed Trace
  → review-required receipt proposal
```

Durable service path:

```text
authenticated principal
  → authorised producer + scope + capability
  → request-level idempotency
  → pure CRUX semantic ingestion
  → transactional portable bundle + acceptance ledger
```

The next beta work is defined in `docs/BETA_LEARNING_PROTOCOL.md` and centres on three contrasting case shapes:

1. low-consequence productivity (`examples/writing-assistant`);
2. consequential human decision (`examples/funding-review`);
3. bounded agentic action (browser Workflow/runtime path).

For each, test authoring friction, non-author comprehension, disclosure quality and declared-versus-observed interpretation before expanding the schema.

## Still deliberately deferred

These are not prerequisites for the first organisational learning cycle:

- production producer credential/OIDC registration and tenancy resolution
- retention/deletion policy for internal runtime provenance
- asynchronous batching, delivery guarantees and rate limiting
- hosted MCP server
- richer declared-versus-observed checks for action/review-control semantics beyond the current bounded metadata
- accounts/workspaces and broader hosted-product architecture

Those should be designed from pilot evidence rather than speculative infrastructure needs.

## Product boundary

CRUX remains standalone. TOPO, RACK, Ship Check and external evaluation/observability systems are optional context, practice or evidence producers/consumers. None is a CRUX runtime dependency.
