"use client";

import { useMemo, useState } from "react";
import { discoveryConnectors, suggestAIUseCandidates } from "@crux/core";
import { DiscoveryReportSchema, type DiscoveryQuestion } from "@crux/schemas";
import openRecsJson from "../../../examples/discovery/open-recs.json";

type Stage = "connect" | "discover" | "confirm" | "observe";

const questionCopy: Record<DiscoveryQuestion, string> = {
  purpose: "What is this AI use for?",
  people_affected: "Who can be affected by it?",
  authority: "Who decides what happens next?",
  challenge_route: "How can someone question or challenge a consequential outcome?",
  action_limits: "What is the AI allowed to cause or do?",
};

const sources = discoveryConnectors;


const styles = `
.discovery{overflow:hidden}.steps{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--line)}.step{padding:14px 16px;border-right:1px solid var(--line);background:rgba(255,255,255,.16)}.step:last-child{border-right:0}.step.on{background:var(--chalk);box-shadow:inset 0 -3px 0 var(--rust)}.step span{display:block;font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}.step strong{display:block;font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:400;margin-top:4px}.disc-canvas{padding:clamp(22px,4vw,46px);background:rgba(255,253,248,.72)}.disc-head{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(250px,.75fr);gap:28px;align-items:start}.disc-head h2{font-family:Georgia,'Times New Roman',serif;font-size:clamp(36px,5vw,60px);font-weight:400;line-height:1;letter-spacing:-.04em;margin:5px 0 12px}.disc-head p{color:var(--muted);font-size:15px;line-height:1.55;margin:0}.principle{border-left:3px solid var(--rust);padding-left:14px;color:var(--muted);font-size:13px;line-height:1.5}.source-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:24px}.source-card{border:1px solid var(--line);border-radius:18px;padding:18px;background:rgba(255,255,255,.36);text-align:left}.source-card strong{display:block;font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:400}.source-card span{display:block;color:var(--muted);font-size:12px;line-height:1.45;margin-top:6px}.source-card.active{border:2px solid rgba(64,88,74,.45);background:rgba(64,88,74,.04)}.connect-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding:14px 16px;border:1px solid var(--line);border-radius:16px;background:var(--chalk)}.connected{display:flex;gap:9px;align-items:center}.dot{width:9px;height:9px;border-radius:50%;background:var(--moss)}.candidate{margin-top:23px;border:1px solid var(--line);border-radius:22px;background:var(--chalk);overflow:hidden}.candidate-top{padding:22px 22px 18px;display:flex;justify-content:space-between;gap:16px;align-items:start}.candidate h3{font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;margin:4px 0 6px}.eyebrow2{font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:var(--rust)}.confidence{font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;padding:6px 9px;border-radius:999px;background:rgba(64,88,74,.09);color:var(--moss)}.split{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line)}.split>div{padding:20px}.split>div+div{border-left:1px solid var(--line)}.split h4{font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:400;margin:0 0 12px}.signal{display:flex;gap:9px;padding:10px 0;border-top:1px solid var(--line)}.signal:first-of-type{border-top:0}.mark{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;flex:0 0 25px;background:rgba(64,88,74,.09);color:var(--moss);font-weight:900}.signal strong{display:block;font-size:13px}.signal small{display:block;color:var(--muted);line-height:1.35;margin-top:3px}.unknown{display:flex;gap:9px;padding:9px 0;color:var(--muted);font-size:13px;line-height:1.4}.unknown b{font-weight:900;color:var(--rust)}.choice-row{display:flex;gap:8px;flex-wrap:wrap;padding:18px 22px;border-top:1px solid var(--line);background:rgba(255,255,255,.25)}.confirm{margin-top:22px;border:1px solid rgba(168,76,50,.28);border-radius:22px;padding:22px;background:rgba(168,76,50,.035)}.confirm-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:16px}.field{display:grid;gap:6px}.field.full{grid-column:1/-1}.field label{font-size:11px;font-weight:800}.field input,.field select,.field textarea{width:100%;border:1px solid var(--line);border-radius:13px;background:var(--chalk);padding:11px 12px;font:inherit}.field textarea{min-height:82px;resize:vertical}.why{font-size:11px;color:var(--muted);line-height:1.4}.ready{margin-top:22px;border-radius:22px;background:var(--moss);color:var(--chalk);padding:24px}.ready h3{font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;margin:3px 0 8px}.ready p{max-width:720px;line-height:1.55;color:rgba(255,255,255,.82)}.flow{display:flex;align-items:center;gap:8px;margin-top:18px;overflow-x:auto}.flow-node{min-width:145px;border:1px solid rgba(255,255,255,.3);border-radius:15px;padding:13px 15px}.flow-node span{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;opacity:.7}.flow-node strong{display:block;font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:400;margin-top:5px}.arrow{opacity:.6}.detail{margin-top:14px;font-size:12px;color:var(--muted)}@media(max-width:760px){.steps,.source-grid,.split,.confirm-grid,.disc-head{grid-template-columns:1fr}.step{border-right:0;border-bottom:1px solid var(--line)}.split>div+div{border-left:0;border-top:1px solid var(--line)}.field.full{grid-column:auto}}
`;

