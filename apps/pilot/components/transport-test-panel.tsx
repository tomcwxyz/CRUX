"use client";

import { useState } from "react";

type Acceptance = {
  record_kind: string;
  record_id: string;
  status: "accepted" | "already_present";
  producer_ref: string;
};

type TransportResult = {
  ok: boolean;
  format?: string;
  code?: string;
  message?: string;
  direct?: {
    first: Acceptance[];
    replay: Acceptance[];
    conflict_rejected: boolean;
    conflict_message: string;
    content_policy_rejected: boolean;
    content_policy_message: string;
  };
  otlp?: {
    producer: {
      id: string;
      kind: string;
      name?: string;
      version?: string;
    };
    event_count: number;
    event_attributes: Record<string, string | number | boolean>;
    prompt_captured: boolean;
    response_captured: boolean;
    acceptances: Acceptance[];
  };
};

const statusText = (items: Acceptance[]) =>
  items.map((item) => `${item.record_kind}: ${item.status}`).join(" · ");

export function TransportTestPanel() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TransportResult | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const response = await fetch("/api/transport-test", { method: "POST" });
      const payload = (await response.json()) as TransportResult;
      setResult(payload);
    } catch (error) {
      setResult({
        ok: false,
        code: "browser_request_failed",
        message: error instanceof Error ? error.message : "The transport test failed.",
      });
    } finally {
      setRunning(false);
    }
  };

  const passed =
    result?.ok &&
    result.direct?.first.every((item) => item.status === "accepted") &&
    result.direct?.replay.every((item) => item.status === "already_present") &&
    result.direct?.conflict_rejected &&
    result.direct?.content_policy_rejected &&
    result.otlp &&
    !result.otlp.prompt_captured &&
    !result.otlp.response_captured;

  return (
    <div className="grid" style={{ marginTop: 28 }}>
      <article className="card full">
        <div className="kicker">Test 4 · transport boundary</div>
        <h2>Can CRUX accept observations without becoming an observability dump?</h2>
        <p className="body-copy muted">
          This test exercises the new semantic ingestion boundary. It writes a metadata-only Run/Event batch, replays it, attempts a conflicting stable ID, tries to send a free-text runtime summary, then translates an OTLP/HTTP GenAI span through the same contract.
        </p>
        <button type="button" className="btn primary" disabled={running} onClick={() => void run()}>
          {running ? "Testing transport…" : "Run transport boundary test"}
        </button>
      </article>

      {result ? (
        result.ok && result.direct && result.otlp ? (
          <>
            <article className="card">
              <div className="kicker">Transport assertion</div>
              <div className="stat">{passed ? "Pass" : "Review"}</div>
              <p className="small muted">
                Same records replay safely. Changed records with reused IDs and default content-bearing fields must be rejected.
              </p>
            </article>

            <article className="card wide">
              <div className="kicker">Direct CRUX semantic ingestion</div>
              <div className="pill-row" style={{ marginTop: 0 }}>
                <span className="pill moss">first · {statusText(result.direct.first)}</span>
                <span className="pill">replay · {statusText(result.direct.replay)}</span>
              </div>
              <div className="divider" />
              <div className="grid">
                <article className="card">
                  <div className="kicker">Stable ID conflict</div>
                  <div className="claim-text">{result.direct.conflict_rejected ? "Rejected" : "Not rejected"}</div>
                  <p className="small muted">{result.direct.conflict_message}</p>
                </article>
                <article className="card">
                  <div className="kicker">Free-text runtime field</div>
                  <div className="claim-text">{result.direct.content_policy_rejected ? "Rejected" : "Not rejected"}</div>
                  <p className="small muted">{result.direct.content_policy_message}</p>
                </article>
              </div>
            </article>

            <article className="card full">
              <div className="kicker">OpenTelemetry → same CRUX boundary</div>
              <p className="body-copy muted">
                The source OTLP span contains synthetic input/output message fields. The CRUX OTel mapper should keep only bounded GenAI metadata before the semantic ingestion layer sees it.
              </p>
              <div className="pill-row">
                <span className="pill">producer: {result.otlp.producer.kind}</span>
                <span className="pill">events: {result.otlp.event_count}</span>
                <span className="pill moss">prompt captured: {result.otlp.prompt_captured ? "yes" : "no"}</span>
                <span className="pill moss">response captured: {result.otlp.response_captured ? "yes" : "no"}</span>
              </div>
              <details style={{ marginTop: 18 }}>
                <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>Inspect OTLP-derived CRUX metadata</summary>
                <pre style={{ overflowX: "auto", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(
                    {
                      producer: result.otlp.producer,
                      event_attributes: result.otlp.event_attributes,
                      acceptances: result.otlp.acceptances,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </article>
          </>
        ) : (
          <article className="card full">
            <div className="error-box">
              <strong>{result.code ?? "transport_test_failed"}</strong>{"\n"}
              {result.message ?? "The transport test did not complete."}
            </div>
          </article>
        )
      ) : null}
    </div>
  );
}
