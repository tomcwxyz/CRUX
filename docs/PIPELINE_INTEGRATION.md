# CRUX in AI pipelines

**Status:** active `0.1-beta` integration spike  
**Updated:** 16 September 2026

CRUX should not become a manually maintained AI register that drifts away from production reality.

Its long-term role is to connect three kinds of truth:

```text
DECLARED
what the organisation says should happen

OBSERVED
what the software actually did

EVIDENCED
what testing, evaluation and review tell us about it
```

The operating principle is:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

Manual authoring remains important because instrumentation cannot reliably infer organisational purpose, consequence, accountability, challenge routes or what should be publicly disclosed. Automation is important because people should not have to manually record model versions, eval runs, tool invocations or every execution trace.

## Current beta implementation

`packages/instrumentation` provides the first runtime implementation of this design on the `beta/pipeline-instrumentation` branch, while the semantics of declared-versus-observed reconciliation now live in `@crux/core`.

The beta path currently proves that:

1. a live process can create canonical CRUX Run/Event records without a CRUX server;
2. Vercel AI SDK step metadata can be mapped into a bounded `ai_invocation` event without importing the AI SDK into CRUX canonical/core contracts;
3. an actual AI SDK `generateText()` lifecycle can feed CRUX through `onStepFinish` using the SDK's mock model, while prompt and generated content stay out of the CRUX snapshot;
4. OpenTelemetry GenAI metadata can be mapped through a strict allow-list while content-bearing input/output attributes are ignored;
5. observed model/provider metadata can be compared with the exact declared SystemVersion and surfaced as match/divergence without mutating either side;
6. a CI/eval `EvidenceEnvelope` can be imported idempotently into a portable CRUX bundle without automatically creating a claim relationship;
7. an observed causal event path can become a review-required receipt proposal without inventing organisational outcome, final authority, challenge route or the actual effect of AI;
8. the pilot can show declared-versus-observed provider/model behaviour in the working/internal lens using the same core reconciliation semantics.

The package remains deliberately transport-free. The remaining beta integration acceptance step is one smoke test against a real external model provider with content capture still disabled. HTTP/OTLP ingestion, batching, authentication and idempotency come after that test rather than before it.

## Where CRUX sits

CRUX can participate at four different moments without becoming the application runtime.

```text
DESIGN / AUTHORING
      ↓
SYSTEM VERSION + CLAIMS + AUTHORITY
      ↓
CI / PRE-DEPLOYMENT
      ↓
EVAL + ASSURANCE EVIDENCE
      ↓
DEPLOYMENT
      ↓
RUNTIME OBSERVATION
      ↓
RUNS + EVENTS + TRACES
      ↓
OUTCOME
      ↓
RECEIPT + OBSERVATION + LEARNING
```

Each integration is optional. A system can use CRUX only for public transparency, only for eval evidence, only for runtime provenance, or across the whole lifecycle.

## 1. Design and authoring

This is the human-led layer.

CRUX records or reviews:

- why AI is being used;
- who is affected;
- whether the workflow is consequential;
- AI influence and agency;
- human roles;
- decision authority;
- permitted actions and boundaries;
- risks and safeguards;
- challenge routes;
- organisational claims;
- disclosure decisions.

Automation may **suggest** these values from code, RACK practice, existing documentation or observed traces, but should not silently make them organisational truth.

A checked-in manifest may eventually make this layer easier for software-backed systems, for example:

```text
crux.system.json
```

That file would reference a stable CRUX System/SystemVersion and selected declared controls, without replacing the canonical organisational record.

## 2. CI and pre-deployment

CRUX can now ingest portable evidence before a version goes live.

Examples:

- evaluation suite results;
- RACK verification results;
- Ship Check findings;
- red-team results;
- human review studies;
- regression test results;
- deployment artefact/version identifiers.

These arrive through the neutral EvidenceEnvelope rather than provider-specific CRUX fields.

```text
CI / eval tool / RACK / Ship Check
             ↓
       EvidenceEnvelope
             ↓
      CRUX import/review
             ↓
 Claim ↔ evidence ↔ SystemVersion
```

The beta file/CLI path is deliberately conservative: `crux ingest-evidence` adds the evidence record, validates internal targets and treats exact replay as idempotent. It does **not** silently create an `EvidenceLink` or upgrade a claim because an external test passed. Claim/evidence relationship remains an explicit reviewed act.

