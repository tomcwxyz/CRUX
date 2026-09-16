import { parsePortableBundle, type CruxPortableBundle } from "@crux/formats";
import type {
  DurableCommitResult,
  DurableIngestStore,
  IngestAcceptance,
  IngestScopeSnapshot,
  StoredIngestRequest,
} from "@crux/transport";

export type PostgresQueryResult<Row extends Record<string, unknown>> = {
  rows: Row[];
  rowCount?: number | null;
};

export type PostgresQuery = <Row extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params?: readonly unknown[],
) => Promise<PostgresQueryResult<Row>>;

export type PostgresTransaction = <T>(
  callback: (query: PostgresQuery) => Promise<T>,
) => Promise<T>;

export type PostgresDurableIngestStoreOptions = {
  query: PostgresQuery;
  transaction: PostgresTransaction;
};

type ScopeRow = {
  scope_ref: unknown;
  revision: unknown;
  bundle: unknown;
};

type RevisionRow = {
  revision: unknown;
};

type RequestRow = {
  scope_ref: unknown;
  producer_ref: unknown;
  request_id: unknown;
  principal_ref: unknown;
  canonical_batch_text: unknown;
  accepted_at: unknown;
  revision_after: unknown;
};

type AcceptanceRow = {
  record_kind: unknown;
  record_id: unknown;
  status: unknown;
  producer_ref: unknown;
  request_id: unknown;
  accepted_at: unknown;
};

const stringValue = (value: unknown, label: string) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`PostgreSQL adapter expected ${label} to be a non-empty string.`);
  }
  return value;
};

const integerValue = (value: unknown, label: string) => {
  const parsed = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`PostgreSQL adapter expected ${label} to be a safe non-negative integer.`);
  }
  return parsed;
};

const timestampValue = (value: unknown, label: string) => {
  if (value instanceof Date) return value.toISOString();
  return stringValue(value, label);
};

const jsonValue = (value: unknown, label: string): unknown => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new Error(`PostgreSQL adapter could not parse ${label} as JSON.`);
    }
  }
  return value;
};

const recordKind = (value: unknown): IngestAcceptance["record_kind"] => {
  if (value === "run" || value === "event" || value === "observation" || value === "evidence") {
    return value;
  }
  throw new Error(`PostgreSQL adapter received unsupported record_kind ${String(value)}.`);
};

const recordStatus = (value: unknown): IngestAcceptance["status"] => {
  if (value === "accepted" || value === "already_present") return value;
  throw new Error(`PostgreSQL adapter received unsupported acceptance status ${String(value)}.`);
};

const loadAcceptances = async (
  query: PostgresQuery,
  scopeRef: string,
  producerRef: string,
  requestId: string,
): Promise<IngestAcceptance[]> => {
  const result = await query<AcceptanceRow>(
    `select record_kind, record_id, status, producer_ref, request_id, accepted_at
       from crux_ingest_acceptances
      where scope_ref = $1 and producer_ref = $2 and request_id = $3
      order by record_kind, record_id`,
    [scopeRef, producerRef, requestId],
  );

  return result.rows.map((row) => ({
    record_kind: recordKind(row.record_kind),
    record_id: stringValue(row.record_id, "record_id"),
    status: recordStatus(row.status),
    producer_ref: stringValue(row.producer_ref, "producer_ref"),
    request_id: stringValue(row.request_id, "request_id"),
    accepted_at: timestampValue(row.accepted_at, "accepted_at"),
  }));
};

const loadStoredRequest = async (
  query: PostgresQuery,
  scopeRef: string,
  producerRef: string,
  requestId: string,
): Promise<StoredIngestRequest | null> => {
  const result = await query<RequestRow>(
    `select scope_ref, producer_ref, request_id, principal_ref,
            canonical_batch_text, accepted_at, revision_after
       from crux_ingest_requests
      where scope_ref = $1 and producer_ref = $2 and request_id = $3`,
    [scopeRef, producerRef, requestId],
  );
  const row = result.rows[0];
  if (!row) return null;

  const acceptances = await loadAcceptances(query, scopeRef, producerRef, requestId);
  return {
    scope_ref: stringValue(row.scope_ref, "scope_ref"),
    producer_ref: stringValue(row.producer_ref, "producer_ref"),
    principal_ref: stringValue(row.principal_ref, "principal_ref"),
    request_id: stringValue(row.request_id, "request_id"),
    canonical_batch: stringValue(row.canonical_batch_text, "canonical_batch_text"),
    accepted_at: timestampValue(row.accepted_at, "accepted_at"),
    acceptances,
    revision_after: integerValue(row.revision_after, "revision_after"),
  };
};

/**
 * PostgreSQL implementation of the durable CRUX ingestion store.
 *
 * The adapter is intentionally driver-neutral. The managed deployment can wrap
 * a Neon/Postgres client while self-hosters can provide any PostgreSQL query +
 * transaction implementation with the small interface above.
 */
