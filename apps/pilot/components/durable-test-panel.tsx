"use client";

import { useState } from "react";

type DurableResult = {
  ok: boolean;
  action?: string;
  code?: string;
  message?: string;
  request_status?: "committed" | "replayed";
  revision?: number;
  request_id?: string;
  producer_ref?: string;
  principal_ref?: string;
  acceptances?: Array<{
    record_kind: string;
    record_id: string;
    status: string;
  }>;
  persisted?: { runs: number; events: number };
  conflict_rejected?: boolean;
};

export function DurableTestPanel() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<DurableResult[]>([]);

  const run = async (action: "commit" | "replay" | "conflict") => {
    setRunning(action);
    try {
      const response = await fetch("/api/durable-ingest-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const body = await response.text();
      let payload: DurableResult;

      if (body.length === 0) {
        payload = {
          ok: false,
          action,
          code: "empty_server_response",
          message: `The durable ingress endpoint returned HTTP ${response.status} with an empty body.`,
        };
      } else {
        try {
          payload = JSON.parse(body) as DurableResult;
        } catch {
          payload = {
            ok: false,
            action,
            code: "non_json_server_response",
            message: `The durable ingress endpoint returned HTTP ${response.status}: ${body.slice(0, 300)}`,
          };
        }
      }

      setResults((current) => [...current, payload]);
    } catch (error) {
      setResults((current) => [
        ...current,
        {
          ok: false,
          action,
          code: "browser_request_failed",
          message: error instanceof Error ? error.message : "Browser request failed.",
        },
      ]);
    } finally {
      setRunning(null);
    }
  };

  return (
    <article className="card full">
      <div className="kicker">Test 5 · durable ingress</div>
      <h2>Does the same CRUX request survive a real database boundary?</h2>
      <p className="body-copy muted">
        This uses the PostgreSQL adapter rather than the stateless demo. First commit should create a durable request ledger, replay should return the stored result without another commit, and conflict should reject changed content under the same idempotency key.
      </p>
      <div className="toolbar-group" style={{ marginTop: 16 }}>
        <button className="btn primary" type="button" disabled={running !== null} onClick={() => void run("commit")}>
          {running === "commit" ? "Committing…" : "1 · Commit durable batch"}
        </button>
        <button className="btn" type="button" disabled={running !== null} onClick={() => void run("replay")}>
          {running === "replay" ? "Replaying…" : "2 · Replay same request"}
        </button>
        <button className="btn" type="button" disabled={running !== null} onClick={() => void run("conflict")}>
          {running === "conflict" ? "Testing conflict…" : "3 · Reuse key with changed batch"}
        </button>
      </div>

      {results.length > 0 ? (
        <div className="grid" style={{ marginTop: 18 }}>
          {results.map((result, index) => (
            <article className="card" key={`${result.action ?? result.code ?? "result"}-${index}`}>
              <div className="kicker">{result.action ?? "durable result"}</div>
              <div className="claim-text">
                {result.ok
                  ? result.conflict_rejected
                    ? "Conflict rejected"
                    : result.request_status ?? "Pass"
                  : result.code ?? "Failed"}
              </div>
              {result.revision !== undefined ? <p className="small muted">Scope revision: {result.revision}</p> : null}
              {result.principal_ref ? <p className="small muted">Authenticated: {result.principal_ref}<br />Producer: {result.producer_ref}</p> : null}
              {result.persisted ? <p className="small muted">Persisted runs: {result.persisted.runs}<br />Persisted events: {result.persisted.events}</p> : null}
              {result.acceptances ? (
                <div className="pill-row">
                  {result.acceptances.map((item) => (
                    <span className="pill" key={`${item.record_kind}:${item.record_id}`}>
                      {item.record_kind}: {item.status}
                    </span>
                  ))}
                </div>
              ) : null}
              {result.message ? <p className="small muted">{result.message}</p> : null}
            </article>
          ))}
        </div>
      ) : null}

      <p className="small muted" style={{ marginTop: 18 }}>
        Synthetic production-safe test. The browser never receives the database credential. `producer.id` remains provenance; the server supplies the authenticated principal and capabilities separately.
      </p>
    </article>
  );
}