CRUX may expose whether required evidence exists, is stale, contradicts a claim or belongs to an older version.

CRUX should not be a universal deployment gate by default. Organisations may choose to make particular unresolved CRUX conditions block deployment in their own CI policy.

## 3. Runtime observation

This should be primarily automatic for software-backed systems.

A thin SDK, middleware adapter or telemetry bridge can emit bounded CRUX Run/Event data such as:

- exact SystemVersion;
- provider/model requested;
- provider/model actually used;
- fallback model/provider;
- tool name invoked where that metadata is safe and useful;
- tool/action outcome;
- rule evaluated;
- human review event;
- override event;
- decision event;
- action proposed;
- action executed;
- escalation/error;
- timestamps and sequence.

By default CRUX captures **metadata, not content**.

Prompt text, completions, retrieved documents, reasoning, tool arguments/results and personal data are not necessary for provenance and remain opt-in rather than default capture.

### OpenTelemetry alignment

CRUX consumes or transforms existing OpenTelemetry GenAI telemetry where possible instead of creating a parallel low-level observability vocabulary.

OpenTelemetry is useful for technical observation. CRUX adds the organisational layer that ordinary telemetry does not know about:

```text
OpenTelemetry span
model X called tool Y
        ↓
CRUX mapping
this event belonged to SystemVersion 2.3,
informed eligibility Decision A,
and is relevant to Claim B
```

The beta mapper allow-lists metadata such as operation name, provider, request/response model, response ID, token counts, finish reason and workflow name. It deliberately drops GenAI input/output message content.

### Framework adapters

Framework-specific adapters improve ergonomics while keeping the canonical model provider-neutral.

The AI SDK integration is structural: CRUX does not make the AI SDK a canonical dependency. The beta now exercises the adapter through the actual `generateText()`/`onStepFinish` lifecycle using the SDK's mock model. That proves the framework callback contract and privacy boundary; it is intentionally distinct from the remaining external-provider smoke test.

Likely later adapters:

- OpenTelemetry Collector / OTLP;
- richer Vercel AI SDK integration if needed by real pipelines;
- OpenAI / Anthropic SDK wrappers only where useful;
- generic HTTP/event exporter.

Adapters report observations. `@crux/core` owns the semantics of comparing those observations with declarations.

## 4. Outcome, receipt and learning

Technical traces are not automatically meaningful explanations.

CRUX selects or builds the causal path that matters:

```text
AI invocation
      ↓
recommendation
      ↓
human review
      ↓
decision
      ↓
action
```

The beta now produces a portable **`crux-receipt-proposal/0.1`** from that observed path. It can safely state bounded facts such as how many AI invocations, human review events, decisions, actions or escalations were observed, and it can construct a causal Trace from event references.

It deliberately does not fill a canonical Receipt simply to satisfy the schema. The proposal leaves questions to resolve for:

- AI's organisational role/influence in the case;
- what actually happened because of the AI output;
- substance of human review;
- final authority;
- actual outcome;
- challenge/appeal/correction route.

For consequential systems, application code may later provide some of these values explicitly. CRUX can then make receipt completion easier while preserving review and provenance.

Production observations can also become evidence:

```text
override rate
model fallback rate
escalation rate
action failure rate
challenge rate
```

Unexpected cases can become proposed evaluation/regression cases, preserving the proposal-first learning rule.

## What can be automated safely?

### Good automatic candidates

- system/deployment version;
- model/provider actually used;
- model/provider fallback;
- timestamps;
- selected tool invocation metadata;
- action execution status;
- eval/evaluation results;
- Ship Check/RACK/CI evidence;
- runtime event sequence;
- aggregate observations;
- technical provenance;
- candidate receipt traces.

### Better as explicit application annotations

- a business decision occurred;
- this action was consequential;
- this role had final authority;
- human review actually occurred;
- this event maps to a particular process node or decision point.

These can still be emitted automatically by the application once developers deliberately annotate the relevant business logic.

### Human-authored or human-approved

- organisational purpose;
- people affected;
- consequence interpretation;
- accountability/responsibility;
- acceptable action boundaries;
- public claims;
- challenge/appeal routes;
- disclosure level;
- whether evidence is sufficient for an organisational assertion;
- publication of significant changes.

CRUX may draft these, but should not silently publish them.

## API before MCP

The canonical machine integration should be a small transport-neutral API/event contract.

Illustrative future endpoints:

