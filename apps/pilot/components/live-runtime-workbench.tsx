"use client";

import { useEffect, useMemo, useState } from "react";
import { parsePortableBundle, redactBundle, type CruxPortableBundle } from "@crux/formats";
import { authorityOptions } from "../lib/labels";
import { buildReaderModel } from "../lib/reader-model";
import { explainModelCheck, latestRunModelCheck, reviewStage, type ModelCheck } from "../lib/runtime-story";
import { CruxReader } from "./crux-reader";
import {
  resetBrowserDemo, restoreBrowserDemo, reviewBrowserDemo,
  runBrowserDemo, storeBrowserDemo, type BrowserDemoState,
} from "../lib/browser-runtime-demo";
import styles from "./live-runtime-workbench.module.css";

type View = "inside" | "public" | "person";
type PendingCase = {
  run_ref: string;
  observed: {
    ai_invocation_count: number;
    human_review_count: number;
    decision_count: number;
  };
};
type RuntimeInfo = {
  live_provider_enabled: boolean;
  run_count: number;
  event_count: number;
  latest_run_ref: string | null;
  latest_run_status: string | null;
  latest_event_types: string[];
  observed_provider: string | null;
  observed_model: string | null;
  comparisons: ModelCheck[];
  divergence_count: number;
  comparable_count: number;
  pending_case: PendingCase | null;
  reviewed_case: { receipt_ref: string; run_ref: string; outcome: string } | null;
};
type LiveState = {
  revision: number;
  bundle: CruxPortableBundle;
  runtime: RuntimeInfo;
  run_mode?: "live" | "demo";
  browser_only?: boolean;
};
type ReviewDraft = {
  aiSummary: string;
  effectOfAi: string;
  humanInvolvement: string;
  finalAuthority: "human" | "rule" | "ai" | "hybrid" | "external";
  outcome: string;
  challengeDescription: string;
};

const inventedReview: ReviewDraft = {
  aiSummary: "AI highlighted passages in a fictional funding application that may relate to eligibility.",
  effectOfAi: "The highlighted passages were included in the material given to the funding officer.",
  humanInvolvement: "A funding officer checked the original application and the AI's suggested passages.",
  finalAuthority: "human",
  outcome: "The funding officer made the eligibility decision in this fictional case.",
  challengeDescription: "The applicant can ask the foundation how the decision was reached or raise a concern.",
};

const views: Array<{ id: View; label: string }> = [
  { id: "inside", label: "Inside the organisation" },
  { id: "public", label: "What the public sees" },
  { id: "person", label: "What an applicant sees" },
];

async function readResponse(response: Response): Promise<LiveState> {
  const raw = await response.text();
  if (!raw) throw new Error("The demo did not return a response.");
  const payload = JSON.parse(raw) as Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(typeof payload.message === "string" ? payload.message : "The demo is unavailable.");
  }
  if (payload.browser_demo_only === true) return restoreBrowserDemo();
  return {
    revision: Number(payload.revision),
    bundle: parsePortableBundle(payload.bundle),
    runtime: payload.runtime as RuntimeInfo,
    ...(payload.run_mode === "demo" || payload.run_mode === "live" ? { run_mode: payload.run_mode } : {}),
  };
}

