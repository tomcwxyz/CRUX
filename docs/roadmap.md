# CRUX roadmap

**Status:** active  
**Updated:** 15 September 2026

## Direction

CRUX's job is to make organisational AI use inspectable, evidenced and traceable.

The product should grow from a strong open contract rather than allowing an early CRUD interface or database schema to define the domain.

Every phase preserves the standalone-first rule: integrations with TOPO, RACK, Ship Check and external eval tooling are optional enhancements.

## 0.1-alpha.1 — evidence spine · complete

Outcome: establish the smallest useful provider-neutral contracts for claims, evidence and evaluations.

Implemented:

- repository/build baseline aligned with current RACK/Ship Check conventions;
- `Claim` schema;
- `Evidence` schema;
- `EvidenceLink` schema;
- `EvaluationDefinition` schema;
- `EvaluationRun` schema;
- neutral `EvidenceEnvelope`;
- strict runtime validation and inferred TypeScript types;
- tests covering native CRUX evidence and external RACK/Ship Check-style evidence;
- product specification and interoperability rules.

Acceptance met:

- a claim remains distinct from its evidence;
- evidence can support, contradict, qualify or leave a claim inconclusive;
- evaluation definitions are independently versioned from runs;
- external producers use the neutral envelope without depending on CRUX runtime code;
- strict schemas reject undeclared fields.

## 0.1-alpha.2 — organisational/process contracts · complete

Outcome: connect evidence to meaningful AI-mediated processes.

Implemented:

- `Organisation`, `AIUse`, `System` and immutable-addressable `SystemVersion` contracts;
- orthogonal influence and agency taxonomies;
- typed process nodes and validated graph edges;
- components and data sources;
- human roles;
- decision points with per-decision authority;
- bounded actions with explicit approval, scope and reversibility;
- risk/safeguard relationships;
- explicit known/unknown/not-disclosed/withheld states for supplier information;
- local graph-reference validation without a database dependency.

Acceptance met against five distinct schema fixtures:

1. grant application review;
2. recruitment shortlisting with separate AI and human decision points;
3. lightweight internal writing assistant;
4. frontline safeguarding triage;
5. bounded autonomous support agent.

The contracts deliberately keep influence and agency separate and model agent actions independently from decisions.

## 0.1-alpha.3 — evidence resolution and freshness · active

Outcome: derive useful claim state from evidence without inventing a trust score.

Build `packages/core` with:

- applicability rules;
- version scoping;
- freshness/staleness;
- evidence relationship resolution;
- derived statuses: declared/supported/qualified/contradicted/stale/unknown;
- conflict preservation rather than destructive resolution;
- disclosure filtering.

Initial rules:

- a declaration with no linked evidence stays `declared`, not `supported`;
- contradictory current evidence is never hidden by supporting evidence;
- explicit system-version evidence does not silently transfer to another version;
- stale evidence remains inspectable but cannot create a current `supported` state;
- unresolved evidence references are surfaced rather than dropped;
- disclosure filtering produces views without mutating canonical evidence.

Acceptance:

Conflicting evidence remains inspectable and the derived state explains why it exists.

## 0.1-alpha.4 — traces and receipts

Outcome: connect system declarations to what actually happened.

Build:

- Run;
- Event;
- Trace;
- Receipt;
- production Observation;
- challenge/appeal metadata;
- privacy-safe receipt representation;
- regression-case promotion from incident/receipt into evaluation fixtures.

Acceptance:

A specific outcome can point to the exact system version and explain AI contribution, subsequent effect, final authority and challenge route without exposing raw sensitive content.

## 0.1-alpha.5 — formats and CLI

Outcome: make the standard useful before a hosted product exists.

Build:

- portable JSON bundle format;
- JSON Schema generation/export;
- `crux validate`;
- `crux inspect` plain-language summary;
- `crux redact` disclosure-filtered representation;
- stable versioning/migration policy;
- worked examples in the repository.

Acceptance:

An organisation can author conformant CRUX records without creating an account or using a hosted service.

## 0.1-beta — real-world schema pilot

Pilot with 5–8 organisations covering materially different AI uses.

Test comprehension, not form completion.

Can another person correctly answer:

- where is AI involved?
- what does it do?
- what can it influence or action?
- who has authority?
- what claims are being made?
- what evidence exists?
- what evidence is missing/stale/contradictory?
- what happened in a specific case?

Do not expand schema merely because a pilot participant uses different terminology. Add concepts only when the existing model cannot faithfully represent something important.

## Phase 1 — standalone transparency product

Outcome: an organisation using no other Good Ship product gets substantial value.

Build:

- organisation/workspace;
- guided AI-use authoring;
- system/process explorer;
- claims;
- manual evidence/reference attachment;
- evaluation records;
- disclosure controls;
- immutable published versions;
- public organisation AI page;
- human-readable and machine-readable representations.

Primary test:

> Can a small organisation document and publish meaningful AI transparency without specialist help?

## Phase 2 — evidence-backed publishing

Build:

- claim evidence explorer;
- derived claim state;
- evidence freshness;
- change comparisons;
- evaluation history;
- deployment records;
- limitations surfaced alongside results.

Primary test:

> Can a reader distinguish an organisational assertion from the evidence supporting or challenging it?

## Phase 3 — provenance and receipts

Build:

- instrumentation API;
- TypeScript SDK;
- production observations;
- traces;
- individual receipts;
- challenge routes;
- declared-versus-observed comparisons;
- regression-case feedback loop.

Instrumentation captures metadata first. Content capture must always be explicit.

Primary test:

> Can someone affected by an AI-mediated process understand how AI contributed to their outcome?

## Phase 4 — generic evaluation interoperability

Implement generic import before vendor integrations:

- EvidenceEnvelope JSON;
- CLI/file import;
- REST endpoint;
- webhook/event ingestion;
- stable producer and target references.

Then test adapters for useful eval providers without embedding provider semantics in the core schema.

## Phase 5 — optional RACK adapter

First direction:

```text
RACK verification/eval result
        ↓
EvidenceEnvelope
        ↓
CRUX review/import
        ↓
Claim evidence
```

No prompts, personal context or entire Rack projects are required.

Later explore the reverse direction as reviewed propositions:

```text
CRUX system constraint
        ↓
suggested RACK practice
        ↓
accept / edit / reject in RACK
```

## Phase 6 — optional TOPO adapter

Allow purpose-bound TOPO context to help author a CRUX record while keeping memory distinct from organisational truth.

Any write-back to TOPO remains proposal-first and governed by TOPO.

## Phase 7 — optional Ship Check adapter

Accept Ship Check findings/assurance results as bounded technical evidence.

Never translate absence of a finding into proof of a broader CRUX claim.

## Phase 8 — open discovery ecosystem

Publish/discover:

```text
/.well-known/ai-transparency.json
```

Expose open representations for systems, claims, evaluations, evidence and receipts.

Enable use by affected people, researchers, journalists, auditors, procurement teams, regulators and AI agents without requiring the hosted CRUX product.

## Cross-cutting constraints

- CRUX remains standalone.
- Public contracts are provider-neutral.
- Canonical data is versioned and portable.
- Integrations are explicit and bounded.
- No employee-compliance or individual-performance surveillance layer.
- No universal trust/ethics score.
- Unknown and contradictory evidence remains visible.
- Schema changes require deliberate version review.
- Application/database convenience must not dictate the interchange model.