```text
POST /v1/evidence
POST /v1/runs
POST /v1/runs/{run}/events
POST /v1/observations
POST /v1/receipt-proposals

GET  /v1/system-versions/{id}
GET  /v1/claims/{id}
GET  /v1/receipts/{id}
```

High-volume runtime telemetry should support batching and idempotency.

The contracts also remain usable without a CRUX server: local files, CLI pipes and direct library calls are valid standalone paths. The beta instrumentation package and EvidenceEnvelope CLI import prove those standalone paths first.

## MCP

MCP is useful, but for a different reason.

CRUX should eventually expose an optional MCP server as an **agent-facing interface over the same API/contracts**, not as the core runtime telemetry transport.

### Useful CRUX MCP resources

```text
crux://organisations/{id}/ai-uses
crux://systems/{id}
crux://system-versions/{id}
crux://claims/{id}/evidence
crux://receipts/{id}
```

This would let an authorised agent ask:

- What is this system allowed to do?
- Who has final authority here?
- Which claims are supported or contradicted?
- What version is current?
- What transparency should I show the affected person?

### Useful CRUX MCP tools

Low-frequency, meaningful operations could include:

```text
crux.validate_evidence
crux.submit_evidence
crux.propose_receipt
crux.record_human_review
crux.record_decision
crux.record_action
```

Write tools should preserve explicit identity/authority and CRUX validation rules.

MCP is less suitable for every token/model/tool telemetry event in a high-volume production pipeline. That belongs in SDK/API/OTel-style instrumentation.

## Declared versus observed

This is one of CRUX's most valuable automated uses.

Example:

```text
DECLARED
SystemVersion 2.3 uses Model A only

OBSERVED
4% of production calls used fallback Model B

CRUX
Published system description differs from observed behaviour
```

Or:

```text
DECLARED
Every rejection is reviewed by a human before effect

OBSERVED
2 production traces show action execution with no preceding human_review event

CRUX
Claim contradicted by observed production evidence
```

The beta implements the first comparison at event level for declared provider/model versus observed provider/model. Reconciliation lives in `@crux/core`, and the pilot scopes observations through Runs to the exact SystemVersion before comparing them. `examples/observed-divergence/crux.json` is a validated portable fixture for this behaviour.

The pilot currently exposes this metadata only in the working/internal lens. Public or affected-person publication of observed runtime metadata should be a deliberate disclosure decision rather than an accidental consequence of instrumentation.

Review/action-control comparison remains a later spike.

CRUX surfaces divergence without automatically deciding why it happened or whether the system is unethical.

## Runtime availability boundary

CRUX instrumentation can be **inline without being in the critical path**.

The preferred starting mode is observe-only:

```text
AI application ─────────────→ user outcome
      │
      └── bounded metadata ─→ CRUX
```

A CRUX transport failure should not normally stop the AI application from serving its user. Organisations may separately decide that specific evidence or verification requirements should gate CI/deployment.

## Recommended implementation sequence

### Beta integration spike

Before building a hosted ingestion service:

- ✅ define a minimal runtime collection layer around existing Run/Event schemas;
- ✅ map OpenTelemetry GenAI metadata into CRUX;
- ✅ map and exercise the Vercel AI SDK callback lifecycle using a mock model;
- ✅ detect basic declared-versus-observed provider/model divergence using core semantics;
- ✅ ingest and replay a CI/eval EvidenceEnvelope automatically without silent claim linkage;
- ✅ generate a review-required receipt proposal from an observed causal trace;
- ✅ display exact-version declared-versus-observed divergence in the pilot working lens;
- ⬜ run one metadata-only smoke test against a real external model provider.

This uses local/in-memory/file records first.

### After the external-provider smoke test

Decide from the observed integration needs, rather than assuming transport shape, then build the minimum useful combination of:

- HTTP ingestion API/exporter around the proven instrumentation model;
- batching/idempotency/auth;
- optional OTLP/Collector bridge;
- optional framework-specific adapter packages;
- optional MCP server.

The SDK/API and MCP layers remain optional. The open bundle and core contracts continue to work independently.

## Architectural assertion

CRUX should not ask people to manually maintain facts that software can observe.

And CRUX should not let software invent organisational meaning it cannot know.

The product becomes strongest when these meet:

```text
what we intended
      ↕
what we tested
      ↕
what actually ran
      ↕
what happened to a person
```