export function LiveRuntimeWorkbench() {
  const [state, setState] = useState<LiveState | null>(null);
  const [view, setView] = useState<View>("inside");
  const [busy, setBusy] = useState<"loading" | "running" | "review" | "reset" | "real" | null>("loading");
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmedExample, setConfirmedExample] = useState(false);
  const [draft, setDraft] = useState<ReviewDraft>(inventedReview);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const next = await readResponse(await fetch("/api/live-runtime", { cache: "no-store" }));
        if (active) setState(next);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "The demo is unavailable.");
      } finally {
        if (active) setBusy(null);
      }
    })();
    return () => { active = false; };
  }, []);

  const change = <T extends keyof ReviewDraft>(field: T, value: ReviewDraft[T]) =>
    setDraft((old) => ({ ...old, [field]: value }));

  const mutate = async (
    body: Record<string, unknown>,
    action: "running" | "review" | "reset" | "real",
  ): Promise<LiveState | null> => {
    if (busy) return null;
    setBusy(action);
    setError("");
    try {
      let next: LiveState;
      if (state?.browser_only === true && action !== "real") {
        const local = state as BrowserDemoState;
        if (action === "running") {
          next = runBrowserDemo(local);
        } else if (action === "review" && body.action === "review") {
          if (typeof body.runRef !== "string") throw new Error("Missing run for review.");
          next = reviewBrowserDemo(local, body.runRef, draft);
        } else if (action === "reset") {
          next = resetBrowserDemo();
        } else {
          throw new Error("Unsupported action for this browser-only example.");
        }
        storeBrowserDemo(next as BrowserDemoState);
      } else {
        next = await readResponse(await fetch("/api/live-runtime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }));
      }
      setState(next);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That action could not be completed.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const runExample = async (mode: "demo" | "live" = "demo") => {
    const next = await mutate({ action: "run", mode }, mode === "demo" ? "running" : "real");
    if (!next) return;
    setView("inside");
    setReviewOpen(false);
    setConfirmedExample(false);
    setDraft(inventedReview);
  };

  const publishExample = async () => {
    if (!confirmedExample || !state?.runtime.pending_case || !state.runtime.latest_run_ref) return;
    const runRef = state.runtime.latest_run_ref;
    if (state.runtime.pending_case.run_ref !== runRef) return;
    const next = await mutate({ action: "review", runRef, ...draft }, "review");
    if (!next) return;
    setReviewOpen(false);
    setConfirmedExample(false);
    setView("person");
  };

  const resetExample = async () => {
    if (!window.confirm(state?.browser_only
      ? "Reset this fictional example in your browser? Your other sessions are unaffected."
      : "Reset the shared fictional demo? This clears the example runs and reviews for everyone using it.")) return;
    const next = await mutate({ action: "reset" }, "reset");
    if (!next) return;
    setReviewOpen(false);
    setConfirmedExample(false);
    setView("inside");
  };

  const bundle = state?.bundle;
  const use = bundle?.ai_uses[0];
  const system = bundle?.systems.find((item) => use?.system_refs.includes(item.id));
  const version = bundle?.system_versions.find((item) => item.id === system?.current_version_ref);
  const publicModel = useMemo(
    () => bundle ? buildReaderModel({ kind: "disclosure", projection: redactBundle(bundle, "public") }, bundle.ai_uses[0]?.id) : null,
    [bundle],
  );
  const applicantModel = useMemo(
    () => bundle ? buildReaderModel({ kind: "disclosure", projection: redactBundle(bundle, "affected_party") }, bundle.ai_uses[0]?.id) : null,
    [bundle],
  );
  const latestRunRef = state?.runtime.latest_run_ref ?? null;
  const latestEvents = useMemo(() => !bundle || !latestRunRef ? [] :
    bundle.events.filter((event) => event.run_ref === latestRunRef), [bundle, latestRunRef]);
  const comparison = latestRunModelCheck(state?.runtime.comparisons ?? [], latestRunRef);
  const explanation = explainModelCheck(comparison);
  const stage = reviewStage(latestRunRef, state?.runtime.pending_case?.run_ref ?? null, state?.runtime.reviewed_case?.run_ref ?? null);
  const currentCase = stage === "reviewed" && state?.runtime.reviewed_case
    ? applicantModel?.cases.find((item) => item.id === state.runtime.reviewed_case?.receipt_ref)
    : undefined;
  const steps = (version?.process.nodes ?? []).filter((node) => node.type === "ai" || node.type === "human" || node.type === "decision");

  return (
    <section className={styles.screen} aria-label="CRUX runtime example">
      <div className={styles.intro}>
        <div className={styles.flag}><span aria-hidden="true">✳</span> Fictional example · {state?.browser_only ? "Runs only in your browser" : "Not a real funding application"}</div>
        <h1>AI helps review an application. But what really happened?</h1>
        <p>Imagine a charity using AI to find useful passages in funding applications. A funding officer is meant to check the information and make the decision.</p>
      </div>

      <nav className={styles.views} aria-label="Choose who is reading">
        {views.map((item) => (
          <button type="button" key={item.id} className={view === item.id ? styles.viewActive : styles.view}
            aria-pressed={view === item.id} onClick={() => setView(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {error ? <div role="alert" className={styles.error}>The example couldn't be updated. <details><summary>Details</summary>{error}</details></div> : null}
      {busy === "loading" && !state ? <p role="status" className={styles.empty}>Opening the example…</p> : null}
      {!state && !busy ? (
        <div className={styles.empty}>
          <p>This interactive example needs its test data store. You can still <a href="/examples">see a completed example</a>.</p>
          <button className="btn" type="button" onClick={() => window.location.reload()}>Try again</button>
        </div>
      ) : null}

      {view === "inside" && state ? (
        <>
          <div className={styles.sectionHeading}><span className={styles.number}>1</span><div><h2>What should happen?</h2><p>This is how the organisation says its process works.</p></div></div>
          <div className={styles.flow}>
            {steps.length ? steps.map((step, index) => {
              const hasEvent = latestEvents.some((event) => event.process_node_ref === step.id);
              return (
                <div className={styles.flowPiece} key={step.id}>
                  {index > 0 ? <span className={styles.arrow} aria-hidden="true">→</span> : null}
                  <article className={`${styles.flowNode} ${step.type === "ai" ? styles.ai : step.type === "human" ? styles.person : styles.decision}`}>
                    <span className={styles.nodeIcon} aria-hidden="true">{step.type === "ai" ? "✳" : step.type === "human" ? "◯" : "✓"}</span>
                    <div><span className={styles.nodeRole}>{step.type === "ai" ? "AI" : step.type === "human" ? "Person" : "Decision"}</span>
                      <strong>{step.type === "ai" ? "AI finds relevant information" : step.type === "human" ? "A person checks it" : "A person decides"}</strong></div>
                    {latestRunRef ? <span className={styles.nodeStatus}>{hasEvent ? "Event recorded" : "No event in latest run"}</span> : null}
                  </article>
                </div>
              );
            }) : <p>The process description is unavailable.</p>}
          </div>
          <p className={styles.precision}>A recorded event shows that the software reported a step. It doesn't prove a person reviewed something properly.</p>

          <div className={styles.sectionHeading}><span className={styles.number}>2</span><div><h2>See what CRUX notices</h2><p>Run a made-up case, then compare the description with what the software reported.</p></div></div>
          <div className={styles.actionPanel}>
            <div className={styles.actionCopy}>
              <strong>{!latestRunRef ? "There hasn't been an example run yet." : "The latest example has been recorded."}</strong>
              <p>{!latestRunRef ? "Start the example to see how an observation appears." : "You can run another example, or look at the latest result below."}</p>
            </div>
            <button type="button" className="btn primary" disabled={busy !== null || !state}
              onClick={() => void runExample()}>
              {busy === "running" ? "Recording the example…" : latestRunRef ? "Run another example →" : "Run the example →"}
            </button>
          </div>
          <p className={styles.precision}>{state?.browser_only
            ? "Preview mode: this creates fictional events using CRUX's normal recording and comparison rules, entirely in your browser. No database writes, real AI calls or other visitors' data are involved. Refreshing keeps the example in this tab."
            : "This creates invented AI, review and decision events, sent through CRUX's real data-recording system. No real application or AI output is involved. This is a shared demo, so another visitor's latest run may appear here."}</p>

          {latestRunRef ? (
            <>
              <div className={styles.sectionHeading}><span className={styles.number}>3</span><div><h2>What did we learn?</h2><p>We only compare information that the software actually supplied.</p></div></div>
              <section className={`${styles.result} ${styles[explanation.kind]}`} aria-live="polite">
                <div className={styles.resultIcon} aria-hidden="true">{explanation.kind === "attention" ? "!" : explanation.kind === "match" ? "✓" : "?"}</div>
                <div><h4>{explanation.heading}</h4><p>{explanation.explanation}</p></div>
              </section>
              {explanation.rows.length ? <div className={styles.checkRows}>
                {explanation.rows.map((row) => (
                  <div className={styles.checkRow} key={row.label}>
                    <div><strong>{row.label}</strong><span>{row.meaning}</span></div>
                    <div className={styles.pair}>
                      <div><small>What was recorded</small><span>{row.expected}</span></div>
                      <div><small>What we saw</small><span>{row.seen}</span></div>
                    </div>
                  </div>
                ))}
              </div> : null}

              <div className={styles.sectionHeading}><span className={styles.number}>4</span><div><h2>What still needs a person?</h2><p>A log cannot tell us the whole story of a decision.</p></div></div>
              {stage === "reviewed" ? (
                <section className={styles.reviewIntro}>
                  <span className={styles.reviewSymbol} aria-hidden="true">✓</span>
                  <div><h4>This example outcome has been reviewed</h4><p>The invented case now has a human-confirmed explanation for an applicant.</p>
                    <button className="btn primary" type="button" onClick={() => setView("person")}>See what the applicant sees →</button>
                  </div>
                </section>
              ) : stage === "needs_review" ? (
                <section className={styles.reviewIntro}>
                  <span className={styles.reviewSymbol} aria-hidden="true">?</span>
                  <div className={styles.reviewContent}>
                    <h4>We saw events. We don't yet know what they mean.</h4>
                    <p>This invented run reported an AI call, a review and a decision. We still need someone to confirm what AI contributed, who really decided and what happened.</p>
                    {!reviewOpen ? <button className="btn primary" type="button" onClick={() => setReviewOpen(true)}>Review the example outcome →</button> : null}
                  </div>
                </section>
              ) : <p className={styles.empty}>No case is ready for review. Try running the example again.</p>}

              {stage === "needs_review" && reviewOpen ? (
                <section className={styles.reviewForm} aria-label="Review an invented case">
                  <h4>Check this invented outcome</h4>
                  <p>We've filled in example answers to illustrate what someone responsible for the process would need to check. They're not facts established by the event log.</p>
                  <div className={styles.fields}>
                    <label>What did AI contribute?<textarea value={draft.aiSummary} onChange={(event) => change("aiSummary", event.target.value)}/></label>
                    <label>How did that affect the work?<textarea value={draft.effectOfAi} onChange={(event) => change("effectOfAi", event.target.value)}/></label>
                    <label>What did the person do?<textarea value={draft.humanInvolvement} onChange={(event) => change("humanInvolvement", event.target.value)}/></label>
                    <label>Who made the decision?<select value={draft.finalAuthority} onChange={(event) => change("finalAuthority", event.target.value as ReviewDraft["finalAuthority"])}>{authorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    <label>What was the outcome?<textarea value={draft.outcome} onChange={(event) => change("outcome", event.target.value)}/></label>
                    <label>How could someone question it?<textarea value={draft.challengeDescription} onChange={(event) => change("challengeDescription", event.target.value)}/></label>
                  </div>
                  <label className={styles.confirm}><input type="checkbox" checked={confirmedExample} onChange={(event) => setConfirmedExample(event.target.checked)} />
                    <span>I've checked these <strong>fictional example answers</strong> and want to show how a reviewed case would appear to an applicant.</span></label>
                  <div className={styles.buttons}>
                    <button className="btn primary" type="button" onClick={() => void publishExample()} disabled={busy !== null || !confirmedExample || !draft.aiSummary.trim() || !draft.effectOfAi.trim() || !draft.outcome.trim()}>
                      {busy === "review" ? "Saving example…" : "Show the applicant's explanation →"}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setReviewOpen(false)}>Close</button>
                  </div>
                  <p className={styles.precision}>{state?.browser_only
                    ? "This fictional case is saved in your browser tab only. No organisation or applicant can see it."
                    : "The reviewed case is saved in this shared fictional demo. It does not publish information about a real person or application."}</p>
                </section>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      {view === "public" && publicModel ? (
        <div className={styles.reading}>
          <div className={styles.readerHeader}>
            <span className={styles.label}>A public explanation</span>
            <h2>What does this organisation say its AI does?</h2>
            <p>A member of the public sees the declared purpose and approved supporting evidence — not internal event logs.</p>
          </div>
          {publicModel.availability === "ready" ? (
            <div className={styles.publicCard}>
              <h4>{publicModel.use?.name}</h4>
              <p className={styles.big}>{publicModel.use?.summary ?? "No public summary supplied."}</p>
              <div className={styles.publicFacts}>
                <div><strong>AI's role</strong><p>{publicModel.aiCan.join(", ") || "Not disclosed"}</p></div>
                <div><strong>Who decides?</strong><p>{publicModel.decisions[0]?.authority ?? "Not disclosed"}</p></div>
              </div>
              <div className={styles.evidence}><h5>What supports this?</h5>
                {publicModel.claims.length ? publicModel.claims.map((claim) => (
                  <div key={claim.id}><p><strong>The organisation says:</strong> {claim.statement}</p>
                    {claim.evidence.length ? claim.evidence.map((e) => <p key={e.id}>Evidence: {e.summary} ({e.relationship})</p>) : <p>This statement doesn't have publicly visible evidence yet.</p>}
                  </div>
                )) : <p>No public statements are available to check.</p>}
              </div>
            </div>
          ) : <p className={styles.empty}>This use has not been included in a public disclosure.</p>}
          <details className={styles.more}><summary>See the complete public record</summary><CruxReader model={publicModel} framed={false}/></details>
        </div>
      ) : null}

      {view === "person" && applicantModel ? (
        <div className={styles.reading}>
          <div className={styles.readerHeader}>
            <span className={styles.label}>A person affected</span>
            <h2>What could an applicant be told?</h2>
            <p>General statements aren't enough to explain a particular outcome. A reviewed case must say what happened and who was responsible.</p>
          </div>
          {currentCase ? (
            <div className={styles.personCard}>
              <div className={styles.caseHeader}><span aria-hidden="true">✓</span><h4>A reviewed example</h4></div>
              <p className={styles.big}>{currentCase.outcome}</p>
              <div className={styles.caseSteps}>
                <div><span>1 · AI's contribution</span><p>{currentCase.aiContribution}</p></div>
                <div><span>2 · What happened next</span><p>{currentCase.person ?? currentCase.effect}</p></div>
                <div><span>3 · Who had final authority</span><p>{currentCase.finalAuthority}</p></div>
              </div>
              <div className={styles.challenge}><strong>Questions or concerns?</strong><p>{currentCase.challenge?.text ?? "A way to challenge this has not been recorded."}</p></div>
              <p className={styles.precision}>This is a human-reviewed explanation of a fictional case, not automatic proof from telemetry.</p>
            </div>
          ) : (
            <div className={styles.unpublished}>
              <span aria-hidden="true">○</span>
              <h4>There isn't a reviewed explanation for the latest example yet.</h4>
              <p>We might have a log saying a decision step was reached, but that alone cannot tell an applicant why something happened.</p>
              <button className="btn primary" type="button" onClick={() => { setView("inside"); if (stage === "needs_review") setReviewOpen(true); }}>
                {stage === "needs_review" ? "Review the outcome →" : "See the runtime example →"}
              </button>
            </div>
          )}
          <details className={styles.more}><summary>See the full affected-person disclosure</summary><CruxReader model={applicantModel} framed={false}/></details>
        </div>
      ) : null}

      <details className={styles.technical}>
        <summary>How this example works · technical details</summary>
        <p>{state?.browser_only
          ? "This is a browser-only preview using the real CRUX schema, instrumentation and comparison functions. Nothing is ingested into Neon, and no events are shared. No application content, prompts, responses or reasoning are stored."
          : "This is a shared synthetic funding-review scope, stored using CRUX's actual ingestion and persistence path. A demo run uses invented model/provider metadata and invented review/decision events. No application content, model prompt, response, or reasoning is stored."}</p>
        {state ? <dl className={styles.metadata}>
          <div><dt>Recorded demo runs</dt><dd>{state.runtime.run_count}</dd></div>
          <div><dt>Latest run reference</dt><dd>{latestRunRef ?? "No run"}</dd></div>
          <div><dt>Scope revision</dt><dd>{state.revision}</dd></div>
          <div><dt>Observed provider</dt><dd>{state.runtime.observed_provider ?? "Not reported"}</dd></div>
          <div><dt>Observed model</dt><dd>{state.runtime.observed_model ?? "Not reported"}</dd></div>
        </dl> : null}
        <div className={styles.buttons}>
          <button className="btn" type="button" disabled={busy !== null} onClick={() => window.location.reload()}>Refresh shared example</button>
          <button className="btn ghost" type="button" disabled={busy !== null} onClick={() => void resetExample()}>Reset shared example</button>
          {state?.runtime.live_provider_enabled ? <button className="btn" type="button" disabled={busy !== null} onClick={() => void runExample("live")}>Run real-provider test</button> : null}
        </div>
        <p>{state?.browser_only
          ? "This preview never calls a real model or a production database. For durable ingestion, test the separately configured production runtime."
          : "Paid real-provider testing is disabled in the public demo unless explicitly configured. Even a real model invocation does not prove a human checkpoint took place."}</p>
      </details>
    </section>
  );
}
