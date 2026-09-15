# CRUX roadmap

**Status:** active  
**Updated:** 15 September 2026

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

The open standard is now independently usable before a hosted product exists.

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

## 0.1-beta — real-world schema pilot · active preparation

The next job is to test comprehension and representational adequacy with 5–8 organisations, not to add speculative product surface.

See `docs/PILOT.md` for the pilot protocol.

Core questions:

- Can a non-author tell where AI is involved and what it does?
- Can they distinguish AI influence from agency and identify final authority?
- Can they distinguish organisational claims from supporting, qualifying or contradictory evidence?
- Can they tell what evidence is current and what system version it applies to?
- Can an affected person understand a consequential receipt without raw sensitive content?
- Are public/affected-person disclosures useful as well as safe?
- Does CRUX remain useful when TOPO, RACK and Ship Check are absent?

Do not expand the schema because participants use different terminology. Add concepts only where the current model cannot faithfully represent something important.

## Phase 1 — standalone transparency product

After the schema pilot, build the guided organisation/workspace, AI-use authoring, system/process explorer, claims/evidence views, evaluation history, disclosure controls, immutable publication and human/machine-readable public pages.

Primary test:

> Can a small organisation document and publish meaningful AI transparency without specialist help?

## Phase 2 — evidence-backed publishing

Build claim/evidence exploration, derived state, freshness, change comparison, evaluation history and deployment records.

Primary test:

> Can a reader distinguish an organisational assertion from evidence supporting or challenging it?

## Phase 3 — provenance and instrumentation

Build the instrumentation API and TypeScript SDK around the existing Run/Event/Trace/Receipt contracts, plus declared-versus-observed comparisons and the regression-case feedback loop. Metadata is captured by default; content capture is explicit.

## Phase 4 — generic evaluation interoperability

Add file/CLI import, REST and webhook ingestion around the neutral `EvidenceEnvelope`, then test provider adapters without embedding vendor semantics in core CRUX contracts.

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
