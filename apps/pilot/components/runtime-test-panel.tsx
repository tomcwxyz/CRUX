"use client";

import { useState } from "react";

type Scenario = "model" | "workflow" | "divergence";
type Mode = "demo" | "live";
type RunKey = "demo-model" | "live-model" | "live-workflow" | "live-divergence";

type RuntimeResult = {
  ok: boolean;
  mode?: Mode;
  scenario?: Scenario;
  runtimeModel?: string;
  declaredModel?: string;
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
  workflow?: {
    trace: {
      id: string;
      summary?: string;
      steps: Array<{ event_ref: string; relationship_to_previous: string }>;
    };
    proposal: {
      format: string;
      observed_event_types: string[];
      observed: {
        ai_invocation_count: number;
        human_review_count: number;
        override_count: number;
        decision_count: number;
        action_count: number;
        escalation_count: number;
      };
      suggested: {
        ai_summary: string;
        human_involvement?: string;
      };
      questions_to_resolve: Array<{
        field: string;
        question: string;
        reason: string;
      }>;
      source_content_included: false;
    };
  };
  comparison?: {
    comparable: boolean;
    fields: Array<{
      field: string;
      declared?: string;
      observed?: string;
      status: "match" | "divergence" | "declared_unknown" | "observed_missing";
    }>;
  };
};

const defaultPrompt = "Reply with exactly CRUX_BROWSER_TEST_OK.";

const labelForField = (field: string) =>
  field === "model_identifier" ? "Model" : field.charAt(0).toUpperCase() + field.slice(1);

