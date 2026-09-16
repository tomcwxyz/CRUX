# @crux/transport

Bounded transport contracts for moving runtime observations and evidence into CRUX without turning CRUX into a general observability backend.

## Status

`0.1.0-beta.0` transport spike.

This package is deliberately storage-free. It proves the write semantics before CRUX chooses durable persistence, authentication or workspace infrastructure.

## The two paths

### Direct CRUX semantic ingestion

Applications that already know they are reporting CRUX concepts should create a `crux-ingest/0.1` batch and pass it to `ingestCruxBatch`.

A batch may contain:

- canonical `Run` records;
- canonical `Event` records;
- canonical `Observation` records;
- portable `EvidenceEnvelope` records.

Runtime records must target one exact `SystemVersion`.

### OpenTelemetry / OTLP bridge

Systems that already emit OpenTelemetry do not need a second full telemetry stack.

`otlpHttpJsonToCruxBatch` accepts an OTLP/HTTP JSON trace payload, selects relevant GenAI spans, maps them through CRUX's existing OpenTelemetry metadata allow-list, and emits the same `crux-ingest/0.1` batch used by direct semantic producers.

The bridge is not an OTLP backend. It does not retain arbitrary traces, logs or span attributes.

## Default runtime policy

The default ingestion boundary is intentionally stricter than the canonical Event schema.

It accepts metadata-only runtime capture and rejects, unless a caller explicitly chooses a broader policy:

- `content_included` or `redacted` Run capture modes;
- `Run.subject_ref`;
- free-text `Event.summary`;
- runtime attribute keys outside the transport allow-list;
- oversized string metadata values.

The default event metadata allow-list is:

```text
finish_reason
provider
request_model
response_model
response_id
input_tokens
output_tokens
total_tokens
tool_call_count
operation
workflow
```

Prompt text, model output, reasoning, retrieved content and tool arguments/results are not transport metadata.

## Idempotency and conflict semantics

Stable IDs are part of the transport contract.

- same ID + identical canonical record → `already_present`;
- same ID + materially different record → conflict;
- a duplicate sequence number within one Run → conflict.

This makes retries safe without allowing a producer to silently rewrite provenance.

## Producer provenance

Every ingestion batch identifies its producer:

```json
{
  "id": "producer:example-app",
  "kind": "application",
  "name": "Example application",
  "version": "1.2.3"
}
```

The current spike returns producer/request provenance in an acceptance ledger. It does not yet persist that ledger. Durable ingestion should store it separately from the canonical Run/Event records rather than mutating observed facts with transport-specific state.

## Evidence

`EvidenceEnvelope` uses the same ingestion boundary but keeps its existing conservative semantics:

- evidence may be imported automatically;
- replay is idempotent;
- conflicting evidence IDs are rejected;
- no `EvidenceLink` is created automatically;
- no organisational claim is silently upgraded because an external test passed.

## Current serverless test surface

The pilot exposes a stateless beta route:

```text
POST /api/ingest-test
```

Request:

```json
{
  "bundle": { "format": "crux-bundle/0.1" },
  "batch": { "format": "crux-ingest/0.1" }
}
```

Response contains the validated updated bundle and per-record acceptance ledger. `persistence` is explicitly `none`.

The browser `/test` surface also contains a transport-boundary demonstration covering first ingestion, replay, stable-ID conflict rejection, default content-policy rejection and OTLP adaptation.

## What does not exist yet

This package does not provide:

- durable persistence;
- API keys, OIDC or producer authorisation;
- organisation/workspace tenancy;
- queues, retries or delivery guarantees;
- rate limiting;
- a general OTLP endpoint;
- a hosted MCP server.

Those should be added only after the transport semantics are accepted.

## Design rule

> Humans declare meaning; systems report behaviour; CRUX reconciles the two.

Transport can establish that a record was observed and delivered. It must not infer organisational purpose, accountability, causal impact, final authority or disclosure policy from telemetry.
