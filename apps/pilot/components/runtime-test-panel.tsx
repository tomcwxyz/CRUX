"use client";

import { useState } from "react";

type RuntimeResult = {
  ok: boolean;
  mode?: "demo" | "live";
  requestedModel?: string;
  responseText?: string;
  code?: string;
  message?: string;
  crux?: {
    run: {
      id: string;
      system_version_ref: string;
      status: string;
      capture_mode: string;
    };
    events: Array<{
      id: string;
      type: string;
      occurred_at: string;
      summary?: string;
      attributes: Record<string, string | number | boolean>;
    }>;
    observedProvider: string | null;
    observedRequestModel: string | null;
    observedResponseModel: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    promptCaptured: boolean;
    responseCaptured: boolean;
  };
};

const defaultPrompt = "Reply with exactly CRUX_BROWSER_TEST_OK.";

export function RuntimeTestPanel() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [model, setModel] = useState("anthropic/claude-3-haiku");
  const [running, setRunning] = useState<"demo" | "live" | null>(null);
  const [result, setResult] = useState<RuntimeResult | null>(null);

  const run = async (mode: "demo" | "live") => {
    setRunning(mode);
    setResult(null);

    try {
      const response = await fetch("/api/runtime-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, prompt, model }),
      });
      const payload = (await response.json()) as RuntimeResult;
      setResult(payload);
    } catch (error) {
      setResult({
        ok: false,
        code: "browser_request_failed",
        message: error instanceof Error ? error.message : "The browser request failed.",
      });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="grid">
      <article className="card wide">
        <div className="kicker">Browser-first runtime test</div>
        <h2>Make one AI call. Inspect what CRUX saw.</h2>
        <p className="body-copy muted">
          The response is shown separately from the CRUX runtime record. The test passes only when the prompt and model output are absent from the CRUX snapshot.
        </p>
        <div className="notice" style={{ marginTop: 16 }}>
          Use synthetic or harmless text while this is a beta test surface. Do not paste real casework or personal data here.
        </div>
      </article>

      <article className="card full">
        <div className="field">
          <label htmlFor="runtime-test-prompt">Test prompt</label>
          <textarea
            id="runtime-test-prompt"
            className="textarea"
            value={prompt}
            maxLength={800}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="runtime-test-model">Gateway model for live test</label>
          <input
            id="runtime-test-model"
            className="input"
            value={model}
            maxLength={160}
            onChange={(event) => setModel(event.target.value)}
          />
        </div>
        <div className="toolbar-group">
          <button
            type="button"
            className="btn primary"
            disabled={running !== null}
            onClick={() => void run("demo")}
          >
            {running === "demo" ? "Running demo…" : "Run built-in demo"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={running !== null}
            onClick={() => void run("live")}
          >
            {running === "live" ? "Calling provider…" : "Run live provider test"}
          </button>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Demo needs no credentials. Live mode uses server-side AI Gateway authentication; no API key is entered into this page.
        </p>
      </article>

      {result ? (
        result.ok && result.crux ? (
          <>
            <article className="card wide">
              <div className="kicker">Model response · deliberately outside CRUX</div>
              <div className="claim-text">{result.responseText || "No text returned."}</div>
              <div className="pill-row">
                <span className="pill">{result.mode}</span>
                <span className="pill">requested: {result.requestedModel}</span>
              </div>
            </article>

            <article className="card">
              <div className="kicker">Privacy assertion</div>
              <div className="stat">
                {!result.crux.promptCaptured && !result.crux.responseCaptured ? "Pass" : "Fail"}
              </div>
              <div className="small muted">
                Prompt captured: {result.crux.promptCaptured ? "yes" : "no"}<br />
                Response captured: {result.crux.responseCaptured ? "yes" : "no"}
              </div>
            </article>

            <article className="card full">
              <div className="kicker">What CRUX actually captured</div>
              <div className="pill-row" style={{ marginTop: 0 }}>
                <span className="pill">run: {result.crux.run.id}</span>
                <span className="pill">capture: {result.crux.run.capture_mode}</span>
                <span className="pill moss">status: {result.crux.run.status}</span>
              </div>
              <div className="divider" />
              <div className="grid">
                <article className="card">
                  <div className="kicker">Provider</div>
                  <div className="claim-text">{result.crux.observedProvider ?? "not reported"}</div>
                </article>
                <article className="card">
                  <div className="kicker">Request model</div>
                  <div className="claim-text">{result.crux.observedRequestModel ?? "not reported"}</div>
                </article>
                <article className="card">
                  <div className="kicker">Response model</div>
                  <div className="claim-text">{result.crux.observedResponseModel ?? "not reported"}</div>
                </article>
              </div>
              <div className="pill-row">
                <span className="pill">input tokens: {result.crux.inputTokens ?? "unknown"}</span>
                <span className="pill">output tokens: {result.crux.outputTokens ?? "unknown"}</span>
                <span className="pill">events: {result.crux.events.length}</span>
              </div>
              <details style={{ marginTop: 18 }}>
                <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>Inspect bounded CRUX event JSON</summary>
                <pre style={{ overflowX: "auto", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(result.crux.events, null, 2)}
                </pre>
              </details>
            </article>
          </>
        ) : (
          <article className="card full">
            <div className="error-box">
              <strong>{result.code ?? "test_failed"}</strong>{"\n"}{result.message ?? "The runtime test did not complete."}
            </div>
            {result.code === "missing_gateway_auth" ? (
              <p className="small muted">
                The demo still works. For the live button, add AI Gateway authentication to the deployed CRUX pilot environment; the browser never needs the credential.
              </p>
            ) : null}
          </article>
        )
      ) : null}
    </div>
  );
}
