"use client";

import { useMemo, useState } from "react";
import {
  parsePortableBundle,
  portableBundleSchema,
  redactBundle,
  validateBundleReferences,
  type CruxDisclosureBundle,
  type CruxPortableBundle,
} from "@crux/formats";
import type { AIAgency, AIInfluence } from "@crux/schemas";
import { authorityLabel, evidenceKindLabel, influenceLabel } from "../lib/labels";
import writingAssistantJson from "../../../examples/writing-assistant/crux.json";
import fundingReviewJson from "../../../examples/funding-review/crux.json";
import boundedActionJson from "../../../examples/bounded-action/crux.json";

type Lens = "working" | "public" | "affected_party";
type Challenge = { available: boolean; description: string | undefined; uri: string | undefined };
type Decision = { name: string; authority: string; reviewBeforeEffect: boolean; challenge: Challenge | undefined };
type Evidence = { id: string; summary: string; kind: string; relationship: string; limitations: string[] };
type Claim = { id: string; statement: string; evidence: Evidence[] };
type Receipt = { aiSummary: string; effectOfAi: string; humanInvolvement: string | undefined; finalAuthority: string; outcome: string; challenge: Challenge | undefined };
type Node = { id: string; type: string; name: string };

type Snapshot = {
  organisation: string;
  useName: string;
  summary: string;
  consequential: boolean;
  affected: string[];
  influence: AIInfluence[];
  agency: AIAgency | undefined;
  systemName: string;
  version: string | undefined;
  nodes: Node[];
  decisions: Decision[];
  claims: Claim[];
  receipt: Receipt | undefined;
  unknowns: string[];
  observationCount: number;
};

type ExampleCase = { id: string; name: string; bundle: CruxPortableBundle };

const examples: ExampleCase[] = [
  { id: "writing-assistant", name: "Writing assistant", bundle: parsePortableBundle(writingAssistantJson as unknown) },
  { id: "funding-review", name: "Funding review", bundle: parsePortableBundle(fundingReviewJson as unknown) },
  { id: "bounded-action", name: "Bounded action", bundle: parsePortableBundle(boundedActionJson as unknown) },
];

const audience: Record<Lens, { label: string; job: string; intro: string }> = {
  working: { label: "Internal", job: "Scrutinise & improve", intro: "Evidence, gaps and operational detail for the people responsible for the system." },
  public: { label: "Public", job: "Understand the system", intro: "A short explanation of where AI is used, what it can do and who remains responsible." },
  affected_party: { label: "Affected person", job: "Understand my case", intro: "What AI did in this case, who made the decision and how to ask questions or challenge it." },
};

const agencyLabel: Record<AIAgency, string> = {
  none: "Cannot cause an action",
  proposes_action: "Can propose an action",
  human_approval_required: "Can act after human approval",
  automatic_bounded: "Can act automatically within fixed limits",
  autonomous_bounded: "Can choose and act within defined limits",
};

const nodeLabel: Record<string, string> = {
  input: "Information",
  data_source: "Information",
  transformation: "Step",
  ai: "AI",
  rule: "Rule",
  decision: "Decision",
  human: "Person",
  action: "Action",
  output: "Outcome",
  external_system: "External system",
};

const challenge = (value: { available: boolean; description?: string | undefined; uri?: string | undefined } | undefined): Challenge | undefined =>
  value ? { available: value.available, description: value.description, uri: value.uri } : undefined;

const relationLabel = (value: string) => value === "supports" ? "Supports" : value === "qualifies" ? "Qualifies" : value === "contradicts" ? "Challenges" : "Inconclusive";

const canonicalParts = (bundle: CruxPortableBundle) => {
  const use = bundle.ai_uses[0];
  const system = use ? bundle.systems.find((item) => use.system_refs.includes(item.id) || item.ai_use_refs.includes(use.id)) : undefined;
  const version = system?.current_version_ref
    ? bundle.system_versions.find((item) => item.id === system.current_version_ref)
    : bundle.system_versions.find((item) => item.system_ref === system?.id);
  return { use, system, version };
};