export function RuntimeTestPanel() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [model, setModel] = useState("anthropic/claude-3-haiku");
  const [declaredModel, setDeclaredModel] = useState("openai/gpt-5-mini");
  const [running, setRunning] = useState<RunKey | null>(null);
  const [result, setResult] = useState<RuntimeResult | null>(null);

  const run = async (mode: Mode, scenario: Scenario, key: RunKey) => {
    setRunning(key);
    setResult(null);

    try {
      const response = await fetch("/api/runtime-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, scenario, prompt, model, declaredModel }),
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

  const privacyPass =
    result?.crux && !result.crux.promptCaptured && !result.crux.responseCaptured;

  return (
    <div className="grid">
      <article className="card wide">
        <div className="kicker">Browser-first pipeline tests</div>
        <h2>Move from one model call to an explainable AI-mediated process.</h2>
        <p className="body-copy muted">
          Test 1 proves the metadata boundary. Test 2 adds synthetic human review, decision and action events, then asks CRUX for a receipt proposal. Test 3 deliberately creates a declared-versus-observed model mismatch and lets CRUX core reconcile it.
        </p>
        <div className="notice" style={{ marginTop: 16 }}>
          Use synthetic or harmless text only. The response is displayed separately and should never appear in the CRUX record.
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
        <div className="grid">
          <div className="field">
            <label htmlFor="runtime-test-model">Runtime model</label>
            <input
              id="runtime-test-model"
              className="input"
              value={model}
              maxLength={160}
              onChange={(event) => setModel(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="runtime-declared-model">Declared model for Test 3</label>
            <input
              id="runtime-declared-model"
              className="input"
              value={declaredModel}
              maxLength={160}
              onChange={(event) => setDeclaredModel(event.target.value)}
            />
          </div>
        </div>

        <div className="divider" />
        <div className="kicker">Test 1 · model call</div>
        <div className="toolbar-group">
          <button
            type="button"
            className="btn"
            disabled={running !== null}
            onClick={() => void run("demo", "model", "demo-model")}
          >
            {running === "demo-model" ? "Running demo…" : "Run built-in demo"}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={running !== null}
            onClick={() => void run("live", "model", "live-model")}
          >
            {running === "live-model" ? "Calling provider…" : "Run live model call"}
          </button>
        </div>

        <div className="divider" />
        <div className="kicker">Test 2 · workflow</div>
        <p className="small muted">
          Makes the live model call, then records a synthetic review → human decision → bounded action. CRUX should create a causal trace and a proposal, not silently invent a finished receipt.
        </p>
        <button
          type="button"
          className="btn primary"
          disabled={running !== null}
          onClick={() => void run("live", "workflow", "live-workflow")}
        >
          {running === "live-workflow" ? "Running workflow…" : "Run live workflow test"}
        </button>

        <div className="divider" />
        <div className="kicker">Test 3 · declared vs observed</div>
        <p className="small muted">
          Declares the model above, runs the runtime model, and asks CRUX core whether the exact observed invocation matches the declaration. A mismatch is descriptive evidence, not a trust score.
        </p>
        <button
          type="button"
          className="btn primary"
          disabled={running !== null}
          onClick={() => void run("live", "divergence", "live-divergence")}
        >
          {running === "live-divergence" ? "Comparing…" : "Run live divergence test"}
        </button>
      </article>

      {result ? (
        result.ok && result.crux ? (
          <>
            <article className="card wide">
              <div className="kicker">Model response · deliberately outside CRUX</div>
              <div className="claim-text">{result.responseText || "No text returned."}</div>
              <div className="pill-row">
                <span className="pill">{result.scenario ?? "model"}</span>
                <span className="pill">{result.mode}</span>
                <span className="pill">runtime: {result.runtimeModel ?? "unknown"}</span>
                {result.declaredModel ? (
                  <span className="pill">declared: {result.declaredModel}</span>
                ) : null}
              </div>
            </article>

            <article className="card">
              <div className="kicker">Privacy assertion</div>
              <div className="stat">{privacyPass ? "Pass" : "Fail"}</div>
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

            {result.workflow ? (
              <article className="card full">
                <div className="kicker">Workflow → receipt proposal</div>
                <h3>{result.workflow.trace.summary ?? "Observed causal trace"}</h3>
                <p className="body-copy muted">
                  CRUX observed the event path, but it has deliberately stopped short of manufacturing a finished receipt. The unresolved organisational meaning stays visible below.
                </p>
                <div className="pill-row">
                  <span className="pill">AI calls: {result.workflow.proposal.observed.ai_invocation_count}</span>
                  <span className="pill">human reviews: {result.workflow.proposal.observed.human_review_count}</span>
                  <span className="pill">decisions: {result.workflow.proposal.observed.decision_count}</span>
                  <span className="pill">actions: {result.workflow.proposal.observed.action_count}</span>
                  <span className="pill">source content: {result.workflow.proposal.source_content_included ? "included" : "not included"}</span>
                </div>
                <div className="divider" />
                <div className="kicker">Questions a person still has to resolve</div>
                <div className="grid">
                  {result.workflow.proposal.questions_to_resolve.map((question) => (
                    <article className="card" key={question.field}>
                      <strong>{question.question}</strong>
                      <p className="small muted">{question.reason}</p>
                    </article>
                  ))}
                </div>
                <details style={{ marginTop: 18 }}>
                  <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>Inspect receipt proposal JSON</summary>
                  <pre style={{ overflowX: "auto", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(result.workflow, null, 2)}
                  </pre>
                </details>
              </article>
            ) : null}

            {result.comparison ? (
              <article className="card full">
                <div className="kicker">Declared ↔ observed</div>
                <h3>{result.comparison.comparable ? "CRUX could compare this observation." : "This observation could not be matched to a declared model component."}</h3>
                <p className="body-copy muted">
                  Divergence means the observed runtime metadata differs from the declaration for this exact system version. It does not by itself say whether that difference is good, bad, safe or unsafe.
                </p>
                <div className="grid">
                  {result.comparison.fields.map((field) => (
                    <article className="card" key={field.field}>
                      <div className="kicker">{labelForField(field.field)}</div>
                      <div className="claim-text">{field.status.replaceAll("_", " ")}</div>
                      <div className="small muted">
                        Declared: {field.declared ?? "unknown"}<br />
                        Observed: {field.observed ?? "missing"}
                      </div>
                    </article>
                  ))}
                </div>
              </article>
            ) : null}
          </>
        ) : (
          <article className="card full">
            <div className="error-box">
              <strong>{result.code ?? "test_failed"}</strong>{"\n"}{result.message ?? "The runtime test did not complete."}
            </div>
          </article>
        )
      ) : null}
    </div>
  );
}
