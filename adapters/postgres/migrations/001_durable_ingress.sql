-- CRUX durable ingress beta schema
--
-- This schema persists the already-validated portable CRUX bundle and the
-- ingestion ledger. It intentionally does not redefine CRUX domain objects as
-- relational tables during beta.

begin;

create table if not exists crux_scopes (
  scope_ref text primary key,
  bundle jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crux_scopes_bundle_object check (jsonb_typeof(bundle) = 'object')
);

create table if not exists crux_ingest_requests (
  scope_ref text not null references crux_scopes(scope_ref) on delete cascade,
  producer_ref text not null,
  request_id text not null,
  principal_ref text not null,
  canonical_batch jsonb not null,
  accepted_at timestamptz not null,
  revision_after bigint not null check (revision_after > 0),
  created_at timestamptz not null default now(),
  primary key (scope_ref, producer_ref, request_id),
  constraint crux_ingest_requests_batch_object check (jsonb_typeof(canonical_batch) = 'object')
);

create table if not exists crux_ingest_acceptances (
  scope_ref text not null,
  producer_ref text not null,
  request_id text not null,
  record_kind text not null check (record_kind in ('run', 'event', 'observation', 'evidence')),
  record_id text not null,
  status text not null check (status in ('accepted', 'already_present')),
  accepted_at timestamptz not null,
  primary key (scope_ref, producer_ref, request_id, record_kind, record_id),
  foreign key (scope_ref, producer_ref, request_id)
    references crux_ingest_requests(scope_ref, producer_ref, request_id)
    on delete cascade
);

create index if not exists crux_ingest_requests_scope_accepted_idx
  on crux_ingest_requests (scope_ref, accepted_at desc);

create index if not exists crux_ingest_acceptances_record_idx
  on crux_ingest_acceptances (scope_ref, record_kind, record_id);

commit;