export class PostgresDurableIngestStore implements DurableIngestStore {
  readonly #query: PostgresQuery;
  readonly #transaction: PostgresTransaction;

  constructor(options: PostgresDurableIngestStoreOptions) {
    this.#query = options.query;
    this.#transaction = options.transaction;
  }

  async initialiseScope(scopeRef: string, bundleInput: unknown): Promise<void> {
    const bundle = parsePortableBundle(bundleInput);
    await this.#query(
      `insert into crux_scopes (scope_ref, bundle, revision)
       values ($1, $2::jsonb, 0)
       on conflict (scope_ref) do nothing`,
      [scopeRef, JSON.stringify(bundle)],
    );
  }

  async loadScope(scopeRef: string): Promise<IngestScopeSnapshot | null> {
    const result = await this.#query<ScopeRow>(
      `select scope_ref, revision, bundle
         from crux_scopes
        where scope_ref = $1`,
      [scopeRef],
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      scope_ref: stringValue(row.scope_ref, "scope_ref"),
      revision: integerValue(row.revision, "revision"),
      bundle: parsePortableBundle(jsonValue(row.bundle, "bundle")),
    };
  }

  async findRequest(
    scopeRef: string,
    producerRef: string,
    requestId: string,
  ): Promise<StoredIngestRequest | null> {
    return loadStoredRequest(this.#query, scopeRef, producerRef, requestId);
  }

  async commit(input: {
    scopeRef: string;
    expectedRevision: number;
    bundle: CruxPortableBundle;
    request: Omit<StoredIngestRequest, "revision_after">;
  }): Promise<DurableCommitResult> {
    return this.#transaction(async (query) => {
      const existing = await loadStoredRequest(
        query,
        input.scopeRef,
        input.request.producer_ref,
        input.request.request_id,
      );
      if (existing) {
        if (existing.canonical_batch !== input.request.canonical_batch) {
          throw new Error(
            `Ingestion request conflict for producer ${input.request.producer_ref} request ${input.request.request_id}: this idempotency key was already used for a different batch.`,
          );
        }
        return {
          status: "replayed" as const,
          revision: existing.revision_after,
          request: existing,
        };
      }

      const updated = await query<RevisionRow>(
        `update crux_scopes
            set bundle = $2::jsonb,
                revision = revision + 1,
                updated_at = now()
          where scope_ref = $1 and revision = $3
          returning revision`,
        [input.scopeRef, JSON.stringify(input.bundle), input.expectedRevision],
      );
      const revisionRow = updated.rows[0];

      if (!revisionRow) {
        const racedRequest = await loadStoredRequest(
          query,
          input.scopeRef,
          input.request.producer_ref,
          input.request.request_id,
        );
        if (racedRequest) {
          if (racedRequest.canonical_batch !== input.request.canonical_batch) {
            throw new Error(
              `Ingestion request conflict for producer ${input.request.producer_ref} request ${input.request.request_id}: this idempotency key was concurrently used for a different batch.`,
            );
          }
          return {
            status: "replayed" as const,
            revision: racedRequest.revision_after,
            request: racedRequest,
          };
        }

        const current = await query<RevisionRow>(
          `select revision from crux_scopes where scope_ref = $1`,
          [input.scopeRef],
        );
        const currentRow = current.rows[0];
        if (!currentRow) {
          throw new Error(`CRUX ingestion scope ${input.scopeRef} does not exist.`);
        }
        const currentRevision = integerValue(currentRow.revision, "revision");
        throw new Error(
          `CRUX ingestion revision conflict for scope ${input.scopeRef}: expected ${input.expectedRevision}, current ${currentRevision}. Retry the bounded batch against the latest scope revision.`,
        );
      }

      const revision = integerValue(revisionRow.revision, "revision");
      await query(
        `insert into crux_ingest_requests (
           scope_ref, producer_ref, request_id, principal_ref,
           canonical_batch, canonical_batch_text, accepted_at, revision_after
         ) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
        [
          input.scopeRef,
          input.request.producer_ref,
          input.request.request_id,
          input.request.principal_ref,
          input.request.canonical_batch,
          input.request.canonical_batch,
          input.request.accepted_at,
          revision,
        ],
      );

      for (const acceptance of input.request.acceptances) {
        await query(
          `insert into crux_ingest_acceptances (
             scope_ref, producer_ref, request_id,
             record_kind, record_id, status, accepted_at
           ) values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            input.scopeRef,
            input.request.producer_ref,
            input.request.request_id,
            acceptance.record_kind,
            acceptance.record_id,
            acceptance.status,
            acceptance.accepted_at,
          ],
        );
      }

      const stored: StoredIngestRequest = {
        ...input.request,
        revision_after: revision,
      };
      return {
        status: "committed" as const,
        revision,
        request: stored,
      };
    });
  }
}
