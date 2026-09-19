"use client";

import { useMemo, useState } from "react";
import { buildObservationPatchProposal, buildObservationPlan, createDiscoveryDeclaration, discoveryConnectors, suggestAIUseCandidates } from "@crux/core";
import { DiscoveryReportSchema, type DiscoveryQuestion } from "@crux/schemas";
import { portableBundleFromDiscoveryDeclaration } from "@crux/formats";
import openRecsJson from "../../../examples/discovery/open-recs.json";

type Stage = "connect" | "discover" | "confirm" | "observe";

type PatchReadiness =
  | {
      status: "ready";
      title: string;
      branch_name: string;
      checked_ref: string;
      changes: Array<{ path: string; mode: "create" | "update"; purpose: string }>;
    }
  | { status: "blocked"; reason: string }
  | { status: "error"; reason: string };

type PullRequestState =
  | {
      status: "created";
      pull_request_number: number;
      pull_request_url: string;
      branch: string;
      base_sha: string;
    }
  | { status: "blocked"; code: string; reason: string }
  | { status: "error"; reason: string };

const questionCopy: Record<DiscoveryQuestion, string> = {
  purpose: "What is this AI use for?",
  people_affected: "Who can be affected by it?",
  authority: "Who decides what happens next?",
  challenge_route: "How can someone question or challenge a consequential outcome?",
  action_limits: "What is the AI allowed to cause or do?",
};

const sources = discoveryConnectors;


const styles = `
.discovery{overflow:hidden}.steps{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--line)}.step{padding:14px 16px;border-right:1px solid var(--line);background:rgba(255,255,255,.16)}.step:last-child{border-right:0}.step.on{background:var(--chalk);box-shadow:inset 0 -3px 0 var(--rust)}.step span{display:block;font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}.step strong{display:block;font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:400;margin-top:4px}.disc-canvas{padding:clamp(22px,4vw,46px);background:rgba(255,253,248,.72)}.disc-head{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(250px,.75fr);gap:28px;align-items:start}.disc-head h2{font-family:Georgia,'Times New Roman',serif;font-size:clamp(36px,5vw,60px);font-weight:400;line-height:1;letter-spacing:-.04em;margin:5px 0 12px}.disc-head p{color:var(--muted);font-size:15px;line-height:1.55;margin:0}.principle{border-left:3px solid var(--rust);padding-left:14px;color:var(--muted);font-size:13px;line-height:1.5}.source-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:24px}.source-card{border:1px solid var(--line);border-radius:18px;padding:18px;background:rgba(255,255,255,.36);text-align:left}.source-card strong{display:block;font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:400}.source-card span{display:block;color:var(--muted);font-size:12px;line-height:1.45;margin-top:6px}.source-card.active{border:2px solid rgba(64,88,74,.45);background:rgba(64,88,74,.04)}.connect-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding:14px 16px;border:1px solid var(--line);border-radius:16px;background:var(--chalk)}.connected{display:flex;gap:9px;align-items:center}.dot{width:9px;height:9px;border-radius:50%;background:var(--moss)}.found{margin-top:23px;display:flex;justify-content:space-between;gap:14px;align-items:end}.found h3{font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;margin:3px 0}.candidate-list{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.candidate-pill{border:1px solid var(--line);border-radius:999px;padding:9px 12px;background:rgba(255,255,255,.34);cursor:pointer;text-align:left}.candidate-pill.on{background:var(--moss);border-color:var(--moss);color:var(--chalk)}.candidate-pill strong{font-size:12px}.candidate-pill small{display:block;font-size:9px;opacity:.72;margin-top:2px;text-transform:uppercase;letter-spacing:.08em}.candidate{margin-top:14px;border:1px solid var(--line);border-radius:22px;background:var(--chalk);overflow:hidden}.candidate-top{padding:22px 22px 18px;display:flex;justify-content:space-between;gap:16px;align-items:start}.candidate h3{font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;margin:4px 0 6px}.eyebrow2{font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:var(--rust)}.confidence{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;padding:6px 9px;border-radius:999px;background:rgba(64,88,74,.09);color:var(--moss)}.split{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line)}.split>div{padding:20px}.split>div+div{border-left:1px solid var(--line)}.split h4{font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:400;margin:0 0 12px}.signal{display:flex;gap:9px;padding:10px 0;border-top:1px solid var(--line)}.signal:first-of-type{border-top:0}.mark{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;flex:0 0 25px;background:rgba(64,88,74,.09);color:var(--moss);font-weight:900}.signal strong{display:block;font-size:13px}.signal small{display:block;color:var(--muted);line-height:1.35;margin-top:3px}.unknown{display:flex;gap:9px;padding:9px 0;color:var(--muted);font-size:13px;line-height:1.4}.unknown b{font-weight:900;color:var(--rust)}.choice-row{display:flex;gap:8px;flex-wrap:wrap;padding:18px 22px;border-top:1px solid var(--line);background:rgba(255,255,255,.25)}.confirm{margin-top:22px;border:1px solid rgba(168,76,50,.28);border-radius:22px;padding:22px;background:rgba(168,76,50,.035)}.confirm-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:16px}.field{display:grid;gap:6px}.field.full{grid-column:1/-1}.field label{font-size:11px;font-weight:800}.field input,.field select,.field textarea{width:100%;border:1px solid var(--line);border-radius:13px;background:var(--chalk);padding:11px 12px;font:inherit}.field textarea{min-height:82px;resize:vertical}.why{font-size:11px;color:var(--muted);line-height:1.4}.ready{margin-top:22px;border-radius:22px;background:var(--moss);color:var(--chalk);padding:24px}.ready h3{font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;margin:3px 0 8px}.ready p{max-width:720px;line-height:1.55;color:rgba(255,255,255,.82)}.observe-plan{margin-top:18px;border:1px solid rgba(255,255,255,.24);border-radius:18px;padding:18px;background:rgba(255,255,255,.07)}.observe-plan h4{font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;margin:0 0 8px}.observe-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.observe-box{border-top:1px solid rgba(255,255,255,.22);padding-top:11px}.observe-box strong{display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}.observe-box span{display:block;font-size:12px;line-height:1.45;color:rgba(255,255,255,.76)}.patch-proposal{margin-top:14px;padding:15px;border-radius:14px;background:rgba(0,0,0,.14);font-size:12px;line-height:1.5}.patch-proposal code{display:block;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 0;padding:10px;border-radius:10px;background:rgba(0,0,0,.18);font-size:11px}.patch-list{display:grid;gap:5px;margin-top:10px;color:rgba(255,255,255,.78)}.flow{display:flex;align-items:center;gap:8px;margin-top:18px;overflow-x:auto}.flow-node{min-width:145px;border:1px solid rgba(255,255,255,.3);border-radius:15px;padding:13px 15px}.flow-node span{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;opacity:.7}.flow-node strong{display:block;font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:400;margin-top:5px}.arrow{opacity:.6}.detail{margin-top:14px;font-size:12px;color:var(--muted)}@media(max-width:760px){.steps,.source-grid,.split,.confirm-grid,.disc-head{grid-template-columns:1fr}.step{border-right:0;border-bottom:1px solid var(--line)}.split>div+div{border-left:0;border-top:1px solid var(--line)}.field.full{grid-column:auto}}
`;

