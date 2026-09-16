# CRUX roadmap

**Status:** active  
**Updated:** 16 September 2026

## Direction

CRUX makes organisational AI use inspectable, evidenced and traceable. It grows from open, portable contracts rather than allowing an early CRUD interface, database schema or observability stack to define the domain.

Every phase preserves the standalone-first rule: TOPO, RACK, Ship Check and external evaluation tools are optional integrations, never runtime requirements.

The operating rule remains:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

## Completed foundations

### 0.1-alpha.1 — evidence spine · complete

Established Claim, Evidence, EvidenceLink, EvaluationDefinition, EvaluationRun and neutral EvidenceEnvelope contracts with strict validation and provider-neutral external evidence.

### 0.1-alpha.2 — organisational/process contracts · complete

Established Organisation, AIUse, System, SystemVersion, process graphs, components, data sources, human roles, decision points, bounded actions, risks and safeguards.

Influence and agency are orthogonal. Decision authority belongs to individual decision points. Unknown, withheld and supplier-undisclosed information are explicit states.

### 0.1-alpha.3 — evidence resolution and freshness · complete

`@crux/core` derives `declared | supported | qualified | contradicted | stale | unknown` without inventing a trust score.

Implemented version/organisational scope, applicability, freshness, conflict preservation, unresolved/inapplicable evidence and disclosure filtering.

### 0.1-alpha.4 — traces and receipts · complete

Established metadata-first Run, bounded Event, causal Trace, affected-person Receipt, production Observation, challenge metadata, consistency validation and proposal-first EvaluationCase promotion.

A Trace is the causal path relevant to explanation, not a raw observability log.

### 0.1-alpha.5 — formats and CLI · complete

Implemented canonical `crux-bundle/0.1`, cross-reference validation, JSON Schema export, `crux validate`, `crux inspect`, `crux redact`, `crux ingest-evidence`, `crux schema`, versioning/migration policy, worked examples and CI dogfooding.

Acceptance met: CRUX bundles can be authored, validated, inspected and safely projected without an account or hosted service.

## 0.1-beta — real-world schema + automation pilot · active

The beta uses a deliberately thin pilot surface to expose the portable contracts to real authors, readers and AI pipelines without introducing a second canonical data model.

### Product/authoring capability

Implemented:

- multiple AI uses per organisation;
- purpose, affected people, influence and agency;
- multiple accountable human roles;
- decision points with local authority, consequence, AI influence, review-before-effect and challenge information;
- bounded actions with initiation, approval, scope and reversibility;
- claim/evidence authoring and derived evidence state;
- metadata-first specific-case receipts;
- working, public and affected-person projections;
- questions-to-resolve without a completeness/trust score;
- canonical/disclosure export only after schema/reference validation;
- structured pilot-session capture.

### Pipeline integration · accepted

Accepted through live tests:

- framework-independent metadata-first `@crux/instrumentation`;
- canonical Run/Event generation;
- Vercel AI SDK lifecycle mapping;
- OpenTelemetry GenAI metadata mapping;
- real external-provider call through Vercel AI Gateway with prompt/output absent from CRUX;
- exact-SystemVersion declared-versus-observed provider/model reconciliation;
- consequential model → human review → decision → bounded action workflow;
- EvidenceEnvelope ingestion without silent claim linkage;
- observed causal trace → review-required receipt proposal;
- browser Workflow and Declared-versus-observed acceptance.

### Transport contract · accepted

Accepted:

- storage-free `@crux/transport` semantic write boundary;
- versioned `crux-ingest/0.1` for Run/Event/Observation/EvidenceEnvelope;
- exact SystemVersion targeting;
- producer provenance and per-record acceptance ledger;
- idempotent identical replay and changed-record conflict rejection;
- duplicate event-sequence rejection;
- strict metadata-only runtime allow-list;
- payload and record-count bounds;
- OTLP/HTTP GenAI bridge into the same semantic contract;
- prompt/output content exclusion regression coverage;
- browser Test 4 human acceptance.

### Durable ingress · accepted beta path

Accepted:

- `DurableIngestStore` abstraction around pure semantic ingestion;
- request idempotency key `(scope_ref, producer_ref, request_id)`;
- exact replay returns the original ledger without a second commit;
- changed payload under a reused request key is rejected;
- authenticated principal is distinct from self-declared producer provenance;
- explicit `runtime:write` / `evidence:write` capabilities;
- optimistic revision semantics;
- driver-neutral `@crux/adapter-postgres` and migration;
- real Neon transaction, reconnect/replay, concurrency and rollback acceptance;
- production-safe synthetic `/api/durable-ingest-test`;
- production Test 5: commit → replay → changed-request conflict;
- production persistence verified as one scope revision, one request ledger row, one Run and one Event;
- `postgres.js` JSONB integration bug exposed by Test 5 and fixed without weakening canonical database constraints.

See `docs/DURABLE_INGRESS.md`.

## Immediate beta work — learning cycle

Durable ingress is no longer the main gate. The highest-value uncertainty is whether CRUX is understandable and useful in realistic organisational situations.

Follow `docs/BETA_LEARNING_PROTOCOL.md`.

### Three anchor case shapes

1. **Low-consequence productivity** — `examples/writing-assistant`.
2. **Consequential human decision** — `examples/funding-review`.
3. **Bounded agentic action** — browser Workflow/runtime path.

