# CRUX durable ingress design

**Status:** active beta implementation  
**Date:** 16 September 2026

## Purpose

The browser and transport acceptance tests established the semantic boundary CRUX needs. Durable ingress now adds restart-safe persistence, producer authorisation and transactional request handling **around** `crux-ingest/0.1` without changing what the transport contract means.

The governing rule remains:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

Storage and authentication must not weaken that distinction.

## Accepted prerequisite

Browser Test 4 demonstrated and was human-accepted with the following behaviour:

- a metadata-only Run/Event batch was accepted;
- exact replay returned `already_present` rather than duplicating records;
- the same stable record ID with changed content was rejected;
- a free-text runtime summary was rejected at the default boundary;
- OTLP-derived GenAI telemetry entered through the same semantic contract;
- synthetic input/output message content was absent from the CRUX record.

That is the contract durable infrastructure must preserve.

## Authentication is not producer provenance

A batch includes:

```text
producer.id
producer.kind
producer.name
producer.version
```

Those fields say **who the batch claims produced the observation**. They are provenance, not proof of identity.

A hosted CRUX service therefore needs a separate authenticated context:

```text
authenticated principal
        ↓
authorised producer identities
        ↓
authorised organisation/scope
        ↓
capabilities
  ├ runtime:write
  └ evidence:write
        ↓
crux-ingest/0.1
```

The first service-layer implementation encodes this separation explicitly. A principal cannot ingest simply by putting an allowed-looking `producer.id` inside JSON.

## Request-level idempotency

Record-level idempotency is not sufficient for a durable HTTP service. Retries can happen after a transaction commits but before the producer receives the response.

The durable request key is:

```text
(scope_ref, producer_ref, request_id)
```

Rules:

1. first bounded batch with that key commits normally;
2. an exact replay returns the original acceptance ledger without creating another transaction;
3. the same key with a materially changed batch is rejected as an idempotency conflict;
4. a different request ID containing records already present may commit a new request ledger entry while the individual records remain `already_present`;
5. request idempotency is separate from canonical CRUX record identity.

`@crux/transport` now contains a storage abstraction and an in-memory reference implementation proving these semantics.

## Scope and tenancy

`scope_ref` is service context, not part of the public CRUX bundle schema or `crux-ingest/0.1` batch.

That is deliberate. A deployment may define a scope as an organisation, workspace, installation or another tenancy boundary without changing portable CRUX data.

The authenticated service resolves:

```text
credential / OIDC principal
        ↓
scope_ref
        ↓
which SystemVersions are writable
```

The batch still has to target the exact canonical `SystemVersion` for runtime records.

## First persistence shape

The first Postgres adapter should optimise for correctness and portability rather than application-query convenience.

### `crux_scopes`

Stores one validated portable canonical bundle per service scope plus an optimistic revision number.

Suggested fields:

```text
scope_ref         text primary key
bundle            jsonb not null
revision          bigint not null default 0
created_at        timestamptz not null
updated_at        timestamptz not null
```

### `crux_ingest_requests`

Durable request/idempotency ledger.

```text
scope_ref         text not null
producer_ref      text not null
request_id        text not null
principal_ref     text not null
canonical_batch   jsonb not null
accepted_at       timestamptz not null
revision_after    bigint not null
primary key (scope_ref, producer_ref, request_id)
```

### `crux_ingest_acceptances`

Per-record provenance returned by the semantic ingestion function.

```text
scope_ref         text not null
producer_ref      text not null
request_id        text not null
record_kind       text not null
record_id         text not null
status            text not null
accepted_at       timestamptz not null
```

The initial adapter may store the canonical bundle as JSONB rather than normalising every CRUX domain object. That prevents the database schema from becoming a second domain model before the beta contracts have stabilised.

Read-optimised projections or normalised indexes can be added later without changing the portable contract.

## Transaction

A durable commit should behave approximately as:

```text
BEGIN

1. authorise principal → producer → scope/capability
2. check (scope, producer, request_id)
   ├ same request + same bounded batch → return stored result
   └ same request + changed batch → reject
3. read/lock scope revision + canonical bundle
4. apply pure ingestCruxBatch(...)
5. persist updated validated bundle
6. increment scope revision
7. persist request ledger
8. persist per-record acceptance ledger

COMMIT
```

An optimistic implementation may compute the pure ingestion result outside the transaction, then perform an atomic compare-and-swap on `revision`. A revision conflict must retry from the latest canonical state; it must never overwrite another accepted batch.

## Why portable bundle JSONB first

This is intentionally not the final analytics/query model.

Advantages during beta:

- one canonical representation remains authoritative;
- export remains trivial;
- schema/version validation happens through existing CRUX code;
- migrations of CRUX domain concepts remain format migrations rather than database rewrites;
- offline/local CRUX and hosted CRUX continue to represent the same thing;
- no pressure to distort objects around ORM relationships.

Costs:

- some queries require JSONB traversal or projections;
- high-volume runtime records may eventually deserve append-oriented tables;
- publication/search views will likely need materialised projections.

Those are acceptable once real usage demonstrates which indexes/projections matter.

## Hosted database choice

The adapter should target ordinary PostgreSQL semantics and remain provider-neutral. A Neon-hosted Postgres deployment is a natural first operational target for the managed beta, but Neon must not become part of the interchange contracts or core package dependencies.

Suggested package boundary:

```text
@crux/transport
    pure contracts + durable-store interface

adapters/postgres
    PostgreSQL implementation + migrations

managed deployment
    Neon connection/auth configuration
```

## Retention and privacy

Metadata-only is still the default after persistence exists.

The durable service should not interpret persistence as permission to retain everything indefinitely. Before public beta, define at least:

- retention period for internal Run/Event records;
- whether receipt-supporting traces are retained longer;
- deletion behaviour when an organisation removes a system/version;
- treatment of external response IDs and other correlators;
- public/affected-person publication as a separate deliberate projection;
- whether raw OTLP delivery is ever retained (default recommendation: no; translate then discard).

## Delivery posture

CRUX instrumentation should normally remain observe-only and failure-independent.

Recommended production flow:

```text
AI workflow
   ↓
local instrumentation / OTel
   ↓
bounded batch buffer
   ↓
CRUX ingest
```

If CRUX is unavailable, the AI workflow should normally continue and the producer may retry the bounded batch later. This makes durable request idempotency essential.

## Current implementation

Implemented:

- `DurableIngestStore` abstraction;
- `ingestCruxBatchDurably(...)` service function;
- in-memory reference store;
- authenticated principal separate from producer provenance;
- `runtime:write` and `evidence:write` capabilities;
- request-level idempotency and conflict semantics;
- optimistic revision semantics in the store contract;
- tests for commit, replay, changed-request conflict, unauthorised producer, missing capability and missing scope.

Next:

1. PostgreSQL adapter and migration;
2. transaction/concurrency tests against real Postgres;
3. producer credential/OIDC registration model;
4. managed beta wiring behind the existing browser test surface;
5. retention and asynchronous retry policy.
