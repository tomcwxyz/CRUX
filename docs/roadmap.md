# CRUX roadmap

**Status:** active  
**Updated:** 16 September 2026

## Direction

CRUX makes organisational AI use inspectable, evidenced and traceable. It grows from open, portable contracts rather than allowing an early CRUD interface or database schema to define the domain.

Every phase preserves the standalone-first rule: TOPO, RACK, Ship Check and external evaluation tools are optional integrations, never runtime requirements.

## 0.1-alpha.1 — evidence spine · complete

Established `Claim`, `Evidence`, `EvidenceLink`, `EvaluationDefinition`, `EvaluationRun` and a neutral `EvidenceEnvelope`, with strict validation and tests for native and external evidence.

## 0.1-alpha.2 — organisational/process contracts · complete

Established `Organisation`, `AIUse`, `System`, `SystemVersion`, process graphs, components, data sources, human roles, decision points, bounded actions, risks and safeguards.

Influence and agency are orthogonal. Decision authority belongs to individual decision points. Unknown, withheld and supplier-undisclosed information are explicit states. Acceptance was tested against grant review, recruitment, writing support, safeguarding triage and a bounded autonomous support agent.

## 0.1-alpha.3 — evidence resolution and freshness · complete

`packages/core` derives `declared | supported | qualified | contradicted | stale | unknown` without inventing a trust score.

Implemented version/organisational scope, exact/broader/narrower applicability, freshness, conflict preservation, unresolved/inapplicable evidence reporting and disclosure filtering. Narrow evidence cannot over-prove a broad claim; current contradiction is never hidden by newer support.

## 0.1-alpha.4 — traces and receipts · complete

Established metadata-first `Run`, bounded `Event`, causal `Trace`, affected-person `Receipt`, production `Observation`, challenge metadata, consistency validation, privacy-safe projections and proposal-first `EvaluationCase` promotion.

A trace is the causal path relevant to explanation, not a raw observability log. Hidden causal steps are explicitly signalled in derived disclosure views.

## 0.1-alpha.5 — formats and CLI · complete

The open standard is independently usable before a hosted product exists.

Implemented:

- canonical `crux-bundle/0.1` JSON format;
- cross-record reference validation;
- JSON Schema export;
- `crux validate`;
- `crux inspect` with evidence-aware claim state;
- `crux redact` producing a separate `crux-disclosure/0.1` projection;
- `crux schema`;
- explicit versioning/migration policy;
- worked portable examples;
- CI dogfooding of validation, inspection, public/affected-person projection and schema export;
- conservative disclosure handling that preserves external RACK/other evidence targets while hiding references to undisclosed CRUX-owned objects.

Acceptance met: CRUX bundles can be authored, validated, inspected and safely projected without an account or hosted service.

## 0.1-beta — real-world schema + automation pilot · active

The beta has a deliberately thin, file-first pilot surface. It is not the future hosted product architecture: its purpose is to expose the portable contracts to real authors, readers and AI pipelines without introducing a second canonical data model.

Implemented pilot capabilities:

- create and switch between multiple AI uses within one organisation;
- describe purpose, people affected, influence and agency;
- record multiple accountable human roles;
- add decision points with local authority, consequence, AI influence, review-before-effect and challenge information;
- distinguish decisions from bounded actions and describe action initiation, approval, scope and reversibility;
- author claims and attach supporting, qualifying, contradictory or inconclusive evidence;
- derive evidence-aware claim state rather than allowing the UI to declare a stronger status;
- author a metadata-first specific-case receipt as a valid Run → Event → Trace → Receipt chain;
- require explicit human involvement where a manually authored receipt claims human/hybrid final authority;
- inspect working, public and affected-person projections;
- inspect declared-versus-observed provider/model behaviour for the exact SystemVersion in the working lens;
- prevent canonical/disclosure export while an in-progress draft fails schema or reference validation;
- surface questions-to-resolve without creating a score;
- download a structured pilot-session sheet for comparable authoring/comprehension observations;
- use a browser-first `/test` surface for live provider calls, causal workflow provenance, declared-versus-observed reconciliation and transport-boundary testing.

See `docs/PILOT.md`, `docs/PIPELINE_INTEGRATION.md` and `docs/TRANSPORT_DECISION.md`.

### Immediate beta work

The next work should improve CRUX as a learning instrument while turning the accepted runtime/transport contracts into a durable but still provider-neutral service boundary.

1. **Structured organisational dry-runs** — author several real or realistic cases end-to-end, including one genuinely consequential process and one non-consequential productivity use.
2. **Questions to resolve** — test whether missing-transparency prompts are useful and proportionate rather than adding a completeness/trust score.
3. **Non-author comprehension** — test public and affected-person views with people who did not create the record; record misunderstanding as product/schema evidence.
4. **Declared versus observed tension** — browser acceptance now proves provider/model reconciliation; test the same concept with real pilot records and non-authors so divergence is understood as an observation requiring review rather than a trust/safety judgement.
5. **Pipeline integration · contract + live path accepted**
   - ✅ framework-independent metadata-first `@crux/instrumentation` collector;
   - ✅ canonical Run/Event production from observations;
   - ✅ OpenTelemetry GenAI metadata mapping with content-bearing fields ignored by default;
   - ✅ Vercel AI SDK adapter and real `generateText()` lifecycle test;
   - ✅ real external-provider call through Vercel AI Gateway with prompt/output absent from CRUX;
   - ✅ declared-versus-observed reconciliation in `@crux/core`, scoped to the exact SystemVersion;
   - ✅ consequential pipeline dogfood: model → human review → decision → action;
   - ✅ idempotent EvidenceEnvelope ingestion without silent claim linkage;
   - ✅ review-required receipt proposal from an observed causal trace;
   - ✅ browser Workflow test human-accepted;
   - ✅ browser Declared-versus-observed test human-accepted.
