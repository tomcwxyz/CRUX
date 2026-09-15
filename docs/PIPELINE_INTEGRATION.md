# CRUX in AI pipelines

**Status:** architectural direction for `0.1-beta`  
**Updated:** 15 September 2026

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

CRUX should be able to ingest evidence before a version goes live.

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

CRUX may expose whether required evidence exists, is stale, contradicts a claim or belongs to an older version.

CRUX should not be a universal deployment gate by default. Organisations may choose to make particular unresolved CRUX conditions block deployment in their own CI policy.

## 3. Runtime observation

This should be primarily automatic for software-backed systems.

A thin SDK, middleware adapter or telemetry bridge can emit bounded CRUX Run/Event data such as:

- exact SystemVersion;
- provider/model requested;
- provider/model actually used;
- fallback model/provider;
- tool name invoked;
- tool outcome;
- rule evaluated;
- human review event;
- override event;
- decision event;
- action proposed;
- action executed;
- escalation/error;
- timestamps and sequence.

By default CRUX should capture **metadata, not content**.

Prompt text, completions, retrieved documents, tool arguments/results and personal data should remain opt-in rather than being necessary for provenance.

### OpenTelemetry alignment

CRUX should consume or transform existing OpenTelemetry GenAI telemetry where possible instead of creating a parallel low-level observability vocabulary.

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

A future CRUX telemetry bridge should therefore map from existing GenAI spans/events into bounded CRUX events rather than require every application to emit both independently.

### Framework adapters

Framework-specific adapters can improve ergonomics while keeping the core provider-neutral.

Likely early adapters:

- Vercel AI SDK telemetry/lifecycle hooks;
- OpenTelemetry Collector / OTLP;
- OpenAI / Anthropic SDK wrappers only where useful;
- generic HTTP/event emitter.

Adapters depend on CRUX public contracts. CRUX core never depends on a framework adapter.

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

From this, CRUX can create a **receipt proposal**.

For consequential systems, application code may be able to provide the final outcome and authority explicitly. CRUX can then generate most of the receipt automatically.

Where meaning is ambiguous, the generated receipt remains a draft requiring review.

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
- tool invocation name and outcome;
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

The contracts should also remain usable without a CRUX server: local files, CLI pipes and direct library calls remain valid standalone paths.

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

CRUX should surface the divergence without automatically deciding why it happened or whether the system is unethical.

## Recommended implementation sequence

### Beta integration spike

Before building a hosted ingestion service:

1. define a minimal runtime event envelope around existing Run/Event schemas;
2. build an OpenTelemetry-to-CRUX mapping experiment;
3. build one Vercel AI SDK adapter experiment;
4. ingest a CI/eval EvidenceEnvelope automatically;
5. generate a receipt proposal from a real trace;
6. test declared-versus-observed divergence in the pilot viewer.

This should use local files or an in-memory/local endpoint first.

### After the beta proves the contracts

Build:

- `@crux/sdk`;
- HTTP ingestion API;
- batching/idempotency/auth;
- optional OTLP/Collector bridge;
- optional MCP server;
- adapter packages.

The SDK and MCP layers must remain optional. The open bundle and core contracts continue to work independently.

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
