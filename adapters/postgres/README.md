# `@crux/adapter-postgres`

PostgreSQL persistence adapter for the CRUX durable ingestion boundary.

The adapter persists the **portable canonical CRUX bundle** and transactional ingestion ledger. It does not redefine CRUX domain objects as database-first models.

## Boundary

```text
@crux/transport
  ingestCruxBatchDurably(...)
          ↓
DurableIngestStore
          ↓
@crux/adapter-postgres
          ↓
PostgreSQL
```

The package is driver-neutral. Supply:

- `query(sql, params)` for ordinary committed reads/writes;
- `transaction(callback)` which provides a transaction-scoped query function and atomically commits or rolls back the callback.

That allows the managed CRUX deployment to use Neon/Postgres while keeping the adapter usable with other PostgreSQL clients.

## Migration

Apply:

```text
migrations/001_durable_ingress.sql
```

It creates:

- `crux_scopes` — validated portable bundle + optimistic revision;
- `crux_ingest_requests` — durable `(scope, producer, request_id)` idempotency ledger;
- `crux_ingest_acceptances` — per-record acceptance/provenance records.

`canonical_batch_text` is retained alongside JSONB so request replay equality uses the exact canonical representation produced by `@crux/transport`, rather than depending on a driver's JSON key ordering.

## Concurrency

The adapter commits with optimistic revision compare-and-swap:

```text
UPDATE crux_scopes
SET bundle = ..., revision = revision + 1
WHERE scope_ref = ... AND revision = expected
RETURNING revision
```

If another request updates the scope first, the transaction returns a revision conflict unless the same producer/request id was concurrently committed, in which case exact replay semantics apply.

The caller can safely retry a bounded batch against the latest scope revision because request and record idempotency are both explicit.

## Authentication

This package does **not** authenticate users or API clients.

`producer.id` in `crux-ingest/0.1` remains provenance. The service layer must establish an authenticated principal and its allowed producer identities/scopes/capabilities before calling the durable ingestion service.

See `docs/DURABLE_INGRESS.md`.

## Managed deployment

A Neon-hosted PostgreSQL database is a natural first managed deployment target, but Neon-specific connection/auth code should live in deployment configuration or a thin integration wrapper. It must not enter CRUX interchange contracts or core packages.

## Current acceptance boundary

The driver-neutral adapter and migration are implemented and compile as part of the CRUX workspace. The next acceptance step is **not another mocked SQL layer**: run the migration against an isolated PostgreSQL/Neon test database and exercise real transaction behaviour for commit, exact request replay, changed-request conflict and competing scope revisions.
