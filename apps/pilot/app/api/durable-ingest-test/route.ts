import { NextResponse } from "next/server";
import {
  createMetadataOnlyRuntimeBatch,
  ingestCruxBatchDurably,
} from "@crux/transport";
import { createStarterBundle } from "../../../lib/starter";
import { createPilotPostgresStore } from "../../../lib/postgres-store";

const scopeRef = "scope:browser-durable:test";
const producer = {
  id: "producer:browser-durable-test",
  kind: "application" as const,
  name: "CRUX browser durable ingress test",
  version: "0.1",
};
const systemVersionRef = "system-version:primary:0.1";

const response = (body: unknown, status = 200) => NextResponse.json(body, { status });

const makeBatch = (requestId: string, changed = false) => {
  const runId = changed ? "run:durable-browser:changed" : "run:durable-browser:001";
  return createMetadataOnlyRuntimeBatch({
    requestId,
    producer,
    systemVersionRef,
    runs: [
      {
        schema_version: "0.1",
        id: runId,
        system_version_ref: systemVersionRef,
        started_at: "2026-09-16T17:00:00+01:00",
        completed_at: "2026-09-16T17:00:01+01:00",
        status: "completed",
        capture_mode: "metadata_only",
        disclosure: "internal",
        external_refs: [],
      },
    ],
    events: [
      {
        schema_version: "0.1",
        id: changed ? "event:durable-browser:changed" : "event:durable-browser:001",
        run_ref: runId,
        sequence: 1,
        occurred_at: "2026-09-16T17:00:00.500+01:00",
        type: "ai_invocation",
        process_node_ref: "node:ai",
        component_ref: "component:primary-model",
        attributes: {
          provider: "durable-test",
          request_model: changed ? "model-b" : "model-a",
          response_model: changed ? "model-b" : "model-a",
          input_tokens: 12,
          output_tokens: 4,
        },
        disclosure: "internal",
      },
    ],
  });
};

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return response(
      {
        ok: false,
        code: "database_not_configured",
        message: "Add DATABASE_URL to the CRUX deployment environment to run the durable ingress test.",
      },
      503,
    );
  }

  let input: { action?: string };
  try {
    input = (await request.json()) as { action?: string };
  } catch {
    return response({ ok: false, code: "invalid_json" }, 400);
  }

  const store = createPilotPostgresStore();
  await store.initialiseScope(scopeRef, createStarterBundle("2026-09-16T16:00:00.000Z"));

  const context = {
    principal_ref: "principal:browser-durable-test",
    scope_ref: scopeRef,
    allowed_producer_refs: [producer.id],
    capabilities: ["runtime:write" as const],
  };

  const action = input.action ?? "commit";
  const requestId = "request:browser-durable:001";

  try {
    if (action === "commit" || action === "replay") {
      const result = await ingestCruxBatchDurably(store, context, makeBatch(requestId));
      return response({
        ok: true,
        action,
        request_status: result.request_status,
        revision: result.revision,
        request_id: result.request_id,
        producer_ref: result.producer_ref,
        principal_ref: result.principal_ref,
        acceptances: result.acceptances,
        persisted: {
          runs: result.bundle.runs.length,
          events: result.bundle.events.length,
        },
      });
    }

    if (action === "conflict") {
      try {
        await ingestCruxBatchDurably(store, context, makeBatch(requestId, true));
        return response({ ok: false, action, code: "conflict_not_detected" }, 500);
      } catch (error) {
        return response({
          ok: true,
          action,
          conflict_rejected: true,
          message: error instanceof Error ? error.message : "Idempotency conflict rejected.",
        });
      }
    }

    return response({ ok: false, code: "unknown_action" }, 400);
  } catch (error) {
    return response(
      {
        ok: false,
        code: "durable_ingest_failed",
        message: error instanceof Error ? error.message : "Durable ingress failed.",
      },
      500,
    );
  }
}
