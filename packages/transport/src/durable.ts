import { parsePortableBundle, type CruxPortableBundle } from "@crux/formats";
import {
  cruxIngestBatchSchema,
  ingestCruxBatch,
  type CruxIngestBatch,
  type IngestAcceptance,
  type IngestOptions,
} from "./ingest.js";

export type IngestCapability = "runtime:write" | "evidence:write";

export type AuthenticatedIngestContext = {
  principal_ref: string;
  scope_ref: string;
  allowed_producer_refs: string[];
  capabilities: IngestCapability[];
};

export type StoredIngestRequest = {
  scope_ref: string;
  producer_ref: string;
  principal_ref: string;
  request_id: string;
  canonical_batch: string;
  accepted_at: string;
  acceptances: IngestAcceptance[];
  revision_after: number;
};

export type IngestScopeSnapshot = {
  scope_ref: string;
  revision: number;
  bundle: CruxPortableBundle;
};

export type DurableCommitResult =
  | {
      status: "committed";
      revision: number;
      request: StoredIngestRequest;
    }
  | {
      status: "replayed";
      revision: number;
      request: StoredIngestRequest;
    };

export interface DurableIngestStore {
  loadScope(scopeRef: string): Promise<IngestScopeSnapshot | null>;
  findRequest(
    scopeRef: string,
    producerRef: string,
    requestId: string,
  ): Promise<StoredIngestRequest | null>;
  commit(input: {
    scopeRef: string;
    expectedRevision: number;
    bundle: CruxPortableBundle;
    request: Omit<StoredIngestRequest, "revision_after">;
  }): Promise<DurableCommitResult>;
}

export type DurableIngestResult = {
  request_status: "committed" | "replayed";
  scope_ref: string;
  revision: number;
  bundle: CruxPortableBundle;
  producer_ref: string;
  principal_ref: string;
  request_id: string;
  accepted_at: string;
  acceptances: IngestAcceptance[];
};

const canonicalise = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalise(child)]),
    );
  }
  return value;
};

export const canonicalBatchJson = (batch: CruxIngestBatch) =>
  JSON.stringify(canonicalise(batch));

const requestKey = (producerRef: string, requestId: string) =>
  `${producerRef}\u0000${requestId}`;

const sameStoredRequest = (left: StoredIngestRequest, canonicalBatch: string) =>
  left.canonical_batch === canonicalBatch;

const assertAuthorised = (
  context: AuthenticatedIngestContext,
  batch: CruxIngestBatch,
) => {
  if (!context.allowed_producer_refs.includes(batch.producer.id)) {
    throw new Error(
      `Authenticated principal ${context.principal_ref} is not authorised to ingest as producer ${batch.producer.id}.`,
    );
  }

  const hasRuntimeRecords =
    batch.runs.length > 0 || batch.events.length > 0 || batch.observations.length > 0;
  if (hasRuntimeRecords && !context.capabilities.includes("runtime:write")) {
    throw new Error(
      `Authenticated principal ${context.principal_ref} lacks runtime:write for scope ${context.scope_ref}.`,
    );
  }

  if (
    batch.evidence_envelopes.length > 0 &&
    !context.capabilities.includes("evidence:write")
  ) {
    throw new Error(
      `Authenticated principal ${context.principal_ref} lacks evidence:write for scope ${context.scope_ref}.`,
    );
  }
};

/**
 * Applies the proven CRUX semantic ingestion contract through a durable-store
 * abstraction.
 *
 * Authentication/authorisation is intentionally outside `crux-ingest/0.1`.
 * `batch.producer.id` is provenance asserted by the producer; the authenticated
 * context decides whether the caller is allowed to speak for that producer and
 * scope.
 *
 * Request-level idempotency is keyed by scope + producer + request_id. An exact
 * replay returns the original acceptance ledger without creating a second
 * transaction. Reusing that key for a changed batch is rejected.
 */
