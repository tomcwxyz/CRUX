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

The first Postgres adapter optimises for correctness and portability rather than application-query convenience.

### `crux_scopes`

Stores one validated portable canonical bundle per service scope plus an optimistic revision number.

### `crux_ingest_requests`

Stores the durable `(scope_ref, producer_ref, request_id)` request/idempotency ledger, authenticated principal, canonical batch and resulting revision.

### `crux_ingest_acceptances`

Stores the per-record provenance/acceptance result returned by the semantic ingestion function.

The canonical bundle remains JSONB rather than normalising every CRUX domain object. That prevents the database schema becoming a second domain model before the beta contracts have stabilised.

## Transaction

A durable commit behaves approximately as:

```text
BEGIN

1. authorise principal → producer → scope/capability
2. check (scope, producer, request_id)
   ├ same request + same bounded batch → return stored result
   └ same request + changed batch → reject
3. read scope revision + canonical bundle
4. apply pure ingestCruxBatch(...)
5. compare-and-swap bundle using expected revision
6. persist request ledger
7. persist per-record acceptance ledger

COMMIT
```

A revision conflict retries from the latest canonical state; it must never overwrite another accepted batch.

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

The adapter targets ordinary PostgreSQL semantics and remains provider-neutral. Neon-hosted Postgres is the first managed beta target, but Neon is not part of the interchange contracts or core package dependencies.

```text
@crux/transport
    pure contracts + durable-store interface

@crux/adapter-postgres
    driver-neutral PostgreSQL implementation + migrations

managed deployment
    Neon connection/auth configuration
```

## Real Neon acceptance · 16 September 2026

A dedicated isolated Neon project (`CRUX beta ingress`, eu-west-2, PostgreSQL 17) was created for synthetic acceptance testing. No real organisational data was used.

Migration `001_durable_ingress.sql` applied successfully and the database-level transactional guarantees were exercised directly against Neon:

1. **First commit passed.** A synthetic scope began at revision `0`; bundle update + request ledger + two acceptance records committed atomically and revision became `1`.
2. **Reconnect/replay state passed.** A fresh read recovered revision `1`, the original canonical request, principal, two acceptance records, and the expected persisted Run/Event counts. This is the state the adapter uses to return an exact replay without another commit.
3. **Changed request-key conflict passed.** Reusing `(scope_ref, producer_ref, request_id)` with changed batch content hit the database uniqueness boundary. The service layer additionally detects the differing canonical batch and reports an idempotency conflict rather than treating it as replay.
4. **Optimistic concurrency passed.** A stale compare-and-swap using expected revision `0` after revision `1` updated zero rows. Retrying against the fresh revision succeeded and advanced the scope to revision `2`.
5. **Rollback passed.** A deliberately failing transaction first changed the bundle/revision and inserted a request row, then triggered a duplicate-key failure. After rollback, revision remained `1`, the temporary bundle field was absent and the request row did not exist. Bundle and ledger therefore did not partially commit.

This acceptance proves the migration and PostgreSQL transaction semantics on real Neon. The driver-neutral adapter remains covered by repository contract tests; the next hosted acceptance point is to route a deployed CRUX ingestion endpoint through `@crux/adapter-postgres` against this database and verify the same behaviours end-to-end through HTTP.

## Retention and privacy

Metadata-only is still the default after persistence exists.

Before public beta, define at least:

- retention period for internal Run/Event records;
- whether receipt-supporting traces are retained longer;
- deletion behaviour when an organisation removes a system/version;
- treatment of external response IDs and other correlators;
- public/affected-person publication as a separate deliberate projection;
- whether raw OTLP delivery is ever retained (default: translate then discard).

## Delivery posture

CRUX instrumentation should normally remain observe-only and failure-independent.

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

Implemented and tested:

- `DurableIngestStore` abstraction;
- `ingestCruxBatchDurably(...)` service function;
- in-memory reference store;
- authenticated principal separate from producer provenance;
- `runtime:write` and `evidence:write` capabilities;
- request-level idempotency and conflict semantics;
- optimistic revision semantics;
- driver-neutral `@crux/adapter-postgres`;
- PostgreSQL migration;
- repository contract tests;
- real Neon migration + transaction/concurrency/rollback acceptance.

Next:

1. wire a deployed authenticated ingress route through `@crux/adapter-postgres` to the isolated Neon database;
2. repeat accept/replay/conflict through HTTP rather than direct SQL;
3. define producer credential/OIDC registration and tenancy resolution;
4. define retention/deletion and asynchronous retry policy;
5. only then consider productionising queues/rate limiting or additional query projections.
