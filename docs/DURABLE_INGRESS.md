# CRUX durable ingress design

**Status:** accepted beta path  
**Date:** 16 September 2026

## Purpose

The browser and transport acceptance tests established the semantic boundary CRUX needs. Durable ingress adds restart-safe persistence, producer authorisation and transactional request handling **around** `crux-ingest/0.1` without changing what the transport contract means.

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

That contract remains the boundary durable infrastructure preserves.

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

The service-layer implementation encodes this separation explicitly. A principal cannot ingest simply by putting an allowed-looking `producer.id` inside JSON.

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

`@crux/transport` contains the storage abstraction and an in-memory reference implementation proving these semantics outside PostgreSQL.

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

## Persistence shape

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

## Real Neon acceptance · direct database

A dedicated isolated Neon project (`CRUX beta ingress`, eu-west-2, PostgreSQL 17) was created for synthetic acceptance testing. No real organisational data was used.

Migration `001_durable_ingress.sql` applied successfully and the database-level transactional guarantees were exercised directly against Neon:

1. **First commit passed.** A synthetic scope began at revision `0`; bundle update + request ledger + two acceptance records committed atomically and revision became `1`.
2. **Reconnect/replay state passed.** A fresh read recovered revision `1`, the original canonical request, principal, two acceptance records and the expected persisted Run/Event counts.
3. **Changed request-key conflict passed.** Reusing `(scope_ref, producer_ref, request_id)` with changed batch content was rejected.
4. **Optimistic concurrency passed.** A stale compare-and-swap updated zero rows; retrying against the fresh revision succeeded.
5. **Rollback passed.** A deliberately failing transaction left neither a partial bundle update nor a partial request ledger.

This proved the migration and PostgreSQL transaction semantics independently of the hosted HTTP path.

## Production HTTP acceptance · Test 5

Test 5 was then run through the production CRUX deployment using a fixed synthetic scope and producer. The route cannot accept arbitrary CRUX data; it exercises only the bounded `commit | replay | conflict` sequence.

The end-to-end path is:

```text
browser
  → production Vercel function
  → @crux/transport durable service
  → @crux/adapter-postgres
  → Neon
```

Accepted state after the run:

- `scope:browser-durable:test` persisted as a JSON object;
- scope revision remained `1` after replay and conflict checks;
- exactly one request ledger row existed for `request:browser-durable:001`;
- authenticated principal `principal:browser-durable-test` remained distinct from producer provenance `producer:browser-durable-test`;
- exactly one Run and one Event were persisted;
- exact replay did not create a second commit or increment the revision;
- changed content under the same request key was rejected and did not mutate the scope;
- no runtime errors remained after the successful production run.

### Bug found by Test 5

The first production attempts exposed a useful integration bug rather than a semantic contract failure. `postgres.js` was binding canonical JSON text to an explicit `::jsonb` parameter as a JSON scalar string, causing the database object constraint to reject it.

The fix was made in the managed `postgres.js` bridge so structured JSON reaches PostgreSQL correctly. The canonical schema constraint was **not** weakened. Test 5 also now surfaces non-JSON server failures instead of collapsing them into a browser JSON parse error.

This is exactly why the hosted acceptance existed: the pure contract, database transaction and real driver/runtime boundary are now all independently exercised.

## Retention and privacy

Metadata-only remains the default after persistence exists.

Before broader hosted beta, define at least:

- retention period for internal Run/Event records;
- whether receipt-supporting traces are retained longer;
- deletion behaviour when an organisation removes a system/version;
- treatment of external response IDs and other correlators;
- public/affected-person publication as a separate deliberate projection;
- whether raw OTLP delivery is ever retained (default: translate then discard).

These questions do not block the first organisational learning cycle.

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

Implemented and accepted:

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
- real Neon migration + transaction/concurrency/rollback acceptance;
- production-safe synthetic durable-ingest route;
- production Test 5 commit → replay → conflict acceptance;
- managed `postgres.js` JSONB bridge fix discovered through Test 5.

## Next

Durable ingress is no longer the beta gate. The immediate focus moves to `docs/BETA_LEARNING_PROTOCOL.md` and organisational learning.

Infrastructure still to design before broader hosted production use:

1. producer credential/OIDC registration and tenancy resolution;
2. retention/deletion policy for internal runtime provenance;
3. asynchronous batching/retry guarantees and rate limiting;
4. production query/publication projections only when real use demonstrates the need.

Do not build those ahead of product evidence unless a pilot requires them.