export const ingestCruxBatchDurably = async (
  store: DurableIngestStore,
  context: AuthenticatedIngestContext,
  batchInput: unknown,
  options: IngestOptions = {},
): Promise<DurableIngestResult> => {
  const batch = cruxIngestBatchSchema.parse(batchInput);
  assertAuthorised(context, batch);
  const canonicalBatch = canonicalBatchJson(batch);

  const existingRequest = await store.findRequest(
    context.scope_ref,
    batch.producer.id,
    batch.request_id,
  );
  if (existingRequest) {
    if (!sameStoredRequest(existingRequest, canonicalBatch)) {
      throw new Error(
        `Ingestion request conflict for producer ${batch.producer.id} request ${batch.request_id}: this idempotency key was already used for a different batch.`,
      );
    }

    const current = await store.loadScope(context.scope_ref);
    if (!current) {
      throw new Error(`CRUX ingestion scope ${context.scope_ref} no longer exists.`);
    }

    return {
      request_status: "replayed",
      scope_ref: context.scope_ref,
      revision: current.revision,
      bundle: current.bundle,
      producer_ref: existingRequest.producer_ref,
      principal_ref: existingRequest.principal_ref,
      request_id: existingRequest.request_id,
      accepted_at: existingRequest.accepted_at,
      acceptances: existingRequest.acceptances,
    };
  }

  const snapshot = await store.loadScope(context.scope_ref);
  if (!snapshot) {
    throw new Error(`CRUX ingestion scope ${context.scope_ref} does not exist.`);
  }

  const result = ingestCruxBatch(snapshot.bundle, batch, options);
  const commit = await store.commit({
    scopeRef: context.scope_ref,
    expectedRevision: snapshot.revision,
    bundle: result.bundle,
    request: {
      scope_ref: context.scope_ref,
      producer_ref: batch.producer.id,
      principal_ref: context.principal_ref,
      request_id: batch.request_id,
      canonical_batch: canonicalBatch,
      accepted_at: result.accepted_at,
      acceptances: result.acceptances,
    },
  });

  if (!sameStoredRequest(commit.request, canonicalBatch)) {
    throw new Error(
      `Ingestion request conflict for producer ${batch.producer.id} request ${batch.request_id}: this idempotency key was concurrently used for a different batch.`,
    );
  }

  const current = await store.loadScope(context.scope_ref);
  if (!current) {
    throw new Error(`CRUX ingestion scope ${context.scope_ref} no longer exists.`);
  }

  return {
    request_status: commit.status,
    scope_ref: context.scope_ref,
    revision: commit.revision,
    bundle: current.bundle,
    producer_ref: commit.request.producer_ref,
    principal_ref: commit.request.principal_ref,
    request_id: commit.request.request_id,
    accepted_at: commit.request.accepted_at,
    acceptances: commit.request.acceptances,
  };
};

type MemoryScope = {
  revision: number;
  bundle: CruxPortableBundle;
  requests: Map<string, StoredIngestRequest>;
};

/**
 * Reference adapter for tests and local/serverless contract experiments.
 * It deliberately provides no cross-process durability.
 */
export class InMemoryDurableIngestStore implements DurableIngestStore {
  readonly #scopes = new Map<string, MemoryScope>();

  constructor(initialScopes: Array<{ scope_ref: string; bundle: unknown }> = []) {
    for (const item of initialScopes) {
      this.#scopes.set(item.scope_ref, {
        revision: 0,
        bundle: parsePortableBundle(item.bundle),
        requests: new Map(),
      });
    }
  }

  async loadScope(scopeRef: string): Promise<IngestScopeSnapshot | null> {
    const scope = this.#scopes.get(scopeRef);
    if (!scope) return null;
    return {
      scope_ref: scopeRef,
      revision: scope.revision,
      bundle: structuredClone(scope.bundle),
    };
  }

  async findRequest(
    scopeRef: string,
    producerRef: string,
    requestId: string,
  ): Promise<StoredIngestRequest | null> {
    const scope = this.#scopes.get(scopeRef);
    const request = scope?.requests.get(requestKey(producerRef, requestId));
    return request ? structuredClone(request) : null;
  }

  async commit(input: {
    scopeRef: string;
    expectedRevision: number;
    bundle: CruxPortableBundle;
    request: Omit<StoredIngestRequest, "revision_after">;
  }): Promise<DurableCommitResult> {
    const scope = this.#scopes.get(input.scopeRef);
    if (!scope) {
      throw new Error(`CRUX ingestion scope ${input.scopeRef} does not exist.`);
    }

    const key = requestKey(input.request.producer_ref, input.request.request_id);
    const existing = scope.requests.get(key);
    if (existing) {
      if (existing.canonical_batch !== input.request.canonical_batch) {
        throw new Error(
          `Ingestion request conflict for producer ${input.request.producer_ref} request ${input.request.request_id}: this idempotency key was already used for a different batch.`,
        );
      }
      return {
        status: "replayed",
        revision: scope.revision,
        request: structuredClone(existing),
      };
    }

    if (scope.revision !== input.expectedRevision) {
      throw new Error(
        `CRUX ingestion revision conflict for scope ${input.scopeRef}: expected ${input.expectedRevision}, current ${scope.revision}. Retry the bounded batch against the latest scope revision.`,
      );
    }

    const revision = scope.revision + 1;
    const storedRequest: StoredIngestRequest = {
      ...structuredClone(input.request),
      revision_after: revision,
    };
    scope.bundle = parsePortableBundle(input.bundle);
    scope.revision = revision;
    scope.requests.set(key, storedRequest);

    return {
      status: "committed",
      revision,
      request: structuredClone(storedRequest),
    };
  }
}
