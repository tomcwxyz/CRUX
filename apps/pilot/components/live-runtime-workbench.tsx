"use client";

import { useEffect, useMemo, useState } from "react";
import {
  parsePortableBundle,
  redactBundle,
  type CruxPortableBundle,
} from "@crux/formats";

type Lens = "internal" | "public" | "affected_party";
type ComparisonField = {
  field: string;
  declared?: string;
  observed?: string;
  status: "match" | "divergence" | "declared_unknown" | "observed_missing";
};
type Comparison = {
  eventRef?: string;
  runRef?: string;
  occurredAt?: string;
  componentName?: string;
  comparable: boolean;
  fields: ComparisonField[];
};
type PendingCase = {
  run_ref: string;
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
  comparisons: Comparison[];
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
};

type ReviewDraft = {
  aiSummary: string;
  effectOfAi: string;
  humanInvolvement: string;
  finalAuthority: "human" | "rule" | "ai" | "hybrid" | "external";
  outcome: string;
  challengeDescription: string;
};

const audienceCopy: Record<Lens, { label: string; title: string; help: string }> = {
  internal: {
    label: "Internal",
    title: "Compare the description with reality",
    help: "Runtime evidence appears here first. Differences are things to review, not automatic judgements.",
  },
  public: {
    label: "Public",
    title: "Explain how the system works",
    help: "Runtime telemetry never publishes itself. This view only uses the disclosure-safe public projection.",
  },
  affected_party: {
    label: "Affected person",
    title: "Explain what happened in this case",
    help: "A case appears only after observed events have been reviewed and organisational meaning has been confirmed.",
  },
};