type DiscoveryOnboardingProps = {
  reportData?: unknown;
  connectionName?: string;
  connectionMeta?: string;
  initialStage?: Stage;
  showConnectorChoices?: boolean;
  githubInstallationId?: number | undefined;
  githubUserCanWrite?: boolean | undefined;
};

export function DiscoveryOnboarding({
  reportData = openRecsJson,
  connectionName = "Open Recommendations Local",
  connectionMeta = "GitHub · scanned by Ship Check · metadata-only discovery",
  initialStage = "connect",
  showConnectorChoices = true,
  githubInstallationId,
  githubUserCanWrite = false,
}: DiscoveryOnboardingProps = {}) {
  const report = useMemo(() => DiscoveryReportSchema.parse(reportData), [reportData]);
  const candidates = useMemo(() => suggestAIUseCandidates(report), [report]);
  const firstCandidate = candidates[0];
  const [selectedCandidateId, setSelectedCandidateId] = useState(firstCandidate?.id ?? "");
  const candidate = candidates.find((item) => item.id === selectedCandidateId) ?? firstCandidate;
  const [stage, setStage] = useState<Stage>(initialStage);
  const [organisationName, setOrganisationName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [affected, setAffected] = useState("");
  const [consequential, setConsequential] = useState("no");
  const [power, setPower] = useState("recommend");
  const [actionControl, setActionControl] = useState("human_approval");
  const [showPatch, setShowPatch] = useState(false);
  const [patchReadiness, setPatchReadiness] = useState<PatchReadiness | null>(null);
  const [checkingPatch, setCheckingPatch] = useState(false);
  const [creatingPullRequest, setCreatingPullRequest] = useState(false);
  const [pullRequestState, setPullRequestState] = useState<PullRequestState | null>(null);
  const observationPlan = useMemo(
    () => candidate ? buildObservationPlan(report, candidate) : null,
    [report, candidate],
  );
  const patchProposal = useMemo(
    () => candidate ? buildObservationPatchProposal(report, candidate) : null,
    [report, candidate],
  );
  const canConfirm =
    Boolean(organisationName.trim() && purpose.trim() && power) &&
    (power !== "act" || Boolean(actionControl));
  const declaration = useMemo(() => {
    if (!candidate || !canConfirm) return null;
    return createDiscoveryDeclaration({
      report,
      candidate,
      confirmation: {
        organisation_name: organisationName.trim(),
        purpose: purpose.trim(),
        people_affected: affected
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        consequential: consequential === "yes",
        power: power as "suggest" | "recommend" | "decide" | "act",
        ...(power === "act"
          ? { action_control: actionControl as "human_approval" | "rule_bounded" | "automatic_bounded" }
          : {}),
      },
    });
  }, [report, candidate, canConfirm, organisationName, purpose, affected, consequential, power, actionControl]);

  if (!candidate) return null;

  const stageIndex = { connect: 0, discover: 1, confirm: 2, observe: 3 }[stage];
  const goDiscover = () => setStage("discover");
  const goConfirm = () => setStage("confirm");
  const goObserve = () => { if (declaration) setStage("observe"); };
  const repositoryName = (() => {
    if (report.source.external_ref) {
      try {
        const url = new URL(report.source.external_ref);
        return url.hostname === "github.com"
          ? url.pathname.replace(/^\//, "").replace(/\/$/, "")
          : "";
      } catch {
        return "";
      }
    }
    return report.source.label.split("#")[0] ?? "";
  })();
  const checkExactPatch = async () => {
    if (
      !declaration ||
      patchProposal?.generation.state !== "adapter_available" ||
      !repositoryName
    ) {
      return;
    }
    setCheckingPatch(true);
    setPatchReadiness(null);
    try {
      const response = await fetch("/api/github/observation-patch/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repository: repositoryName,
          adapter_id: patchProposal.generation.adapter_id,
          system_version_ref: declaration.system_version_ref,
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        message?: string;
        patch?: PatchReadiness;
      };
      if (!response.ok || !result.ok || !result.patch) {
        throw new Error(result.message ?? "CRUX could not check the repository patch.");
      }
      setPatchReadiness(result.patch);
    } catch (error) {
      setPatchReadiness({
        status: "error",
        reason: error instanceof Error ? error.message : "CRUX could not check the repository patch.",
      });
    } finally {
      setCheckingPatch(false);
    }
  };
  const createDraftPullRequest = async () => {
    if (
      !declaration ||
      !githubInstallationId ||
      !repositoryName ||
      patchReadiness?.status !== "ready" ||
      patchProposal?.generation.state !== "adapter_available"
    ) {
      return;
    }

    setCreatingPullRequest(true);
    setPullRequestState(null);
    try {
      const response = await fetch("/api/github/observation-patch/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repository: repositoryName,
          installation_id: githubInstallationId,
          adapter_id: patchProposal.generation.adapter_id,
          system_version_ref: declaration.system_version_ref,
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        message?: string;
        result?: PullRequestState;
      };
      if (!response.ok || !result.ok || !result.result) {
        throw new Error(result.message ?? "CRUX could not create the draft pull request.");
      }
      setPullRequestState(result.result);
    } catch (error) {
      setPullRequestState({
        status: "error",
        reason: error instanceof Error ? error.message : "CRUX could not create the draft pull request.",
      });
    } finally {
      setCreatingPullRequest(false);
    }
  };
  const downloadDraft = () => {
    if (!declaration) return;
    const bundle = portableBundleFromDiscoveryDeclaration(declaration);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `crux-${candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ai-use"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const selectCandidate = (id: string) => {
    setSelectedCandidateId(id);
    setOrganisationName("");
    setPurpose("");
    setAffected("");
    setConsequential("no");
    setPower("recommend");
    setActionControl("human_approval");
    setShowPatch(false);
    setPatchReadiness(null);
    setPullRequestState(null);
    setStage("discover");
  };

  return (
    <section className="workbench discovery">
      <style>{styles}</style>
      <div className="steps">
        {[
          ["Connect", "Where AI already lives"],
          ["Discover", "CRUX finds signals"],
          ["Confirm", "You add meaning"],
          ["Observe", "Reality keeps feeding back"],
        ].map(([label, copy], index) => (
          <div className={`step ${index === stageIndex ? "on" : ""}`} key={label}>
            <span>0{index + 1} · {label}</span>
            <strong>{copy}</strong>
          </div>
        ))}
      </div>

      <div className="disc-canvas">
        <div className="disc-head">
          <div>
            <div className="eyebrow2">Discovery before declaration</div>
            <h2>Start with what already exists.</h2>
            <p>Connect a project or platform. CRUX finds bounded technical evidence first, then asks you only for the organisational meaning it cannot observe.</p>
          </div>
          <div className="principle"><strong>Nothing discovered becomes organisational truth automatically.</strong><br/>Technical signals suggest candidates. A person decides whether they describe a real AI use.</div>
        </div>

        {stage === "connect" && (
          <>
            {showConnectorChoices && <div className="source-grid">
              {sources.map((source, index) => (
                <button className={`source-card ${index === 0 ? "active" : ""}`} key={source.id} type="button" onClick={source.maturity === "prototype" ? goDiscover : undefined} disabled={source.maturity !== "prototype"} aria-disabled={source.maturity !== "prototype"}>
                  <strong>{source.name}</strong><span>{source.description}</span><div className="detail">{source.maturity === "prototype" ? "Available in this pilot" : "Planned connector"}</div>
                </button>
              ))}
            </div>}
            <div className="connect-row">
              <div className="connected"><span className="dot"/><div><strong>{connectionName}</strong><div className="detail">{connectionMeta}</div></div></div>
              <button className="btn primary" type="button" onClick={goDiscover}>See what CRUX found</button>
            </div>
          </>
        )}

        {(stage === "discover" || stage === "confirm") && (
          <>
            <div className="found">
              <div>
                <div className="eyebrow2">Discovery result</div>
                <h3>CRUX found {candidates.length} likely AI {candidates.length === 1 ? "use" : "uses"}.</h3>
                <div className="detail">Choose one to inspect. Shared SDK/provider evidence can support more than one candidate without becoming a separate AI use.</div>
              </div>
            </div>
            <div className="candidate-list" aria-label="Discovered AI uses">
              {candidates.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`candidate-pill ${item.id === candidate.id ? "on" : ""}`}
                  onClick={() => selectCandidate(item.id)}
                >
                  <strong>{item.name}</strong>
                  <small>{item.confidence} confidence</small>
                </button>
              ))}
            </div>
            <div className="candidate">
              <div className="candidate-top">
                <div><div className="eyebrow2">Likely AI use</div><h3>{candidate.name}</h3><div className="detail">{candidate.explanation}</div></div>
                <span className="confidence">{candidate.confidence} confidence</span>
              </div>
              <div className="split">
                <div>
                  <h4>CRUX can see</h4>
                  {candidate.signal_refs.slice(0, 6).map((ref) => {
                    const signal = report.signals.find((item) => item.id === ref);
                    if (!signal) return null;
                    return <div className="signal" key={ref}><span className="mark">✓</span><div><strong>{signal.label}</strong><small>{signal.evidence[0]?.path ?? report.source.label}</small></div></div>;
                  })}
                </div>
                <div>
                  <h4>CRUX still needs you</h4>
                  {candidate.unanswered.map((question) => <div className="unknown" key={question}><b>○</b><span>{questionCopy[question]}</span></div>)}
                  <div className="detail">These are not scanner failures. They are questions whose answers belong to people, not source code.</div>
                </div>
              </div>
              {stage === "discover" && <div className="choice-row"><button className="btn primary" type="button" onClick={goConfirm}>Yes — this is one AI use</button><button className="btn" type="button">These signals belong to different uses</button><button className="btn ghost" type="button">Not sure yet</button></div>}
            </div>

            {stage === "confirm" && (
              <div className="confirm">
                <div className="eyebrow2">Add the meaning only you know</div>
                <h3 style={{fontFamily:"Georgia, 'Times New Roman', serif",fontSize:28,fontWeight:400,margin:"5px 0 6px"}}>Confirm {candidate.name}</h3>
                <div className="confirm-grid">
                  <div className="field full"><label>Which organisation is using this?</label><input value={organisationName} onChange={(event)=>setOrganisationName(event.target.value)} placeholder="Organisation name"/><div className="why">A repository owner or account name is not treated as organisational identity.</div></div>
                  <div className="field full"><label>What is this AI use for?</label><textarea value={purpose} onChange={(event)=>setPurpose(event.target.value)} placeholder="For example: help staff extract recommendations from reports so they can review and track them."/><div className="why">CRUX deliberately did not infer purpose from model calls or filenames.</div></div>
                  <div className="field"><label>Who can be affected by it?</label><input value={affected} onChange={(event)=>setAffected(event.target.value)} placeholder="Comma-separated, e.g. staff, report authors"/></div>
                  <div className="field"><label>Could it materially affect a person, service, opportunity or entitlement?</label><select value={consequential} onChange={(event)=>setConsequential(event.target.value)}><option value="no">No</option><option value="yes">Yes</option></select></div>
                  <div className="field"><label>What can the AI do here?</label><select value={power} onChange={(event)=>setPower(event.target.value)}><option value="suggest">Suggest</option><option value="recommend">Recommend</option><option value="decide">Decide</option><option value="act">Act</option></select><div className="why">This maps plain language to CRUX influence/agency underneath.</div></div>
                  {power === "act" && <div className="field"><label>Before the AI action takes effect…</label><select value={actionControl} onChange={(event)=>setActionControl(event.target.value)}><option value="human_approval">A person must approve it</option><option value="rule_bounded">A rule bounds when it can happen</option><option value="automatic_bounded">It can happen automatically within defined limits</option></select></div>}
                </div>
                <div className="choice-row" style={{paddingLeft:0,paddingRight:0,paddingBottom:0,background:"transparent",borderTop:0}}><button className="btn primary" type="button" onClick={goObserve} disabled={!canConfirm}>Confirm and create draft record</button><button className="btn ghost" type="button" onClick={()=>setStage("discover")}>Back to discovery</button></div>
              </div>
            )}
          </>
        )}

        {stage === "observe" && (
          <div className="ready">
            <div className="eyebrow2" style={{color:"rgba(255,255,255,.72)"}}>Ready to observe</div>
            <h3>{candidate.name} now has a canonical internal draft.</h3>
            <p><strong>Organisation:</strong> {organisationName}<br/><strong>Purpose:</strong> {purpose}<br/><strong>Affected:</strong> {affected || "No groups recorded"}<br/><strong>AI can:</strong> {power}{power === "act" ? ` · ${actionControl.replaceAll("_", " ")}` : ""}</p>
            {declaration && <div className="observe-plan" style={{marginTop:12}}>
              <div className="eyebrow2" style={{color:"rgba(255,255,255,.7)"}}>Canonical draft created</div>
              <h4>{declaration.system_version_ref}</h4>
              <p>The discovery candidate has become an internal Organisation → AI Use → System → exact SystemVersion record. No claim, evidence or outcome has been invented.</p>
              <div className="choice-row" style={{paddingLeft:0,paddingRight:0,paddingBottom:0,background:"transparent",borderTop:0}}>
                <button className="btn" type="button" onClick={downloadDraft}>Download portable draft</button>
              </div>
            </div>}
            <div className="flow"><div className="flow-node"><span>Discovery</span><strong>Technical signals</strong></div><span className="arrow">→</span><div className="flow-node"><span>Declaration</span><strong>Human confirmed meaning</strong></div><span className="arrow">→</span><div className="flow-node"><span>Runtime</span><strong>Observe what actually runs</strong></div><span className="arrow">→</span><div className="flow-node"><span>CRUX</span><strong>Reconcile reality</strong></div></div>
            {observationPlan && <div className="observe-plan">
              <div className="eyebrow2" style={{color:"rgba(255,255,255,.7)"}}>Smallest useful observation hook</div>
              <h4>{observationPlan.primary_path ?? "Existing runtime connector"}</h4>
              <p>{observationPlan.rationale}</p>
              <div className="observe-grid">
                <div className="observe-box"><strong>Record</strong><span>{observationPlan.metadata.join(" · ")}</span></div>
                <div className="observe-box"><strong>Never send</strong><span>{observationPlan.excluded_content.join(" · ")}</span></div>
              </div>
              <div className="choice-row" style={{paddingLeft:0,paddingRight:0,paddingBottom:0,background:"transparent",borderTop:0}}>
                <button className="btn" type="button" onClick={() => setShowPatch((value) => !value)}>{showPatch ? "Hide patch proposal" : "Generate patch proposal"}</button>
              </div>
              {showPatch && patchProposal && <div className="patch-proposal">
                <strong>Proposed change</strong>
                <div className="patch-list">
                  <span>Add: {patchProposal.add_file.path}</span>
                  {patchProposal.target_path && <span>Edit: {patchProposal.target_path}</span>}
                  <span>Configure: {patchProposal.environment.map((item) => item.name).join(" · ")}</span>
                  {declaration && <span>Set CRUX_SYSTEM_VERSION_REF={declaration.system_version_ref}</span>}
                </div>
                <code>{patchProposal.integration_snippet}</code>
                <div className="patch-list">{patchProposal.review_checks.map((check) => <span key={check}>✓ {check}</span>)}</div>
                <div className="detail" style={{color:"rgba(255,255,255,.68)"}}>{patchProposal.generation.reason}</div>
                {patchProposal.generation.state === "adapter_available" && declaration && <div className="choice-row" style={{paddingLeft:0,paddingRight:0,paddingBottom:0,background:"transparent",borderTop:0}}>
                  <button className="btn" type="button" onClick={() => void checkExactPatch()} disabled={checkingPatch}>
                    {checkingPatch ? "Checking repository…" : "Check exact patch readiness"}
                  </button>
                </div>}
                {patchReadiness?.status === "ready" && <div className="patch-list">
                  <strong>Exact patch ready on {patchReadiness.checked_ref}</strong>
                  {patchReadiness.changes.map((change) => <span key={change.path}>✓ {change.mode}: {change.path} — {change.purpose}</span>)}
                  <span>Proposed branch: {patchReadiness.branch_name}</span>
                  {githubInstallationId && githubUserCanWrite && !pullRequestState && <div className="choice-row" style={{paddingLeft:0,paddingRight:0,paddingBottom:0,background:"transparent",borderTop:0}}>
                    <button className="btn" type="button" onClick={() => void createDraftPullRequest()} disabled={creatingPullRequest}>
                      {creatingPullRequest ? "Creating review PR…" : "Create draft review PR"}
                    </button>
                  </div>}
                  {githubInstallationId && !githubUserCanWrite && <span>GitHub says this connected user can read this repository but cannot write to it, so CRUX will not offer PR creation.</span>}
                  {!githubInstallationId && <span>Connect this repository through the CRUX GitHub App to create the patch as a review PR.</span>}
                </div>}
                {pullRequestState?.status === "created" && <div className="patch-list">
                  <strong>Draft PR #{pullRequestState.pull_request_number} created for review.</strong>
                  <span>Branch: {pullRequestState.branch}</span>
                  <span>Base checked again at {pullRequestState.base_sha.slice(0, 12)}.</span>
                  <a href={pullRequestState.pull_request_url} target="_blank" rel="noreferrer" style={{color:"inherit",textDecoration:"underline"}}>Open the draft pull request on GitHub</a>
                  <span>CRUX will not merge it.</span>
                </div>}
                {pullRequestState?.status === "blocked" && <div className="detail" style={{color:"rgba(255,255,255,.8)"}}>PR creation blocked: {pullRequestState.reason}</div>}
                {pullRequestState?.status === "error" && <div className="detail" style={{color:"rgba(255,255,255,.8)"}}>PR creation failed: {pullRequestState.reason}</div>}
                {patchReadiness?.status === "blocked" && <div className="detail" style={{color:"rgba(255,255,255,.8)"}}>Exact patch blocked: {patchReadiness.reason}</div>}
                {patchReadiness?.status === "error" && <div className="detail" style={{color:"rgba(255,255,255,.8)"}}>Patch check failed: {patchReadiness.reason}</div>}
                <div className="detail" style={{color:"rgba(255,255,255,.68)"}}>CRUX only offers repository writes after an exact adapter passes its source checks. Creating a draft PR repeats the repository, user-write, App-permission and current-source checks server-side. It never updates an existing review branch and never auto-merges.</div>
              </div>}
            </div>}
            <p className="detail" style={{color:"rgba(255,255,255,.72)"}}>Runtime evidence may challenge the declaration, but never silently rewrites it. A generated patch should remain reviewable and disabled until explicit CRUX configuration is present.</p>
          </div>
        )}
      </div>
    </section>
  );
}