### First cycle

Run at least six structured sessions before broad schema change:

- two sessions per case shape;
- at least one non-author reader in each pair;
- at least one affected-person-style reading of the consequential case;
- at least one declared-versus-observed divergence in the bounded-action case.

Test four things consistently:

1. **Authoring friction** — can a domain owner describe the real process without schema expertise?
2. **Non-author comprehension** — can a reader identify AI involvement, authority, evidence, unknowns and challenge routes without coaching?
3. **Disclosure quality** — do public/affected-person projections remain explanatory after redaction?
4. **Declared-versus-observed interpretation** — can people distinguish organisational declarations, technical observations and divergences requiring review?

Do not collapse results into a single trust or completeness score. Preserve question-level misunderstanding and disagreement.

### Change order

Prefer changes in this order:

1. explanatory copy;
2. authoring scaffolding/examples;
3. disclosure projection;
4. derived interpretation in `@crux/core`;
5. canonical schema change only where the current model cannot faithfully represent something important.

Do not broaden telemetry to solve an authoring problem. Do not duplicate safely observable technical facts as mandatory manual fields.

## Beta questions to answer

- Can a non-author tell where AI is involved and what it does?
- Can they distinguish AI influence from agency and identify final authority?
- Can they distinguish organisational claims from supporting, qualifying or contradictory evidence?
- Can they tell what evidence is current and what system version it applies to?
- Can an affected person understand a consequential receipt without raw sensitive content?
- Are public/affected-person disclosures useful as well as safe?
- Does CRUX remain useful when TOPO, RACK and Ship Check are absent?
- Can technical observations improve CRUX without allowing telemetry to invent organisational meaning?
- Can CRUX receive runtime evidence without becoming a general-purpose observability store or content sink?

## Deliberately deferred infrastructure

The following matter before a broader hosted production service, but are not prerequisites for the first organisational learning cycle:

- production producer credential/OIDC registration;
- organisation/workspace tenancy resolution;
- retention and deletion policy for internal runtime provenance;
- asynchronous batching/delivery guarantees and rate limiting;
- hosted MCP server;
- richer action/review-control reconciliation beyond current bounded provider/model observations;
- accounts/workspaces and application-oriented query projections.

Build these when pilot evidence requires them, not because they are conventional platform features.

## Phase 1 — standalone guided transparency product

After the learning cycle, build only the guided organisation/workspace, AI-use authoring, system/process explorer, claims/evidence views, evaluation history, disclosure controls, publication and human/machine-readable public pages that the pilot shows are genuinely needed.

Primary test:

> Can a small organisation document and publish meaningful AI transparency without specialist help?

## Phase 2 — evidence-backed publishing

Strengthen claim/evidence exploration, freshness, change comparison, evaluation history and deployment records.

Primary test:

> Can a reader distinguish an organisational assertion from evidence supporting or challenging it?

## Phase 3 — supported provenance/instrumentation

Turn the validated beta packages into supported infrastructure:

- stabilise `@crux/instrumentation` as the runtime SDK boundary;
- stabilise `@crux/transport` as the semantic ingestion contract;
- durable HTTP ingestion with explicit producer identity/authority;
- OpenTelemetry/OTLP Collector bridge using the proven mapping path;
- framework adapters where useful;
- declared-versus-observed comparisons beyond provider/model where the semantics are trustworthy;
- receipt proposal generation and regression-case feedback.

Metadata remains the default; content capture is explicit and opt-in. Runtime collection should normally be observe-only and failure-independent.

## Phase 4 — generic evaluation interoperability

Add REST/webhook producer integrations around the proven EvidenceEnvelope + transport boundary without embedding vendor semantics in core CRUX contracts.

Add optional MCP as an agent-facing interface for CRUX resources and meaningful low-frequency tools. MCP must not become the canonical high-volume telemetry transport.

## Phase 5 — optional RACK adapter

```text
RACK verification/eval result
        ↓
EvidenceEnvelope
        ↓
CRUX review/import
        ↓
Claim evidence
```

CRUX constraints may later become **proposed** RACK practice changes, always requiring review.

## Phase 6 — optional TOPO adapter

Allow purpose-bound TOPO context to help author CRUX records while keeping personal memory distinct from organisational truth. Any write-back remains proposal-first and governed by TOPO.

## Phase 7 — optional Ship Check adapter

Accept Ship Check findings as bounded technical evidence. Absence of a finding must never be translated into proof of a broader CRUX claim.

## Phase 8 — open discovery ecosystem

Publish/discover `/.well-known/ai-transparency.json` and open representations for systems, claims, evaluations, evidence and receipts for affected people, researchers, journalists, auditors, procurement teams, regulators and AI agents.

## Cross-cutting constraints

- CRUX remains standalone.
- Public contracts are provider-neutral.
- Canonical data is versioned and portable.
- Integrations are explicit and bounded.
- No employee-compliance or individual-performance surveillance layer.
- No universal trust/ethics score.
- Unknown and contradictory evidence remains visible.
- Schema changes require deliberate version review.
- Application/database convenience must not dictate interchange contracts.
- Runtime automation may report behaviour but may not silently define organisational purpose, accountability or disclosure policy.
- Transport failures should not normally fail the AI workflow itself.
- Self-declared producer provenance is not authentication; durable services must authorise the authenticated principal separately.