const styles = `
.live-shell{overflow:hidden}.live-top{padding:14px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;background:rgba(255,255,255,.34)}.live-state{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.live-dot{width:9px;height:9px;border-radius:50%;background:var(--moss);box-shadow:0 0 0 4px rgba(64,88,74,.09)}.live-label{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.live-tabs{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--line)}.live-tab{border:0;border-right:1px solid var(--line);padding:17px 19px;text-align:left;background:rgba(255,255,255,.16);cursor:pointer}.live-tab:last-child{border-right:0}.live-tab.on{background:var(--chalk);box-shadow:inset 0 -3px 0 var(--rust)}.live-tab span{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--rust)}.live-tab strong{display:block;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:400;margin-top:4px}
.live-canvas{padding:clamp(22px,4vw,46px);background:rgba(255,253,248,.7)}.live-head{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:26px;margin-bottom:25px}.live-head h2{font-family:Georgia,'Times New Roman',serif;font-size:clamp(34px,5vw,58px);font-weight:400;letter-spacing:-.04em;line-height:1;margin:5px 0 10px}.live-head p{color:var(--muted);font-size:15px;line-height:1.55;margin:0}.live-help{border-left:3px solid var(--rust);padding-left:15px;color:var(--muted);font-size:13px;line-height:1.45}
.runtime-strip{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:18px;overflow:hidden;margin:18px 0 24px}.runtime-stat{padding:14px 16px;border-right:1px solid var(--line);background:rgba(255,255,255,.42)}.runtime-stat:last-child{border-right:0}.runtime-stat span{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:900;color:var(--muted);margin-bottom:5px}.runtime-stat strong{font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400}.runtime-stat.warn strong{color:var(--rust)}
.live-actions{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 25px}.live-note{font-size:12px;color:var(--muted);line-height:1.5;margin:8px 0 0}.flow{display:flex;align-items:stretch;gap:8px;overflow-x:auto;padding:4px 0 10px}.flow-node{min-width:145px;flex:1 0 145px;border:1px solid var(--line);border-radius:16px;padding:15px;background:var(--chalk);position:relative;min-height:112px}.flow-node.ai{border:2px solid rgba(168,76,50,.48);background:rgba(168,76,50,.04)}.flow-node.human{border:2px solid rgba(64,88,74,.42);background:rgba(64,88,74,.04)}.flow-node.decision{border-radius:4px 16px 4px 16px}.flow-node>span{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:900;color:var(--muted);margin-bottom:16px}.flow-node strong{font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:400;line-height:1.25}.observed-badge{display:inline-flex!important;margin-top:13px!important;padding:4px 7px;border-radius:999px;background:rgba(64,88,74,.1);color:var(--moss)!important;letter-spacing:.08em!important}.flow-arrow{display:grid;place-items:center;color:var(--muted);min-width:20px}.flow-boundary{min-width:74px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--rust);font-size:8px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;text-align:center}.flow-boundary:before{content:'';width:1px;height:42px;background:var(--rust);margin-bottom:5px}
.live-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:19px}.live-card{border:1px solid var(--line);border-radius:19px;padding:19px;background:rgba(255,255,255,.4)}.live-card h3{font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:400;margin:0 0 12px}.live-card p{color:var(--muted);font-size:13px;line-height:1.5}.compare-row{padding:10px 0;border-top:1px solid var(--line)}.compare-row:first-of-type{border-top:0}.compare-row span{font-size:9px;font-weight:900;letter-spacing:.11em;text-transform:uppercase;color:var(--muted)}.compare-values{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}.compare-values div{border:1px solid var(--line);border-radius:12px;padding:10px}.compare-values small{display:block;color:var(--muted);margin-bottom:3px}.status{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:800;margin-top:7px;background:rgba(64,88,74,.09);color:var(--moss)}.status.warn{background:rgba(168,76,50,.08);color:var(--rust)}.unknown{border:1px dashed rgba(119,120,111,.55);border-radius:13px;padding:12px;color:var(--muted);font-size:13px;line-height:1.45}.unknown:before{content:'○';margin-right:7px}
.review{margin-top:20px;border:1px solid rgba(168,76,50,.28);border-radius:22px;padding:clamp(18px,3vw,28px);background:rgba(168,76,50,.035)}.review h3{font-family:Georgia,'Times New Roman',serif;font-size:27px;font-weight:400;margin:4px 0 8px}.review-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:16px}.review-field{display:grid;gap:6px}.review-field.full{grid-column:1/-1}.review-field label{font-size:11px;font-weight:800}.review-field textarea,.review-field select{width:100%;border:1px solid var(--line);border-radius:13px;background:var(--chalk);padding:11px 12px;font:inherit;line-height:1.45}.review-field textarea{min-height:80px;resize:vertical}.review-tip{border-left:3px solid var(--moss);padding-left:12px;color:var(--muted);font-size:12px;line-height:1.45;margin-top:12px}
.public-summary{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:18px;overflow:hidden;margin:20px 0}.public-fact{padding:15px 17px;border-right:1px solid var(--line)}.public-fact:last-child{border-right:0}.public-fact span{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}.public-fact strong{font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:400}.evidence-row{display:flex;gap:10px;padding:11px 0;border-top:1px solid var(--line)}.evidence-row:first-of-type{border-top:0}.evidence-mark{color:var(--moss);font-weight:900}.evidence-row small{display:block;color:var(--muted);margin-top:4px}
.case{border:1px solid var(--line);border-radius:22px;padding:clamp(18px,3vw,28px);background:var(--chalk)}.case-flow{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:16px}.case-step{border:1px solid var(--line);border-radius:15px;padding:15px;min-height:130px}.case-step.ai{border-color:rgba(168,76,50,.4);background:rgba(168,76,50,.04)}.case-step.human{border-color:rgba(64,88,74,.4);background:rgba(64,88,74,.04)}.case-step span{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:12px}.case-step strong{font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:400;line-height:1.3}.case-bottom{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:13px}.authority,.challenge{padding:19px;border-radius:18px}.authority{background:var(--moss);color:var(--chalk)}.challenge{border:1px solid rgba(168,76,50,.3);background:rgba(168,76,50,.04)}.authority span,.challenge span{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin-bottom:7px}.challenge span{color:var(--rust)}.authority strong,.challenge strong{font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;line-height:1.3}.error{border-left:3px solid var(--rust);padding:12px 14px;background:rgba(168,76,50,.06);border-radius:0 13px 13px 0;color:var(--rust);margin-bottom:16px}
@media(max-width:850px){.live-head{grid-template-columns:1fr}.runtime-strip{grid-template-columns:1fr 1fr}.runtime-stat:nth-child(2){border-right:0}.runtime-stat:nth-child(-n+2){border-bottom:1px solid var(--line)}.live-grid{grid-template-columns:1fr}.case-flow{grid-template-columns:1fr 1fr}}@media(max-width:650px){.live-tabs,.runtime-strip,.public-summary,.case-flow,.case-bottom,.review-grid{grid-template-columns:1fr}.live-tab{border-right:0;border-bottom:1px solid var(--line)}.runtime-stat,.public-fact{border-right:0;border-bottom:1px solid var(--line)}.review-field.full{grid-column:auto}}
`;