6. **Transport contract · accepted**
   - ✅ `@crux/transport` storage-free semantic write boundary;
   - ✅ versioned `crux-ingest/0.1` batch for Run/Event/Observation/EvidenceEnvelope;
   - ✅ exact SystemVersion targeting;
   - ✅ producer identity and per-record acceptance provenance;
   - ✅ idempotent identical replay and same-ID/different-record conflict rejection;
   - ✅ duplicate event-sequence rejection;
   - ✅ default metadata-only content policy with a strict runtime attribute allow-list;
   - ✅ payload and record-count bounds;
   - ✅ EvidenceEnvelope through the same boundary without automatic EvidenceLink creation;
   - ✅ OTLP/HTTP JSON GenAI bridge → existing OTel mapper → same ingestion contract;
   - ✅ OTLP fixture proves input/output message content is excluded;
   - ✅ stateless `/api/ingest-test` route with no persistence;
   - ✅ browser Test 4 demonstrates accept → replay → conflict/policy rejection and OTLP adaptation;
   - ✅ browser Test 4 human-accepted: the direct semantic and OTLP paths were understandable, idempotent replay was visible, stable-ID conflict was rejected, free-text runtime content was rejected, and prompt/output fields remained outside CRUX.
7. **Durable ingress · active** — wrap the accepted transport contract in persistence/auth semantics without changing `crux-ingest/0.1`.
   - ✅ storage abstraction added around the pure ingestion function;
   - ✅ request-level idempotency key is `(scope, producer, request_id)`;
   - ✅ exact request replay returns the original acceptance ledger without a second transaction;
   - ✅ changed payload with a reused request key is a hard conflict;
   - ✅ authenticated principal/context is separate from self-declared `producer.id` provenance;
   - ✅ explicit `runtime:write` and `evidence:write` capabilities;
   - ✅ in-memory reference store for local/CI contract tests;
   - ⬜ choose and implement the first Postgres persistence adapter and migrations;
   - ⬜ producer credential/OIDC model and scope resolution;
   - ⬜ transactional request + acceptance ledger in durable storage;
   - ⬜ retry/concurrency behaviour around revision conflicts;
   - ⬜ retention and deletion policy for internal runtime provenance;
   - ⬜ asynchronous delivery/queue posture for production instrumentation.
8. **Authoring friction** — identify where plain-language authoring needs better scaffolding, examples or terminology before broader persistence/accounts/workspaces work.
9. **Disclosure quality** — test whether redacted views remain genuinely explanatory when internal model, supplier or security details are hidden.

Core questions remain:

- Can a non-author tell where AI is involved and what it does?
- Can they distinguish AI influence from agency and identify final authority?
- Can they distinguish organisational claims from supporting, qualifying or contradictory evidence?
- Can they tell what evidence is current and what system version it applies to?
- Can an affected person understand a consequential receipt without raw sensitive content?
- Are public/affected-person disclosures useful as well as safe?
- Does CRUX remain useful when TOPO, RACK and Ship Check are absent?
- Can technical observations automatically improve CRUX without allowing telemetry to invent organisational meaning?
- Can CRUX receive runtime evidence without becoming a general-purpose observability store or content sink?
- Can durable ingestion preserve the same privacy and organisational-authority boundaries proven by the browser tests?

Do not expand the schema because participants use different terminology. Add concepts only where the current model cannot faithfully represent something important.

## Phase 1 — standalone transparency product

After the schema/transport pilot, build the durable organisation/workspace, AI-use authoring, system/process explorer, claims/evidence views, evaluation history, disclosure controls, immutable publication and human/machine-readable public pages.

Primary test:

> Can a small organisation document and publish meaningful AI transparency without specialist help?

## Phase 2 — evidence-backed publishing

Build claim/evidence exploration, derived state, freshness, change comparison, evaluation history and deployment records.

Primary test:

> Can a reader distinguish an organisational assertion from evidence supporting or challenging it?

## Phase 3 — provenance and supported instrumentation

Turn the validated beta instrumentation and transport packages into supported infrastructure:

- evolve `@crux/instrumentation` as the stable runtime SDK boundary;
- evolve `@crux/transport` as the stable semantic ingestion contract;
- durable HTTP ingestion with batching, transactional idempotency and explicit producer identity/authority;
- OpenTelemetry/OTLP Collector bridge using the proven mapping path;
- framework adapters such as Vercel AI SDK where useful;
- declared-versus-observed comparisons across models, actions and review controls;
- receipt proposal generation;
- regression-case feedback loop.

Metadata is captured by default; content capture remains explicit and opt-in. Runtime collection should normally be observe-only rather than a critical availability dependency.

## Phase 4 — generic evaluation interoperability

Add REST/webhook producer integrations around the proven EvidenceEnvelope + transport boundary without embedding vendor semantics in core CRUX contracts.

Add an optional MCP server as an agent-facing interface over CRUX resources and meaningful low-frequency tools. MCP should not become the canonical high-volume runtime telemetry transport.

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

CRUX constraints may later become **proposed** RACK practice changes, always requiring review. No prompts, personal context or complete Rack projects are required for evidence exchange.

## Phase 6 — optional TOPO adapter

Allow purpose-bound TOPO context to help author CRUX records while keeping personal memory distinct from organisational truth. Any write-back remains proposal-first and governed by TOPO.

## Phase 7 — optional Ship Check adapter

Accept Ship Check findings and assurance as bounded technical evidence. Absence of a finding must never be translated into proof of a broader CRUX claim.

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
