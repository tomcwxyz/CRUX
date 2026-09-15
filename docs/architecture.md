# CRUX architecture

**Status:** initial direction  
**Updated:** 15 September 2026

## Boundary

CRUX is a standalone evidence and provenance product for organisational AI.

Its core question is:

> Where is AI being used, what claims are being made about it, what evidence supports or challenges those claims, and what actually happened when it operated?

CRUX does not require TOPO, RACK, Ship Check or any other Good Ship product.

## Sibling boundaries

```text
TOPO
what may AI know?
context · memory · provenance · selective disclosure

RACK
how should AI work?
practice · boundaries · set-ups · verification

CRUX
where is AI used and what actually happened?
uses · systems · claims · evidence · evals · traces · receipts

Ship Check
what implementation evidence can be independently observed?
repository checks · findings · assurance · repair guidance
```

The products are complementary but non-hierarchical.

## Hard interoperability rules

1. **Standalone value** — every product must complete its core workflow with all sibling products absent.
2. **Canonical ownership** — CRUX owns organisational AI declarations, claims, evidence relationships, versions, traces and receipts. It does not use another product's store as canonical state.
3. **Portable contracts** — integrations use versioned files, APIs or small interchange envelopes, not another product's internal persistence model.
4. **Proposals, not mutation** — CRUX may suggest RACK practice; RACK may suggest a transparency constraint; TOPO may provide authoring context. None may silently mutate another product's canonical state.
5. **Minimal disclosure** — integrations exchange only what is required. Prompts, conversations, personal memory and full projects do not travel merely because an evidence result does.
6. **Provenance travels** — imported evidence retains producer, version, timestamp, scope and stable references.
7. **No implied authority** — external evidence may support, contradict, qualify or leave a claim unresolved. The producer does not become the authority for CRUX truth.
8. **Failure independence** — an unavailable integration falls back to standalone CRUX behaviour.

## Engineering baseline

CRUX follows the current sibling build preference where it helps consistency:

- Node.js 22.12+;
- pnpm 10.15;
- TypeScript 5.9;
- Zod 4 runtime contracts;
- Vitest for package tests;
- Turbo for workspace orchestration;
- ESM packages;
- strict runtime schemas and explicit version fields;
- package boundaries before application coupling.

The schema package is the first canonical implementation surface. Application/database choices should follow the schema rather than define it.

## Evidence spine

The initial neutral contracts are:

```text
Claim
  ↕
EvidenceLink
  ↓
Evidence
  ↑
EvaluationRun
  ↑
EvaluationDefinition

External producer
  ↓
EvidenceEnvelope
  ↓
CRUX import/review
```

An `EvidenceEnvelope` is intentionally neutral. It can be emitted by RACK, Ship Check, a CI job, an eval platform, a human audit or a bespoke script.

CRUX-specific claim linking may be added on import, but an external evidence producer is not required to know CRUX internals.

## TOPO

TOPO may optionally supply purpose-bound context while someone documents a system. That context is source material, not automatically published truth. Any learning written back to TOPO must pass through TOPO's own authority/review model.

## RACK

RACK may optionally provide bounded verification/evaluation evidence against a practice or constraint. CRUX consumes the neutral evidence result, not the whole Rack, prompts, user context or personal adaptations.

CRUX may surface a system constraint that could become RACK practice, but the change remains a reviewed proposition inside RACK.

## Ship Check

Ship Check may optionally emit bounded assurance evidence about implementation. A clean Ship Check result does not certify a CRUX claim; it contributes evidence scoped to the checks actually performed.

## Evals

CRUX is not intended to replace specialist eval systems. It gives evaluations a first-class place in organisational transparency:

```text
what we say
    ↓
claims
    ↓
what we tested
    ↓
evaluations
    ↓
what we observed
    ↓
production evidence
    ↓
what happened here
    ↓
trace / receipt
```

The same evaluation definition can be run repeatedly against multiple system versions. Evaluation evidence is time- and version-scoped.

## CRUX inside AI pipelines

CRUX should not become a manually maintained register that drifts away from production reality.

Its operating principle is:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

CRUX can participate at four moments:

```text
Design / authoring
      ↓
SystemVersion + claims + authority
      ↓
CI / pre-deployment
      ↓
Eval + assurance evidence
      ↓
Runtime
      ↓
Runs + events + observed behaviour
      ↓
Outcome
      ↓
Trace + receipt + learning
```

Human-authored or human-approved fields remain appropriate for organisational purpose, people affected, consequence interpretation, accountability, action boundaries, claims, challenge routes and disclosure choices.

Software-backed systems should be able to provide model/provider identity, actual fallback usage, tool/action execution, eval results, version/deployment identifiers, timestamps and runtime provenance automatically.

CRUX should consume existing GenAI observability where possible rather than create a competing raw telemetry layer. OpenTelemetry-style instrumentation can describe technical operations; CRUX maps those operations to organisational SystemVersions, process nodes, decisions, claims and receipts.

The canonical machine integration should therefore be API/event contracts first. High-volume runtime events belong in an SDK/API/telemetry bridge rather than MCP.

MCP is an optional agent-facing interface over the same contracts: useful for reading current system transparency, evidence and receipts, and for low-frequency tools such as submitting evidence or explicitly recording a human review/decision. It is not the canonical persistence or telemetry protocol.

See `docs/PIPELINE_INTEGRATION.md` for the detailed design and implementation sequence.

## Future application shape

Later packages should retain these separations:

- `packages/schemas` — canonical interchange/runtime contracts;
- `packages/core` — claim/evidence resolution, status derivation, versioning and disclosure policy;
- `packages/formats` — portable import/export and public representations;
- `packages/cli` — validate, inspect and redact workflows;
- `apps/web` or equivalent — guided authoring and public publishing;
- `packages/sdk` — optional runtime/event instrumentation after beta validation;
- optional adapters — OpenTelemetry, Vercel AI SDK, RACK, TOPO, Ship Check and generic eval providers;
- optional MCP server — an agent-facing view/tool layer over public CRUX contracts.

Adapters should depend on public contracts, never the other way round.