const snapshotFromCanonical = (bundle: CruxPortableBundle): Snapshot => {
  const { use, system, version } = canonicalParts(bundle);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claims = bundle.claims.filter((item) => item.applies_to.some((target) => refs.has(target.ref))).map((item): Claim => ({
    id: item.id,
    statement: item.statement,
    evidence: bundle.evidence_links.filter((link) => link.claim_ref === item.id).flatMap((link) => {
      const evidence = bundle.evidence.find((candidate) => candidate.id === link.evidence_ref);
      return evidence ? [{ id: evidence.id, summary: evidence.summary, kind: evidence.kind, relationship: link.relationship, limitations: evidence.limitations }] : [];
    }),
  }));
  const unknowns: string[] = [];
  for (const component of version?.components ?? []) {
    if (component.kind === "model" && component.model_identifier?.status !== "known") unknowns.push(`${component.name}: model identifier ${component.model_identifier?.status?.replaceAll("_", " ") ?? "unknown"}`);
  }
  for (const item of claims) if (!item.evidence.length) unknowns.push(`No evidence linked to: ${item.statement}`);
  if (use?.consequential && !version?.decisions.length) unknowns.push("Consequential use with no decision authority recorded.");
  const receipt = version ? bundle.receipts.find((item) => item.system_version_ref === version.id) : undefined;
  return {
    organisation: bundle.organisations[0]?.name ?? "Your organisation",
    useName: use?.name ?? "AI use",
    summary: use?.public_summary || use?.purpose || system?.description || "No explanation recorded.",
    consequential: use?.consequential ?? false,
    affected: use?.people_affected ?? [],
    influence: system ? [...system.influence] : [],
    agency: system?.agency,
    systemName: system?.name ?? "AI system",
    version: version?.version,
    nodes: version?.process.nodes.map((node) => ({ id: node.id, type: node.type, name: node.name })) ?? [],
    decisions: version?.decisions.map((item): Decision => ({ name: item.name, authority: item.authority, reviewBeforeEffect: item.review_before_effect, challenge: challenge(item.challenge) })) ?? [],
    claims,
    receipt: receipt ? { aiSummary: receipt.ai_summary, effectOfAi: receipt.effect_of_ai, humanInvolvement: receipt.human_involvement, finalAuthority: receipt.final_authority, outcome: receipt.outcome, challenge: challenge(receipt.challenge) } : undefined,
    unknowns,
    observationCount: version ? bundle.observations.filter((item) => item.system_version_ref === version.id).length : 0,
  };
};

const snapshotFromProjection = (projection: CruxDisclosureBundle): Snapshot => {
  const use = projection.ai_uses[0];
  const system = use ? projection.systems.find((item) => use.system_refs.includes(item.id) || item.ai_use_refs.includes(use.id)) : undefined;
  const version = system?.current_version_ref
    ? projection.system_versions.find((item) => item.id === system.current_version_ref)
    : projection.system_versions.find((item) => item.system_ref === system?.id);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claims = projection.claims.filter((item) => item.applies_to.some((target) => refs.has(target.ref))).map((item): Claim => ({
    id: item.id,
    statement: item.statement,
    evidence: projection.claim_evidence_links.filter((link) => link.claim_ref === item.id).flatMap((link) => {
      const evidence = projection.evidence.find((candidate) => candidate.id === link.evidence_ref);
      return evidence ? [{ id: evidence.id, summary: evidence.summary, kind: evidence.kind, relationship: link.relationship, limitations: evidence.limitations }] : [];
    }),
  }));
  const unknowns: string[] = [];
  for (const component of version?.components ?? []) {
    if (component.kind === "model" && component.model_identifier?.status !== "known") unknowns.push(`${component.name}: model identifier ${component.model_identifier?.status?.replaceAll("_", " ") ?? "unknown"}`);
  }
  for (const item of claims) if (!item.evidence.length) unknowns.push(`No evidence is visible for: ${item.statement}`);
  const receipt = projection.trace_views.find((item) => item.receipt)?.receipt;
  return {
    organisation: projection.organisations[0]?.name ?? "Organisation",
    useName: use?.name ?? "AI use",
    summary: use?.public_summary ?? system?.description ?? "No explanation is visible.",
    consequential: use?.consequential ?? false,
    affected: use?.people_affected ?? [],
    influence: system ? [...system.influence] : [],
    agency: system?.agency,
    systemName: system?.name ?? "AI system",
    version: version?.version,
    nodes: version?.process.nodes.map((node) => ({ id: node.id, type: node.type, name: node.name })) ?? [],
    decisions: version?.decisions.map((item): Decision => ({ name: item.name, authority: item.authority, reviewBeforeEffect: item.review_before_effect, challenge: challenge(item.challenge) })) ?? [],
    claims,
    receipt: receipt ? { aiSummary: receipt.ai_summary, effectOfAi: receipt.effect_of_ai, humanInvolvement: receipt.human_involvement, finalAuthority: receipt.final_authority, outcome: receipt.outcome, challenge: challenge(receipt.challenge) } : undefined,
    unknowns,
    observationCount: projection.observations.length,
  };
};