export function DiscoveryOnboarding() {
  const report = useMemo(() => DiscoveryReportSchema.parse(openRecsJson as unknown), []);
  const candidates = useMemo(() => suggestAIUseCandidates(report), [report]);
  const candidate = candidates[0];
  const [stage, setStage] = useState<Stage>("connect");
  const [purpose, setPurpose] = useState("");
  const [affected, setAffected] = useState("");
  const [authority, setAuthority] = useState("human");

  if (!candidate) return null;

  const stageIndex = { connect: 0, discover: 1, confirm: 2, observe: 3 }[stage];
  const goDiscover = () => setStage("discover");
  const goConfirm = () => setStage("confirm");
  const goObserve = () => setStage("observe");

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
            <div className="source-grid">
              {sources.map((source, index) => (
                <button className={`source-card ${index === 0 ? "active" : ""}`} key={source.id} type="button" onClick={source.maturity === "prototype" ? goDiscover : undefined} disabled={source.maturity !== "prototype"} aria-disabled={source.maturity !== "prototype"}>
                  <strong>{source.name}</strong><span>{source.description}</span><div className="detail">{source.maturity === "prototype" ? "Available in this pilot" : "Planned connector"}</div>
                </button>
              ))}
            </div>
            <div className="connect-row">
              <div className="connected"><span className="dot"/><div><strong>Open Recommendations Local</strong><div className="detail">GitHub · scanned by Ship Check · metadata-only discovery</div></div></div>
              <button className="btn primary" type="button" onClick={goDiscover}>See what CRUX found</button>
            </div>
          </>
        )}

        {(stage === "discover" || stage === "confirm") && (
          <>
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
                  <div className="field full"><label>What is this AI use for?</label><textarea value={purpose} onChange={(event)=>setPurpose(event.target.value)} placeholder="For example: help staff extract recommendations from reports so they can review and track them."/><div className="why">CRUX deliberately did not infer purpose from model calls or filenames.</div></div>
                  <div className="field"><label>Who can be affected by it?</label><input value={affected} onChange={(event)=>setAffected(event.target.value)} placeholder="e.g. staff, report authors, organisations named in reports"/></div>
                  <div className="field"><label>Who decides what happens next?</label><select value={authority} onChange={(event)=>setAuthority(event.target.value)}><option value="human">A person</option><option value="rule">A rule or policy</option><option value="hybrid">A person and automated rule</option><option value="ai">The AI system</option><option value="unknown">I don't know yet</option></select></div>
                </div>
                <div className="choice-row" style={{paddingLeft:0,paddingRight:0,paddingBottom:0,background:"transparent",borderTop:0}}><button className="btn primary" type="button" onClick={goObserve} disabled={!purpose.trim()}>Confirm this use</button><button className="btn ghost" type="button" onClick={()=>setStage("discover")}>Back to discovery</button></div>
              </div>
            )}
          </>
        )}

        {stage === "observe" && (
          <div className="ready">
            <div className="eyebrow2" style={{color:"rgba(255,255,255,.72)"}}>Ready to observe</div>
            <h3>{candidate.name} now has human-confirmed meaning.</h3>
            <p><strong>Purpose:</strong> {purpose}<br/><strong>Affected:</strong> {affected || "Not answered yet"}<br/><strong>Authority:</strong> {authority === "human" ? "A person decides what happens next" : authority}</p>
            <div className="flow"><div className="flow-node"><span>Discovery</span><strong>Ship Check signals</strong></div><span className="arrow">→</span><div className="flow-node"><span>Declaration</span><strong>Human confirmed meaning</strong></div><span className="arrow">→</span><div className="flow-node"><span>Runtime</span><strong>Observe what actually runs</strong></div><span className="arrow">→</span><div className="flow-node"><span>CRUX</span><strong>Reconcile reality</strong></div></div>
            <p className="detail" style={{color:"rgba(255,255,255,.72)"}}>Next, the connector can install or configure the smallest available runtime observation path for this environment. Runtime evidence may challenge the declaration, but never silently rewrites it.</p>
          </div>
        )}
      </div>
    </section>
  );
}
