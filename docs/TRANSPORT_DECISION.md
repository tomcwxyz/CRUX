# CRUX transport decision

**Status:** accepted direction for beta follow-on  
**Date:** 16 September 2026

## Decision

CRUX will use two complementary transport paths rather than choosing between HTTP and OpenTelemetry.

### 1. CRUX HTTP ingestion — canonical semantic boundary

The CRUX HTTP API will carry bounded CRUX concepts directly:

- Runs and Events;
- EvidenceEnvelope records;
- Observations;
- reviewed receipt/trace material;
- explicit organisational annotations such as human review, decision and action references.

This API is the contract for systems that already know they are reporting CRUX semantics.

Illustrative shape:

```text
POST /v1/runs
POST /v1/runs/{run_id}/events
POST /v1/evidence
POST /v1/observations
POST /v1/receipt-proposals
```

The API must support batching, idempotency, authenticated producer identity and explicit system/version targeting. Metadata-only remains the default. Content-bearing fields are not accepted accidentally.

### 2. OTLP / OpenTelemetry bridge — telemetry adaptation boundary

Systems already emitting OpenTelemetry should not need to replace their telemetry stack with a CRUX-specific SDK.

An OTLP/Collector bridge will:

1. receive or observe standard telemetry;
2. apply strict allow-list mapping for relevant GenAI/runtime metadata;
3. discard content-bearing fields by default;
4. map suitable spans/events into CRUX Run/Event/Observation records;
5. preserve source provenance so the resulting CRUX record says what was observed and by which adapter.

OTLP remains a telemetry protocol. CRUX remains the evidence/provenance semantic layer above it.

## Why both

The browser acceptance tests established that CRUX can now use real provider execution to produce bounded runtime evidence while keeping prompts and model outputs outside the CRUX record. They also showed that CRUX can distinguish observed facts from organisational meaning:

- a runtime event can prove that an AI invocation, human review, decision and action occurred;
- it cannot prove what causal effect the AI had, the quality of review, final authority, outcome or challenge route;
- provider/model observations can be reconciled with the exact declared SystemVersion without turning divergence into a trust or safety score.

Those boundaries should survive transport design.

A CRUX-only HTTP API is appropriate when application code deliberately reports a business-semantic event such as a human review or consequential decision. OTLP is appropriate when a system already produces general runtime telemetry and needs translation rather than a second instrumentation stack.

## Non-goals

CRUX will not:

- become a general observability backend;
- ingest all traces/logs simply because they exist;
- require CRUX to be in the critical path of an AI request;
- infer organisational purpose, accountability, impact or disclosure policy from telemetry;
- make MCP the high-volume telemetry protocol.

## MCP

MCP remains an optional agent-facing surface over CRUX resources and low-frequency semantic actions, for example:

```text
crux://systems/{id}
crux://claims/{id}/evidence
crux://receipts/{id}

crux.submit_evidence
crux.record_human_review
crux.record_decision
crux.propose_receipt
```

MCP should sit above the same canonical contracts. It should not define a second ingestion model.

## Reliability and deployment posture

Runtime collection should normally be observe-only and asynchronous. Failure to send telemetry to CRUX should not normally fail the AI workflow itself.

Recommended order:

```text
AI application
   ├── direct CRUX semantic events ──→ CRUX HTTP ingestion
   └── OpenTelemetry ──→ Collector/bridge ──→ CRUX HTTP ingestion

CI / eval / audit tools ──→ EvidenceEnvelope ──→ CRUX HTTP ingestion
```

The HTTP ingestion service therefore becomes the durable write boundary; OTLP adapters and framework SDKs are producers of the same bounded records.

## Next implementation slice

Before persistence/auth/workspaces, build a small transport contract package and test server that proves:

1. batch Run/Event ingestion;
2. idempotent replay;
3. rejection of conflicting same-ID records;
4. exact SystemVersion targeting;
5. producer identity/provenance;
6. size/content allow-lists;
7. EvidenceEnvelope ingestion through the same boundary;
8. an OTLP/HTTP JSON fixture translated through the existing OpenTelemetry adapter into the same ingestion contract.

Only after this local/serverless contract spike should CRUX choose durable storage and authentication infrastructure.

## Acceptance evidence

The beta browser tests completed the prerequisites for this decision:

- real external-provider AI Gateway call with metadata-only CRUX capture;
- prompt and generated response absent from the CRUX snapshot;
- workflow path: AI invocation → human review → decision → action executed;
- receipt proposal generated while explicitly leaving AI effect, review substance, final authority, outcome and challenge unresolved;
- declared provider `gateway` matched observed provider `gateway`;
- declared model `openai/gpt-5-mini` diverged from observed model `anthropic/claude-3-haiku`;
- divergence was presented descriptively rather than as a score or judgement.

This is enough to move from proving the runtime contracts to proving transport and ingestion without changing the core CRUX semantics.