const styles = `
.aud{overflow:hidden}.aud-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 18px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.35)}.aud-group{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.aud-label{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}.ex{border:0;background:transparent;color:var(--muted);font-size:12px;font-weight:700;padding:7px 9px;border-radius:999px;cursor:pointer}.ex.on,.ex:hover{background:var(--chalk);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
.aud-switch{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid var(--line)}.aud-choice{border:0;border-right:1px solid var(--line);background:rgba(255,255,255,.18);padding:18px 20px;text-align:left;cursor:pointer}.aud-choice:last-child{border-right:0}.aud-choice.on{background:var(--chalk);box-shadow:inset 0 -3px 0 var(--rust)}.aud-choice span{display:block;color:var(--rust);font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.aud-choice strong{display:block;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:400;margin:4px 0}.aud-choice small{display:block;color:var(--muted);line-height:1.35}
.canvas{padding:clamp(22px,4vw,46px);background:rgba(255,253,248,.68)}.head{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(260px,.7fr);gap:28px;margin-bottom:28px}.head h2{font-family:Georgia,'Times New Roman',serif;font-size:clamp(36px,5vw,62px);font-weight:400;line-height:.98;letter-spacing:-.045em;margin:5px 0 12px}.head p{color:var(--muted);font-size:16px;line-height:1.55;margin:0}.purpose{border-left:3px solid var(--rust);padding-left:15px;color:var(--muted);font-size:13px;line-height:1.45}.facts{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:18px;overflow:hidden;margin-bottom:26px}.fact{padding:15px 17px;border-right:1px solid var(--line);background:rgba(255,255,255,.4)}.fact:last-child{border-right:0}.fact span{display:block;color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px}.fact strong{font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:400}
.vtitle{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:26px 0 12px}.vtitle h3,.card h3{font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;margin:0}.vtitle span{font-size:12px;color:var(--muted)}.flow{display:flex;align-items:stretch;gap:8px;overflow-x:auto;padding-bottom:10px}.node{min-width:145px;flex:1 0 145px;border:1px solid var(--line);border-radius:16px;padding:15px;background:var(--chalk);min-height:104px}.node.ai{border:2px solid rgba(168,76,50,.5);background:rgba(168,76,50,.05)}.node.human{border:2px solid rgba(64,88,74,.42);background:rgba(64,88,74,.05)}.node.decision{border-radius:4px 16px 4px 16px}.node span{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:17px}.node strong{font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:400;line-height:1.25}.arrow{display:grid;place-items:center;color:var(--muted);min-width:20px}.boundary{min-width:74px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--rust);gap:4px}.boundary:before{content:'';width:1px;height:40px;background:var(--rust)}.boundary b{font-size:8px;letter-spacing:.12em;text-transform:uppercase;text-align:center}
.two{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:19px}.three{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-top:19px}.card{border:1px solid var(--line);border-radius:19px;padding:19px;background:rgba(255,255,255,.38)}.card h3{margin-bottom:11px}.line,.ev{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)}.line:first-of-type,.ev:first-of-type{border-top:0}.mark{width:26px;height:26px;display:grid;place-items:center;border:1px solid var(--line);border-radius:50%;font-size:10px;font-weight:900;flex:0 0 26px}.mark.good{color:var(--moss);border-color:rgba(64,88,74,.4)}.mark.warn{color:var(--rust);border-color:rgba(168,76,50,.35)}.line strong,.ev strong{display:block;line-height:1.35}.line small,.ev small{display:block;color:var(--muted);margin-top:3px;line-height:1.4}.es{font-size:17px;font-weight:900;color:var(--moss)}.es.warn{color:var(--rust)}.gap{border:1px dashed rgba(119,120,111,.5);border-radius:13px;padding:11px 13px;color:var(--muted);font-size:13px;line-height:1.4;margin-top:8px}.gap:before{content:'○';margin-right:7px}
.case{border:1px solid var(--line);border-radius:23px;padding:clamp(19px,3vw,30px);background:var(--chalk)}.timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:16px}.step{border:1px solid var(--line);border-radius:15px;padding:15px;min-height:134px}.step.ai{border-color:rgba(168,76,50,.42);background:rgba(168,76,50,.04)}.step.human{border-color:rgba(64,88,74,.42);background:rgba(64,88,74,.04)}.step span{display:block;color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin-bottom:13px}.step strong{font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:400;line-height:1.3}.case-bottom{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.authority,.challenge{border-radius:19px;padding:20px}.authority{background:var(--moss);color:var(--chalk)}.challenge{border:1px solid rgba(168,76,50,.35);background:rgba(168,76,50,.05)}.authority span,.challenge span{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px}.challenge span{color:var(--rust)}.authority strong,.challenge strong{font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:400;line-height:1.3}.fold{margin-top:19px;border-top:1px solid var(--line);padding-top:13px}.fold summary{cursor:pointer;font-size:12px;font-weight:800}.metric{font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:1;margin:5px 0}.foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 18px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}
@media(max-width:900px){.head{grid-template-columns:1fr}.three{grid-template-columns:1fr}.timeline{grid-template-columns:1fr 1fr}.aud-choice small{display:none}}@media(max-width:680px){.aud-switch{grid-template-columns:1fr}.aud-choice{border-right:0;border-bottom:1px solid var(--line)}.facts,.two,.case-bottom,.timeline{grid-template-columns:1fr}.fact{border-right:0;border-bottom:1px solid var(--line)}.fact:last-child{border-bottom:0}.canvas{padding:20px}}
`;

