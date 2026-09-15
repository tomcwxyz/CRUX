# CRUX roadmap

**Status:** active  
**Updated:** 15 September 2026

## Direction

CRUX makes organisational AI use inspectable, evidenced and traceable. It grows from open, portable contracts rather than allowing an early CRUD interface or database schema to define the domain.

Every phase preserves the standalone-first rule: TOPO, RACK, Ship Check and external evaluation tools are optional integrations, never runtime requirements.

## 0.1-alpha.1 — evidence spine · complete

Established `Claim`, `Evidence`, `EvidenceLink`, `EvaluationDefinition`, `EvaluationRun` and a neutral `EvidenceEnvelope`, with strict runtime validation and tests for native and external evidence.

Acceptance met: declarations remain distinct from evidence; evidence can support, contradict, qualify or remain inconclusive; evaluation definitions are independently versioned from runs; external producers do not need CRUX runtime code.

## 0.1-alpha.2 — organisational/process contracts · complete

Established `Organisation`, `AIUse`, `System`, `SystemVersion`, process graphs, components, data sources, human roles, decision points, bounded actions, risks and safeguards.

Influence and agency are orthogonal. Decision authority belongs to individual decision points. Unknown, withheld and supplier-undisclosed information are explicit states.

Acceptance met against five different workflows: grant review, recruitment shortlisting, internal writing support, safeguarding triage and a bounded autonomous support agent.

## 0.1-alpha.3 — evidence resolution and freshness · complete

`packages/core` now derives `declared | supported | qualified | contradicted | stale | unknown` without inventing a trust score.

Implemented:

- version and organisational scope resolution;
- exact, broader, narrower, unrelated and version-mismatch evidence scopes;
- freshness and claim review windows;
- narrower supporting evidence qualifies rather than over-claims;
- contradictory current evidence is preserved even when newer support exists;
- stale evidence remains inspectable without controlling current status;
- unresolved and inapplicable evidence is surfaced;
- disclosure-filtered views do not mutate canonical evidence.

Acceptance met: conflicting evidence remains inspectable and the resolution explains why the current state exists.

## 0.1-alpha.4 — traces and receipts · complete

Established metadata-first provenance without turning CRUX into a raw observability store.

Implemented:

- `Run`;
- bounded `Event` metadata;
- causal `Trace` selection;
- affected-person `Receipt`;
- production `Observation`;
- challenge/appeal metadata;
- run/event/trace/receipt consistency validation;
- privacy-safe public and affected-person projections;
- explicit indication when hidden steps make visible causal context incomplete;
- proposal-first `EvaluationCase` promotion from receipts/incidents rather than automatic learning.

Acceptance met: a specific outcome can point to an exact immutable system version and explain AI contribution, subsequent effect, final authority and challenge route without requiring raw sensitive content.

## 0.1-alpha.5 — formats and CLI · active

Outcome: make the standard independently useful before a hosted product exists.

Implemented:

- canonical `crux-bundle/0.1` JSON format;
- cross-record reference validation;
- JSON Schema export;
- `crux validate`;
- `crux inspect` with evidence-aware claim state;
- `crux redact` producing an explicit `crux-disclosure/0.1` projection rather than pretending a filtered record is canonical;
- `crux schema`;
- versioning/migration policy;
- portable worked examples.

Current hardening:

- dogfood CLI operations in CI against repository examples;
- expand example coverage where it exposes genuine schema gaps;
- add migration fixtures only when a second bundle/schema version exists;
- keep disclosure projection conservative for objects that do not yet carry their own disclosure metadata.

Acceptance target:

> An organisation can author, validate, inspect and create a safe disclosure projection from a conformant CRUX record without creating an account or using a hosted service.

## 0.1-beta — real-world schema pilot

Pilot with 5–8 organisations covering materially different AI uses. Test comprehension rather than form completion.

Can another person correctly answer:

- where is AI involved?
- what does it do?
- what can it influence or action?
- who has authority?
- what claims are being made?
- what evidence exists, and what is missing/stale/contradictory?
- what happened in a specific case?

Do not expand schema merely because participants use different terminology. Add concepts only where the current model cannot faithfully represent something important.

## Phase 1 — standalone transparency product

Build an organisation/workspace, guided AI-use authoring, system/process explorer, claims/evidence, evaluation records, disclosure controls, immutable publication and human/machine-readable public pages.

Primary test:

> Can a small organisation document and publish meaningful AI transparency without specialist help?

## Phase 2 — evidence-backed publishing

Build claim/evidence exploration, derived state, freshness, change comparison, evaluation history and deployment records.

Primary test:

> Can a reader distinguish an organisational assertion from evidence supporting or challenging it?

## Phase 3 — provenance and instrumentation

Build the instrumentation API and TypeScript SDK around the existing Run/Event/Trace/Receipt contracts, plus declared-versus-observed comparisons and the regression-case feedback loop.

Metadata is captured by default. Content capture must always be explicit.

## Phase 4 — generic evaluation interoperability

Add file/CLI import, REST and webhook/event ingestion around the existing neutral `EvidenceEnvelope`, then test useful provider adapters without embedding vendor semantics in core CRUX contracts.

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

Later, CRUX constraints may become **proposed** RACK practice changes, always requiring review. No prompts, personal context or complete Rack projects are required for the evidence path.

## Phase 6 — optional TOPO adapter

Allow purpose-bound TOPO context to help author CRUX records while keeping personal memory distinct from organisational truth. Any write-back remains proposal-first and governed by TOPO.

## Phase 7 — optional Ship Check adapter

Accept Ship Check findings and assurance results as bounded technical evidence. Absence of a finding must never be translated into proof of a broader CRUX claim.

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
