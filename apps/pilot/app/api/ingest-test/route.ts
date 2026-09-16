import { ingestCruxBatch } from "@crux/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HTTP_BODY_BYTES = 1_500_000;

type IngestTestBody = {
  bundle?: unknown;
  batch?: unknown;
};

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_HTTP_BODY_BYTES) {
    return Response.json(
      {
        ok: false,
        code: "request_too_large",
        message: `CRUX ingest test requests are limited to ${MAX_HTTP_BODY_BYTES} bytes.`,
      },
      { status: 413 },
    );
  }

  let body: IngestTestBody;
  try {
    body = (await request.json()) as IngestTestBody;
  } catch {
    return Response.json(
      {
        ok: false,
        code: "invalid_json",
        message: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  if (body.bundle === undefined || body.batch === undefined) {
    return Response.json(
      {
        ok: false,
        code: "missing_input",
        message: "Provide both bundle and batch. This beta route is stateless and does not persist either one.",
      },
      { status: 400 },
    );
  }

  try {
    const result = ingestCruxBatch(body.bundle, body.batch);
    return Response.json({
      ok: true,
      format: "crux-ingest-result/0.1",
      request_id: result.request_id,
      accepted_at: result.accepted_at,
      producer: result.producer,
      acceptances: result.acceptances,
      bundle: result.bundle,
      persistence: "none",
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        code: "ingest_rejected",
        message: error instanceof Error ? error.message : "CRUX ingestion rejected the batch.",
      },
      { status: 400 },
    );
  }
}