function Flow({ nodes }: { nodes: Node[] }) {
  return <div className="flow">{nodes.map((node, index) => {
    const previous = nodes[index - 1];
    const boundary = previous?.type === "ai" && (node.type === "human" || node.type === "decision");
    return <div style={{ display: "contents" }} key={node.id}>{index > 0 ? boundary ? <div className="boundary"><b>AI stops here</b></div> : <div className="arrow">→</div> : null}<article className={`node ${node.type === "ai" ? "ai" : ""} ${node.type === "human" ? "human" : ""} ${node.type === "decision" ? "decision" : ""}`}><span>{nodeLabel[node.type] ?? node.type}</span><strong>{node.name}</strong></article></div>;
  })}</div>;
}

function PublicView({ s }: { s: Snapshot }) {
  const d = s.decisions[0];
  const evidence = s.claims.flatMap((item) => item.evidence);
  return <div className="canvas"><header className="head"><div><div className="kicker">{s.organisation} · public explanation</div><h2>How AI is used in {s.useName}</h2><p>{s.summary}</p></div><div className="purpose"><strong>For anyone using or interested in this service.</strong><br />A short explanation of AI's role, limits and human responsibility.</div></header><div className="facts"><div className="fact"><span>AI does</span><strong>{s.influence.map((item) => influenceLabel(item)).join(" · ") || "Not described"}</strong></div><div className="fact"><span>AI does not</span><strong>{s.agency === "none" ? "Act by itself" : s.agency ? agencyLabel[s.agency] : "Not recorded"}</strong></div><div className="fact"><span>Final authority</span><strong>{d ? authorityLabel(d.authority) : "Not recorded"}</strong></div></div><div className="vtitle"><h3>How it works</h3><span>Follow the work, not the technology.</span></div>{s.nodes.length ? <Flow nodes={s.nodes} /> : <div className="gap">The public process has not been described yet.</div>}<div className="two"><article className="card"><h3>Who decides?</h3>{d ? <div className="line"><span className="mark good">✓</span><div><strong>{d.name}</strong><small>Decided by: {authorityLabel(d.authority)}{d.reviewBeforeEffect ? " · review before effect" : ""}</small></div></div> : <div className="gap">Decision authority is not visible.</div>}</article><article className="card"><h3>How we know</h3>{evidence.length ? evidence.map((item) => <div className="ev" key={item.id}><span className={`es ${item.relationship === "supports" ? "" : "warn"}`}>{item.relationship === "supports" ? "✓" : "△"}</span><div><strong>{item.summary}</strong><small>{relationLabel(item.relationship)} · {evidenceKindLabel(item.kind)}</small></div></div>) : <div className="gap">No public evidence is linked yet.</div>}</article></div>{s.unknowns.length ? <><div className="vtitle"><h3>Not known or disclosed</h3></div>{s.unknowns.map((item) => <div className="gap" key={item}>{item}</div>)}</> : null}</div>;
}