const json = async (response: Response) => {
  const text = await response.text();
  if (!text) throw new Error(`CRUX runtime endpoint returned ${response.status} with no body.`);
  const value = JSON.parse(text) as Record<string, unknown>;
  if (!response.ok || value.ok !== true) {
    throw new Error(typeof value.message === "string" ? value.message : `CRUX runtime request failed (${response.status}).`);
  }
  return value;
};

const normaliseState = (value: Record<string, unknown>): LiveState => ({
  revision: Number(value.revision),
  bundle: parsePortableBundle(value.bundle),
  runtime: value.runtime as RuntimeInfo,
  ...(value.run_mode === "live" || value.run_mode === "demo" ? { run_mode: value.run_mode } : {}),
});

const parts = (bundle: CruxPortableBundle) => {
  const use = bundle.ai_uses[0];
  const system = use ? bundle.systems.find((item) => use.system_refs.includes(item.id)) : undefined;
  const version = system?.current_version_ref
    ? bundle.system_versions.find((item) => item.id === system.current_version_ref)
    : undefined;
  return { use, system, version };
};

export function LiveRuntimeWorkbench() {
  const [state, setState] = useState<LiveState | null>(null);
  const [lens, setLens] = useState<Lens>("internal");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewDraft>({
    aiSummary: "AI was invoked in the eligibility-evidence extraction step.",
    effectOfAi: "The AI output was included in the material reviewed by the funding officer.",
    humanInvolvement: "A funding officer reviewed the original application and the AI contribution before making the eligibility decision.",
    finalAuthority: "human",
    outcome: "The funding officer made the eligibility decision.",
    challengeDescription: "The applicant can contact the foundation to ask how the eligibility decision was reached or to raise a concern.",
  });

  const load = async () => {
    setBusy("load");
    setError(null);
    try {
      const value = await json(await fetch("/api/live-runtime", { cache: "no-store" }));
      setState(normaliseState(value));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the live CRUX scope.");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const mutate = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    setError(null);
    try {
      const value = await json(await fetch("/api/live-runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));
      const next = normaliseState(value);
      setState(next);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CRUX runtime action failed.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const review = async () => {
    if (!state?.runtime.latest_run_ref) return;
    const next = await mutate({
      action: "review",
      runRef: state.runtime.latest_run_ref,
      ...draft,
    }, "review");
    if (next) setLens("affected_party");
  };

  const canonical = state?.bundle;
  const canonicalParts = useMemo(() => canonical ? parts(canonical) : null, [canonical]);
  const publicProjection = useMemo(() => canonical ? redactBundle(canonical, "public") : null, [canonical]);
  const affectedProjection = useMemo(() => canonical ? redactBundle(canonical, "affected_party") : null, [canonical]);
  const latestEvents = useMemo(() => {
    if (!canonical || !state?.runtime.latest_run_ref) return [];
    return canonical.events.filter((event) => event.run_ref === state.runtime.latest_run_ref);
  }, [canonical, state?.runtime.latest_run_ref]);
  const lastComparison = state?.runtime.comparisons.at(-1);

  if (!state || !canonical || !canonicalParts) {
    return (
      <section className="workbench live-shell">
        <style>{styles}</style>
        <div className="live-canvas">
          {error ? <div className="error">{error}</div> : null}
          <div className="unknown">{busy ? "Loading the Neon-backed CRUX pilot scope…" : "No live scope is available yet."}</div>
          {!busy ? <button className="btn" type="button" onClick={() => void load()}>Try again</button> : null}
        </div>
      </section>
    );
  }

  const { use, system, version } = canonicalParts;
  const latestRunReviewed = Boolean(state.runtime.reviewed_case);

  return (
    <section className="workbench live-shell" aria-label="CRUX live runtime pilot">
      <style>{styles}</style>

      <div className="live-top">
        <div className="live-state">
          <span className="live-dot" />
          <span className="live-label">Neon-backed synthetic pilot</span>
          <span className="pill">revision {state.revision}</span>
          {state.run_mode ? <span className="pill">last run: {state.run_mode}</span> : null}
        </div>
        <div className="live-state">
          <button className="btn ghost" type="button" disabled={busy !== null} onClick={() => void load()}>Refresh</button>
          <button className="btn ghost" type="button" disabled={busy !== null} onClick={() => void mutate({ action: "reset" }, "reset")}>Reset synthetic scope</button>
        </div>
      </div>

      <div className="live-tabs">
        {(Object.keys(audienceCopy) as Lens[]).map((item) => (
          <button key={item} type="button" className={`live-tab ${lens === item ? "on" : ""}`} onClick={() => setLens(item)}>
            <span>{audienceCopy[item].label}</span>
            <strong>{audienceCopy[item].title}</strong>
          </button>
        ))}
      </div>

      <div className="live-canvas">
        {error ? <div className="error">{error}</div> : null}

        {lens === "internal" ? (
          <>
            <header className="live-head">
              <div>
                <div className="kicker">{canonical.organisations[0]?.name ?? "Example Foundation"} · live internal view</div>
                <h2>Does reality match the account?</h2>
                <p>{use?.public_summary ?? system?.description ?? "Funding review runtime pilot"}</p>
              </div>
              <div className="live-help">{audienceCopy.internal.help}</div>
            </header>

            <div className="runtime-strip">
              <div className="runtime-stat"><span>Observed runs</span><strong>{state.runtime.run_count}</strong></div>
              <div className="runtime-stat"><span>Latest model</span><strong>{state.runtime.observed_model ?? "Not observed"}</strong></div>
              <div className="runtime-stat"><span>Latest provider</span><strong>{state.runtime.observed_provider ?? "Not observed"}</strong></div>
              <div className={`runtime-stat ${state.runtime.divergence_count ? "warn" : ""}`}><span>Differences to review</span><strong>{state.runtime.divergence_count}</strong></div>
            </div>

            <div className="live-actions">
              <button className="btn primary" type="button" disabled={busy !== null} onClick={() => void mutate({ action: "run", mode: "demo" }, "demo")}>{busy === "demo" ? "Running…" : "Run runtime demo"}</button>
              {state.runtime.live_provider_enabled ? (
                <button className="btn" type="button" disabled={busy !== null} onClick={() => void mutate({ action: "run", mode: "live" }, "live")}>{busy === "live" ? "Running…" : "Run real-provider probe"}</button>
              ) : <span className="pill">Paid provider probe locked on public pilot</span>}
            </div>
            <p className="live-note">The interactive demo emits deterministic provider/model metadata, then passes through the real CRUX ingestion and Neon persistence path. The paid real-provider probe has been exercised in production but is disabled publicly by default. No prompt or model output is stored. Human-review and decision events are synthetic for this learning case.</p>

            <div className="vtitle"><h3>What CRUX observed</h3><span>Runtime evidence is attached to the exact declared system version.</span></div>
            <div className="flow">
              {(version?.process.nodes ?? []).map((node, index, nodes) => {
                const observed = latestEvents.some((event) => event.process_node_ref === node.id);
                const prior = nodes[index - 1];
                const humanBoundary = node.type === "human" && prior?.type === "ai";
                return (
                  <div style={{ display: "contents" }} key={node.id}>
                    {index > 0 ? humanBoundary ? <div className="flow-boundary">AI stops here</div> : <div className="flow-arrow">→</div> : null}
                    <article className={`flow-node ${node.type === "ai" ? "ai" : ""} ${node.type === "human" ? "human" : ""} ${node.type === "decision" ? "decision" : ""}`}>
                      <span>{node.type === "ai" ? "AI" : node.type === "human" ? "Person" : node.type}</span>
                      <strong>{node.name}</strong>
                      {observed ? <span className="observed-badge">✓ observed in latest run</span> : null}
                    </article>
                  </div>
                );
              })}
            </div>

            <div className="live-grid">
              <article className="live-card">
                <h3>Declared ↔ observed</h3>
                {!lastComparison ? <div className="unknown">Run the demo to compare runtime model metadata with the declaration.</div> : lastComparison.fields.map((field) => (
                  <div className="compare-row" key={field.field}>
                    <span>{field.field.replaceAll("_", " ")}</span>
                    <div className="compare-values">
                      <div><small>Declared</small><strong>{field.declared ?? "Not recorded"}</strong></div>
                      <div><small>Observed</small><strong>{field.observed ?? "Not reported"}</strong></div>
                    </div>
                    <div className={`status ${field.status === "divergence" ? "warn" : ""}`}>{field.status.replaceAll("_", " ")}</div>
                  </div>
                ))}
                {lastComparison?.fields.some((field) => field.status === "declared_unknown") ? <p>Runtime has filled an observational gap, but CRUX has not silently rewritten the organisation's declaration.</p> : null}
              </article>

              <article className="live-card">
                <h3>Case state</h3>
                {!state.runtime.latest_run_ref ? <div className="unknown">No runtime case has been observed yet.</div> : latestRunReviewed ? (
                  <>
                    <div className="status">Reviewed and publishable to the affected-person view</div>
                    <p>{state.runtime.reviewed_case?.outcome}</p>
                  </>
                ) : (
                  <>
                    <div className="status warn">Observed, meaning not yet reviewed</div>
                    <p>CRUX can see the event sequence, but it will not infer final authority, causal effect, outcome or challenge route from telemetry alone.</p>
                  </>
                )}
              </article>
            </div>

            {state.runtime.pending_case ? (
              <section className="review">
                <div className="kicker">Human review required</div>
                <h3>Complete what runtime cannot know.</h3>
                <p className="live-note">Observed: {state.runtime.pending_case.observed.ai_invocation_count} AI invocation · {state.runtime.pending_case.observed.human_review_count} human review · {state.runtime.pending_case.observed.decision_count} decision. Confirm the meaning before this becomes an affected-person case explanation.</p>
                <div className="review-tip">These fields are prefilled for the synthetic Funding Review example so the flow is easy to test. In a real integration they must come from the organisation or case workflow, not from CRUX guessing.</div>
                <div className="review-grid">
                  <div className="review-field full"><label>What did AI contribute?</label><textarea value={draft.aiSummary} onChange={(event) => setDraft({ ...draft, aiSummary: event.target.value })} /></div>
                  <div className="review-field full"><label>What happened because of that contribution?</label><textarea value={draft.effectOfAi} onChange={(event) => setDraft({ ...draft, effectOfAi: event.target.value })} /></div>
                  <div className="review-field full"><label>What did the person actually do?</label><textarea value={draft.humanInvolvement} onChange={(event) => setDraft({ ...draft, humanInvolvement: event.target.value })} /></div>
                  <div className="review-field"><label>Who had final authority?</label><select value={draft.finalAuthority} onChange={(event) => setDraft({ ...draft, finalAuthority: event.target.value as ReviewDraft["finalAuthority"] })}><option value="human">A person</option><option value="rule">A rule</option><option value="ai">AI</option><option value="hybrid">Human + system</option><option value="external">External authority</option></select></div>
                  <div className="review-field"><label>What was the outcome?</label><textarea value={draft.outcome} onChange={(event) => setDraft({ ...draft, outcome: event.target.value })} /></div>
                  <div className="review-field full"><label>How can someone question or challenge it?</label><textarea value={draft.challengeDescription} onChange={(event) => setDraft({ ...draft, challengeDescription: event.target.value })} /></div>
                </div>
                <div className="live-actions" style={{ marginTop: 16, marginBottom: 0 }}><button className="btn primary" type="button" disabled={busy !== null} onClick={() => void review()}>{busy === "review" ? "Publishing…" : "Confirm and publish case explanation"}</button></div>
              </section>
            ) : null}
          </>
        ) : null}

        {lens === "public" && publicProjection ? (
          <PublicView projection={publicProjection} />
        ) : null}

        {lens === "affected_party" && affectedProjection ? (
          <AffectedView projection={affectedProjection} hasObservedUnreviewedCase={Boolean(state.runtime.pending_case)} />
        ) : null}
      </div>
    </section>
  );
}

function PublicView({ projection }: { projection: ReturnType<typeof redactBundle> }) {
  const use = projection.ai_uses[0];
  const system = use ? projection.systems.find((item) => use.system_refs.includes(item.id)) : undefined;
  const version = system?.current_version_ref ? projection.system_versions.find((item) => item.id === system.current_version_ref) : undefined;
  const decision = version?.decisions[0];
  const claim = projection.claims[0];
  const evidence = claim ? projection.claim_evidence_links.filter((link) => link.claim_ref === claim.id).flatMap((link) => {
    const item = projection.evidence.find((candidate) => candidate.id === link.evidence_ref);
    return item ? [{ item, relationship: link.relationship }] : [];
  }) : [];

  return (
    <>
      <header className="live-head"><div><div className="kicker">{projection.organisations[0]?.name ?? "Organisation"} · public explanation</div><h2>{use?.name ?? "AI use"}</h2><p>{use?.public_summary ?? system?.description ?? "No public explanation is available."}</p></div><div className="live-help">{audienceCopy.public.help}</div></header>
      <div className="public-summary"><div className="public-fact"><span>AI does</span><strong>{system?.influence.map((item) => item.replaceAll("_", " ")).join(" · ") || "Not stated"}</strong></div><div className="public-fact"><span>AI can act by itself</span><strong>{system?.agency === "none" ? "No" : "See process limits"}</strong></div><div className="public-fact"><span>Final authority</span><strong>{decision?.authority ?? "Not stated"}</strong></div></div>
      <div className="vtitle"><h3>How it works</h3><span>Runtime telemetry is not automatically published here.</span></div>
      <div className="flow">{(version?.process.nodes ?? []).map((node, index, nodes) => { const prior = nodes[index - 1]; const boundary = node.type === "human" && prior?.type === "ai"; return <div style={{display:"contents"}} key={node.id}>{index > 0 ? boundary ? <div className="flow-boundary">AI stops here</div> : <div className="flow-arrow">→</div> : null}<article className={`flow-node ${node.type === "ai" ? "ai" : ""} ${node.type === "human" ? "human" : ""} ${node.type === "decision" ? "decision" : ""}`}><span>{node.type}</span><strong>{node.name}</strong></article></div>; })}</div>
      <div className="live-grid"><article className="live-card"><h3>What the organisation says</h3>{claim ? <strong>{claim.statement}</strong> : <div className="unknown">No public statement is visible.</div>}</article><article className="live-card"><h3>How we know</h3>{evidence.length ? evidence.map(({item, relationship}) => <div className="evidence-row" key={item.id}><span className="evidence-mark">✓</span><div><strong>{item.summary}</strong><small>{relationship} · {item.kind.replaceAll("_", " ")}</small></div></div>) : <div className="unknown">No public evidence is visible.</div>}</article></div>
    </>
  );
}

function AffectedView({ projection, hasObservedUnreviewedCase }: { projection: ReturnType<typeof redactBundle>; hasObservedUnreviewedCase: boolean }) {
  const trace = projection.trace_views.find((item) => item.receipt)?.receipt;
  const use = projection.ai_uses[0];
  const system = use ? projection.systems.find((item) => use.system_refs.includes(item.id)) : undefined;

  return (
    <>
      <header className="live-head"><div><div className="kicker">Affected-person explanation</div><h2>How AI was involved in this case</h2><p>{use?.public_summary ?? system?.description ?? "This case relates to an AI-supported process."}</p></div><div className="live-help">{audienceCopy.affected_party.help}</div></header>
      {!trace ? (
        <div className="unknown">{hasObservedUnreviewedCase ? "A runtime case has been observed, but it is not shown here yet. A person still needs to confirm what the AI contribution meant, who had final authority, the outcome and the challenge route." : "No reviewed case explanation is available yet."}</div>
      ) : (
        <article className="case">
          <div className="kicker">Reviewed case explanation</div>
          <div className="case-flow"><div className="case-step ai"><span>AI</span><strong>{trace.ai_summary}</strong></div><div className="case-step"><span>What happened next</span><strong>{trace.effect_of_ai}</strong></div><div className="case-step human"><span>Person</span><strong>{trace.human_involvement ?? "No human involvement was recorded."}</strong></div><div className="case-step"><span>Outcome</span><strong>{trace.outcome}</strong></div></div>
          <div className="case-bottom"><div className="authority"><span>Final authority</span><strong>{trace.final_authority}</strong></div><div className="challenge"><span>Questions or concerns?</span><strong>{trace.challenge?.available ? trace.challenge.description ?? trace.challenge.uri ?? "A challenge route is available." : "No challenge route is recorded."}</strong></div></div>
        </article>
      )}
    </>
  );
}