function AffectedView({ s }: { s: Snapshot }) {
  const r = s.receipt;
  const d = s.decisions[0];
  const c = r?.challenge ?? d?.challenge;
  return <div className="canvas"><header className="head"><div><div className="kicker">{s.organisation} · affected-person explanation</div><h2>How AI was involved in this case</h2><p>What AI contributed, who exercised authority and what happened next.</p></div><div className="purpose"><strong>This view starts with your case.</strong><br />The wider system is secondary to understanding what happened and what you can do next.</div></header>{r ? <article className="case"><div className="kicker">This particular case</div><div className="timeline"><div className="step ai"><span>AI</span><strong>{r.aiSummary}</strong></div><div className="step"><span>What happened next</span><strong>{r.effectOfAi}</strong></div><div className="step human"><span>Person</span><strong>{r.humanInvolvement ?? "No human involvement is recorded."}</strong></div><div className="step"><span>Outcome</span><strong>{r.outcome}</strong></div></div><div className="case-bottom"><div className="authority"><span>Who had final authority?</span><strong>{authorityLabel(r.finalAuthority)}</strong></div><div className="challenge"><span>Questions or concerns?</span><strong>{c?.available ? c.description ?? c.uri ?? "A challenge route is available." : "No challenge route is recorded."}</strong></div></div></article> : <div className="gap">No case-specific record is visible to the affected person.</div>}<details className="fold"><summary>About the wider AI process</summary><div className="vtitle"><h3>Where AI sits</h3></div>{s.nodes.length ? <Flow nodes={s.nodes} /> : <div className="gap">No process is visible.</div>}</details></div>;
}

function InternalView({ s }: { s: Snapshot }) {
  const evidence = s.claims.flatMap((item) => item.evidence);
  return <div className="canvas"><header className="head"><div><div className="kicker">{s.organisation} · internal scrutiny</div><h2>{s.useName}</h2><p>{s.summary}</p></div><div className="purpose"><strong>For the people responsible for this use.</strong><br />Test whether process, authority and evidence line up — and notice what still needs attention.</div></header><div className="facts"><div className="fact"><span>Evidence linked</span><strong>{evidence.length}</strong></div><div className="fact"><span>Gaps / unknowns</span><strong>{s.unknowns.length}</strong></div><div className="fact"><span>Runtime observations</span><strong>{s.observationCount}</strong></div></div><div className="vtitle"><h3>Process & authority</h3><span>Where does AI stop and human authority begin?</span></div>{s.nodes.length ? <Flow nodes={s.nodes} /> : <div className="gap">No process is recorded.</div>}<div className="three"><article className="card"><h3>What we say</h3>{s.claims.length ? s.claims.map((item) => <div className="line" key={item.id}><span className={`mark ${item.evidence.length ? "good" : "warn"}`}>{item.evidence.length ? "✓" : "○"}</span><div><strong>{item.statement}</strong><small>{item.evidence.length ? `${item.evidence.length} linked evidence item${item.evidence.length === 1 ? "" : "s"}` : "No linked evidence"}</small></div></div>) : <div className="gap">No scoped claims are recorded.</div>}</article><article className="card"><h3>Evidence & limits</h3>{evidence.length ? evidence.map((item) => <div className="ev" key={item.id}><span className="es">✓</span><div><strong>{item.summary}</strong><small>{evidenceKindLabel(item.kind)}</small>{item.limitations.length ? <small>△ {item.limitations.join(" · ")}</small> : null}</div></div>) : <div className="gap">No evidence is linked yet.</div>}</article><article className="card"><h3>Gaps & unknowns</h3>{s.unknowns.length ? s.unknowns.map((item) => <div className="gap" key={item}>{item}</div>) : <div className="line"><span className="mark good">✓</span><div><strong>No obvious structural gaps in this example.</strong><small>That is not a trust or safety score.</small></div></div>}</article></div><details className="fold"><summary>Operational and technical detail</summary><div className="two"><article className="card"><h3>System</h3><div className="line"><span className="mark">AI</span><div><strong>{s.systemName}</strong><small>Version {s.version ?? "unknown"}</small></div></div>{s.agency ? <div className="line"><span className="mark">→</span><div><strong>{agencyLabel[s.agency]}</strong></div></div> : null}</article><article className="card"><h3>Observed activity</h3><div className="metric">{s.observationCount}</div><small className="muted">runtime observation{s.observationCount === 1 ? "" : "s"} attached to this record</small></article></div></details></div>;
}

export function AudienceWorkbench() {
  const initial = examples[1]!.bundle;
  const [bundle, setBundle] = useState<CruxPortableBundle>(() => structuredClone(initial));
  const [lens, setLens] = useState<Lens>("public");
  const [exampleId, setExampleId] = useState("funding-review");
  const [error, setError] = useState<string | null>(null);
  const structural = useMemo(() => portableBundleSchema.safeParse(bundle), [bundle]);
  const refs = useMemo(() => structural.success ? validateBundleReferences(structural.data) : null, [structural]);
  const canonical = structural.success && refs?.valid ? structural.data : null;
  const projection = useMemo(() => canonical && lens !== "working" ? redactBundle(canonical, lens) : null, [canonical, lens]);
  const snapshot = useMemo(() => projection ? snapshotFromProjection(projection) : snapshotFromCanonical(bundle), [projection, bundle]);

  const load = (example: ExampleCase) => { setBundle(structuredClone(example.bundle)); setExampleId(example.id); setLens("public"); setError(null); };
  const open = async (file: File | undefined) => { if (!file) return; try { setBundle(parsePortableBundle(JSON.parse(await file.text()) as unknown)); setExampleId(""); setLens("public"); setError(null); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open this CRUX record."); } };

  return <section className="workbench aud" aria-label="CRUX audience views"><style>{styles}</style><div className="aud-top"><div className="aud-group"><span className="aud-label">Example</span>{examples.map((item) => <button type="button" className={`ex ${exampleId === item.id ? "on" : ""}`} key={item.id} onClick={() => load(item)}>{item.name}</button>)}</div><div className="aud-group"><label className="btn file-label">Open your record<input type="file" accept="application/json,.json" onChange={(event) => void open(event.target.files?.[0])} /></label><a className="btn" href="/author">Create or edit a record</a></div></div><div className="aud-switch">{(["working", "public", "affected_party"] as Lens[]).map((item) => <button type="button" key={item} className={`aud-choice ${lens === item ? "on" : ""}`} disabled={item !== "working" && !canonical} onClick={() => setLens(item)}><span>{audience[item].label}</span><strong>{audience[item].job}</strong><small>{audience[item].intro}</small></button>)}</div>{error ? <div className="error-box" style={{ margin: 18 }}>{error}</div> : null}{lens === "working" ? <InternalView s={snapshot} /> : lens === "public" ? <PublicView s={snapshot} /> : <AffectedView s={snapshot} />}<div className="foot"><span>Same CRUX record; different audience purpose.</span><span>{lens === "working" ? "Internal reads the working record." : `${audience[lens].label} uses a disclosure-safe projection.`}</span></div></section>;
}
