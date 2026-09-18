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
import writingAssistantJson from "../../../examples/writing-assistant/crux.json";
import fundingReviewJson from "../../../examples/funding-review/crux.json";
import boundedActionJson from "../../../examples/bounded-action/crux.json";

type Lens = "working" | "public" | "affected_party";
type Challenge = { available: boolean; description?: string; uri?: string };
type ViewNode = { id: string; type: string; name: string };
type ViewEvidence = { id: string; summary: string; kind: string; relationship: string; limitations: string[] };
type ViewClaim = { id: string; statement: string; evidence: ViewEvidence[] };
type ViewDecision = { id: string; name: string; authority: string; reviewBeforeEffect: boolean; challenge?: Challenge };
type ViewReceipt = { aiSummary: string; effectOfAi: string; humanInvolvement?: string; finalAuthority: string; outcome: string; challenge?: Challenge };

type ViewModel = {
  organisationName: string;
  useName: string;
  summary: string;
  consequential: boolean;
  peopleAffected: string[];
  influence: AIInfluence[];
  agency: AIAgency | undefined;
  systemName: string;
  version: string | undefined;
  nodes: ViewNode[];
  decisions: ViewDecision[];
  claims: ViewClaim[];
  receipt?: ViewReceipt;
  unknowns: string[];
  observationCount: number;
};

type ExampleCase = { id: string; name: string; note: string; bundle: CruxPortableBundle };

const examples: ExampleCase[] = [
  { id: "writing-assistant", name: "Writing assistant", note: "Low consequence", bundle: parsePortableBundle(writingAssistantJson as unknown) },
  { id: "funding-review", name: "Funding review", note: "Human decision", bundle: parsePortableBundle(fundingReviewJson as unknown) },
  { id: "bounded-action", name: "Bounded action", note: "Bounded action", bundle: parsePortableBundle(boundedActionJson as unknown) },
];

const audienceCopy: Record<Lens, { label: string; job: string; intro: string }> = {
  working: { label: "Internal", job: "Scrutinise & improve", intro: "Evidence, gaps and operational detail for the people responsible for the system." },
  public: { label: "Public", job: "Understand the system", intro: "A short explanation of where AI is used, what it can do and who remains responsible." },
  affected_party: { label: "Affected person", job: "Understand my case", intro: "What AI did in this case, who made the decision and how to ask questions or challenge it." },
};

const influenceLabel: Record<AIInfluence, string> = {
  assistive: "Draft or transform",
  informational: "Find or surface information",
  advisory: "Recommend",
  conditional: "Influence what happens next",
  decisional: "Contribute directly to a decision",
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

const relationLabel = (value: string) => value === "supports" ? "Supports" : value === "qualifies" ? "Qualifies" : value === "contradicts" ? "Challenges" : "Inconclusive";

const normaliseChallenge = (value: { available: boolean; description?: string | undefined; uri?: string | undefined } | undefined): Challenge | undefined => {
  if (!value) return undefined;
  return {
    available: value.available,
    ...(value.description ? { description: value.description } : {}),
    ...(value.uri ? { uri: value.uri } : {}),
  };
};

const findCanonical = (bundle: CruxPortableBundle) => {
  const use = bundle.ai_uses[0];
  const system = use ? bundle.systems.find((item) => use.system_refs.includes(item.id) || item.ai_use_refs.includes(use.id)) : undefined;
  const version = system?.current_version_ref
    ? bundle.system_versions.find((item) => item.id === system.current_version_ref)
    : bundle.system_versions.find((item) => item.system_ref === system?.id);
  return { use, system, version };
};

const buildWorkingView = (bundle: CruxPortableBundle): ViewModel => {
  const { use, system, version } = findCanonical(bundle);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claims = bundle.claims.filter((claim) => claim.applies_to.some((target) => refs.has(target.ref)));
  const viewClaims = claims.map((claim): ViewClaim => {
    const links = bundle.evidence_links.filter((link) => link.claim_ref === claim.id);
    return {
      id: claim.id,
      statement: claim.statement,
      evidence: links.flatMap((link) => {
        const item = bundle.evidence.find((candidate) => candidate.id === link.evidence_ref);
        return item ? [{ id: item.id, summary: item.summary, kind: item.kind, relationship: link.relationship, limitations: item.limitations }] : [];
      }),
    };
  });
  const unknowns: string[] = [];
  for (const component of version?.components ?? []) {
    if (component.kind === "model" && component.model_identifier?.status !== "known") unknowns.push(`${component.name}: model identifier ${component.model_identifier?.status?.replaceAll("_", " ") ?? "unknown"}`);
  }
  for (const claim of viewClaims) if (!claim.evidence.length) unknowns.push(`No evidence linked to: ${claim.statement}`);
  if (use?.consequential && !(version?.decisions.length)) unknowns.push("This use is consequential but no decision authority is recorded.");
  const receipt = version ? bundle.receipts.find((item) => item.system_version_ref === version.id) : undefined;

  return {
    organisationName: bundle.organisations[0]?.name ?? "Your organisation",
    useName: use?.name ?? "AI use",
    summary: use?.public_summary || use?.purpose || system?.description || "No explanation recorded.",
    consequential: use?.consequential ?? false,
    peopleAffected: use?.people_affected ?? [],
    influence: system ? [...system.influence] : [],
    agency: system?.agency,
    systemName: system?.name ?? "AI system",
    version: version?.version,
    nodes: version?.process.nodes.map((node) => ({ id: node.id, type: node.type, name: node.name })) ?? [],
    decisions: version?.decisions.map((decision) => ({ id: decision.id, name: decision.name, authority: decision.authority, reviewBeforeEffect: decision.review_before_effect, ...(decision.challenge ? { challenge: normaliseChallenge(decision.challenge) } : {}) })) ?? [],
    claims: viewClaims,
    ...(receipt ? { receipt: { aiSummary: receipt.ai_summary, effectOfAi: receipt.effect_of_ai, ...(receipt.human_involvement ? { humanInvolvement: receipt.human_involvement } : {}), finalAuthority: receipt.final_authority, outcome: receipt.outcome, ...(receipt.challenge ? { challenge: normaliseChallenge(receipt.challenge) } : {}) } } : {}),
    unknowns,
    observationCount: version ? bundle.observations.filter((item) => item.system_version_ref === version.id).length : 0,
  };
};

const buildProjectedView = (projection: CruxDisclosureBundle): ViewModel => {
  const use = projection.ai_uses[0];
  const system = use ? projection.systems.find((item) => use.system_refs.includes(item.id) || item.ai_use_refs.includes(use.id)) : undefined;
  const version = system?.current_version_ref
    ? projection.system_versions.find((item) => item.id === system.current_version_ref)
    : projection.system_versions.find((item) => item.system_ref === system?.id);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claims = projection.claims.filter((claim) => claim.applies_to.some((target) => refs.has(target.ref)));
  const viewClaims = claims.map((claim): ViewClaim => {
    const links = projection.claim_evidence_links.filter((link) => link.claim_ref === claim.id);
    return {
      id: claim.id,
      statement: claim.statement,
      evidence: links.flatMap((link) => {
        const item = projection.evidence.find((candidate) => candidate.id === link.evidence_ref);
        return item ? [{ id: item.id, summary: item.summary, kind: item.kind, relationship: link.relationship, limitations: item.limitations }] : [];
      }),
    };
  });
  const unknowns: string[] = [];
  for (const component of version?.components ?? []) {
    if (component.kind === "model" && component.model_identifier?.status !== "known") unknowns.push(`${component.name}: model identifier ${component.model_identifier?.status?.replaceAll("_", " ") ?? "unknown"}`);
  }
  for (const claim of viewClaims) if (!claim.evidence.length) unknowns.push(`No evidence is visible for: ${claim.statement}`);
  const projectedReceipt = projection.trace_views.find((trace) => trace.receipt)?.receipt;

  return {
    organisationName: projection.organisations[0]?.name ?? "Organisation",
    useName: use?.name ?? "AI use",
    summary: use?.public_summary ?? system?.description ?? "No explanation is visible.",
    consequential: use?.consequential ?? false,
    peopleAffected: use?.people_affected ?? [],
    influence: system ? [...system.influence] : [],
    agency: system?.agency,
    systemName: system?.name ?? "AI system",
    version: version?.version,
    nodes: version?.process.nodes.map((node) => ({ id: node.id, type: node.type, name: node.name })) ?? [],
    decisions: version?.decisions.map((decision) => ({ id: decision.id, name: decision.name, authority: decision.authority, reviewBeforeEffect: decision.review_before_effect, ...(decision.challenge ? { challenge: normaliseChallenge(decision.challenge) } : {}) })) ?? [],
    claims: viewClaims,
    ...(projectedReceipt ? { receipt: { aiSummary: projectedReceipt.ai_summary, effectOfAi: projectedReceipt.effect_of_ai, ...(projectedReceipt.human_involvement ? { humanInvolvement: projectedReceipt.human_involvement } : {}), finalAuthority: projectedReceipt.final_authority, outcome: projectedReceipt.outcome, ...(projectedReceipt.challenge ? { challenge: normaliseChallenge(projectedReceipt.challenge) } : {}) } } : {}),
    unknowns,
    observationCount: projection.observations.length,
  };
};

const styles = `
.audience-shell{overflow:hidden}.audience-toolbar{padding:14px 18px;display:flex;gap:16px;justify-content:space-between;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--line);background:rgba(255,255,255,.36)}.audience-group{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.audience-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:800}.example-link{border:0;background:transparent;padding:7px 9px;color:var(--muted);font-weight:700;font-size:12px;border-radius:999px;cursor:pointer}.example-link.active,.example-link:hover{background:var(--chalk);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
.audience-switch{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-bottom:1px solid var(--line)}.audience-choice{border:0;border-right:1px solid var(--line);background:rgba(255,255,255,.18);padding:18px 20px;text-align:left;cursor:pointer;display:grid;gap:4px}.audience-choice:last-child{border-right:0}.audience-choice.active{background:var(--chalk);box-shadow:inset 0 -3px 0 var(--rust)}.audience-choice span{color:var(--rust);font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.audience-choice strong{font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:400}.audience-choice small{color:var(--muted);line-height:1.35}
.view-canvas{padding:clamp(24px,4vw,48px);background:rgba(255,253,248,.68)}.view-header{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:30px;align-items:start;margin-bottom:30px}.view-header h2{font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:clamp(36px,5vw,64px);line-height:.98;letter-spacing:-.045em;margin:5px 0 12px}.view-header p{color:var(--muted);font-size:16px;line-height:1.55;max-width:760px;margin:0}.view-purpose{border-left:3px solid var(--rust);padding:4px 0 4px 16px;color:var(--muted);line-height:1.45;font-size:13px}
.quick-facts{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:20px;overflow:hidden;margin-bottom:28px}.quick-fact{padding:15px 17px;border-right:1px solid var(--line);background:rgba(255,255,255,.4)}.quick-fact:last-child{border-right:0}.quick-fact span{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}.quick-fact strong{font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:400}
.visual-title{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:28px 0 12px}.visual-title h3,.visual-card h3{font-family:Georgia,'Times New Roman',serif;font-size:25px;font-weight:400;margin:0}.visual-title span{color:var(--muted);font-size:12px}.process-visual{display:flex;align-items:stretch;gap:8px;overflow-x:auto;padding:5px 0 12px}.process-card{min-width:150px;flex:1 0 150px;border:1px solid var(--line);border-radius:17px;padding:15px;background:var(--chalk);min-height:108px}.process-card.ai{border:2px solid rgba(168,76,50,.5);background:rgba(168,76,50,.055)}.process-card.human{border:2px solid rgba(64,88,74,.42);background:rgba(64,88,74,.05)}.process-card.decision{border-radius:4px 17px 4px 17px;border-color:rgba(64,88,74,.55)}.process-card span{display:block;font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin-bottom:18px}.process-card strong{font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.25;font-weight:400}.process-arrow{display:grid;place-items:center;color:var(--muted);min-width:22px}.authority-boundary{min-width:76px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;color:var(--rust)}.authority-boundary:before{content:'';width:1px;height:42px;background:var(--rust)}.authority-boundary b{font-size:8px;letter-spacing:.13em;text-transform:uppercase;text-align:center}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}.three-col{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px}.visual-card{border:1px solid var(--line);border-radius:20px;padding:20px;background:rgba(255,255,255,.38)}.visual-card h3{margin-bottom:12px}.icon-line,.evidence-chip{display:flex;gap:11px;align-items:flex-start;padding:11px 0;border-top:1px solid var(--line)}.icon-line:first-of-type,.evidence-chip:first-of-type{border-top:0}.icon-mark{width:27px;height:27px;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;flex:0 0 27px;font-size:10px;font-weight:900}.icon-mark.yes{color:var(--moss);border-color:rgba(64,88,74,.4)}.icon-mark.no{color:var(--rust);border-color:rgba(168,76,50,.35)}.icon-line strong,.evidence-chip strong{display:block;line-height:1.35}.icon-line small,.evidence-chip small{display:block;color:var(--muted);line-height:1.4;margin-top:3px}.evidence-symbol{font-weight:900;color:var(--moss);font-size:17px}.evidence-symbol.other{color:var(--rust)}.gap{border:1px dashed rgba(119,120,111,.5);border-radius:14px;padding:12px 14px;margin-top:9px;color:var(--muted);font-size:13px;line-height:1.4}.gap:before{content:'○';margin-right:8px}
.case-hero{border:1px solid var(--line);border-radius:24px;padding:clamp(20px,3vw,32px);background:var(--chalk)}.case-timeline{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.case-step{border:1px solid var(--line);border-radius:16px;padding:16px;min-height:138px}.case-step.ai{border-color:rgba(168,76,50,.42);background:rgba(168,76,50,.04)}.case-step.human{border-color:rgba(64,88,74,.42);background:rgba(64,88,74,.04)}.case-step span{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;font-weight:900;color:var(--muted);margin-bottom:14px}.case-step strong{font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:400;line-height:1.3}.case-decision{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.authority-callout,.challenge-callout{border-radius:20px;padding:22px}.authority-callout{background:var(--moss);color:var(--chalk)}.challenge-callout{border:1px solid rgba(168,76,50,.35);background:rgba(168,76,50,.05)}.authority-callout span,.challenge-callout span{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:900;margin-bottom:9px}.authority-callout span{opacity:.75}.challenge-callout span{color:var(--rust)}.authority-callout strong,.challenge-callout strong{font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;line-height:1.3}.detail-fold{margin-top:20px;border-top:1px solid var(--line);padding-top:14px}.detail-fold summary{cursor:pointer;font-size:12px;font-weight:800}.internal-metric{font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:1;margin:5px 0 8px}.view-footer{padding:13px 18px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:11px}
@media(max-width:900px){.view-header{grid-template-columns:1fr}.three-col{grid-template-columns:1fr}.case-timeline{grid-template-columns:1fr 1fr}.audience-choice small{display:none}}@media(max-width:680px){.audience-switch{grid-template-columns:1fr}.audience-choice{border-right:0;border-bottom:1px solid var(--line)}.quick-facts,.two-col,.case-decision,.case-timeline{grid-template-columns:1fr}.quick-fact{border-right:0;border-bottom:1px solid var(--line)}.quick-fact:last-child{border-bottom:0}.view-canvas{padding:20px}}
`;

function ProcessVisual({ nodes }: { nodes: ViewNode[] }) {
  return <div className="process-visual">{nodes.map((node, index) => {
    const previous = nodes[index - 1];
    const boundary = previous?.type === "ai" && (node.type === "human" || node.type === "decision");
    return <div style={{ display: "contents" }} key={node.id}>{index > 0 ? boundary ? <div className="authority-boundary"><b>AI stops here</b></div> : <div className="process-arrow">→</div> : null}<article className={`process-card ${node.type === "ai" ? "ai" : ""} ${node.type === "human" ? "human" : ""} ${node.type === "decision" ? "decision" : ""}`}><span>{nodeLabel[node.type] ?? node.type}</span><strong>{node.name}</strong></article></div>;
  })}</div>;
}

function PublicView({ view }: { view: ViewModel }) {
  const decision = view.decisions[0];
  const evidence = view.claims.flatMap((claim) => claim.evidence);
  return <div className="view-canvas">
    <header className="view-header"><div><div className="kicker">{view.organisationName} · public explanation</div><h2>How AI is used in {view.useName}</h2><p>{view.summary}</p></div><div className="view-purpose"><strong>For anyone using or interested in this service.</strong><br />This view explains the role and limits of AI without exposing internal operational detail.</div></header>
    <div className="quick-facts"><div className="quick-fact"><span>AI does</span><strong>{view.influence.map((item) => influenceLabel[item]).join(" · ") || "Not described"}</strong></div><div className="quick-fact"><span>AI does not</span><strong>{view.agency === "none" ? "Act by itself" : view.agency ? agencyLabel[view.agency] : "Not recorded"}</strong></div><div className="quick-fact"><span>Final authority</span><strong>{decision?.authority ? decision.authority.replaceAll("_", " ") : "Not recorded"}</strong></div></div>
    <div className="visual-title"><h3>How it works</h3><span>Follow the work, not the technology.</span></div>{view.nodes.length ? <ProcessVisual nodes={view.nodes} /> : <div className="gap">The public process has not been described yet.</div>}
    <div className="two-col"><article className="visual-card"><h3>Who decides?</h3>{decision ? <div className="icon-line"><span className="icon-mark yes">✓</span><div><strong>{decision.name}</strong><small>{decision.authority.replaceAll("_", " ")} authority{decision.reviewBeforeEffect ? " · review before effect" : ""}</small></div></div> : <div className="gap">Decision authority is not visible.</div>}</article><article className="visual-card"><h3>How we know</h3>{evidence.length ? evidence.map((item) => <div className="evidence-chip" key={item.id}><span className={`evidence-symbol ${item.relationship === "supports" ? "" : "other"}`}>{item.relationship === "supports" ? "✓" : "△"}</span><div><strong>{item.summary}</strong><small>{relationLabel(item.relationship)} · {item.kind.replaceAll("_", " ")}</small></div></div>) : <div className="gap">No public evidence is linked yet.</div>}</article></div>
    {view.unknowns.length ? <><div className="visual-title"><h3>Not known or disclosed</h3></div>{view.unknowns.map((item) => <div className="gap" key={item}>{item}</div>)}</> : null}
  </div>;
}

function AffectedView({ view }: { view: ViewModel }) {
  const receipt = view.receipt;
  const decision = view.decisions[0];
  const challenge = receipt?.challenge ?? decision?.challenge;
  return <div className="view-canvas">
    <header className="view-header"><div><div className="kicker">{view.organisationName} · affected-person explanation</div><h2>How AI was involved in this case</h2><p>What AI contributed, who exercised authority and what happened next.</p></div><div className="view-purpose"><strong>This view starts with the case.</strong><br />The wider system matters only insofar as it helps explain what happened to the person affected.</div></header>
    {receipt ? <article className="case-hero"><div className="kicker">This particular case</div><div className="case-timeline"><div className="case-step ai"><span>AI</span><strong>{receipt.aiSummary}</strong></div><div className="case-step"><span>What happened next</span><strong>{receipt.effectOfAi}</strong></div><div className="case-step human"><span>Person</span><strong>{receipt.humanInvolvement ?? "No human involvement is recorded."}</strong></div><div className="case-step"><span>Outcome</span><strong>{receipt.outcome}</strong></div></div><div className="case-decision"><div className="authority-callout"><span>Who had final authority?</span><strong>{receipt.finalAuthority.replaceAll("_", " ")}</strong></div><div className="challenge-callout"><span>Questions or concerns?</span><strong>{challenge?.available ? challenge.description ?? challenge.uri ?? "A challenge route is available." : "No challenge route is recorded."}</strong></div></div></article> : <div className="gap">No case-specific record is visible to the affected person.</div>}
    <details className="detail-fold"><summary>About the AI system used in this process</summary><div className="visual-title"><h3>Where AI sits in the wider process</h3></div>{view.nodes.length ? <ProcessVisual nodes={view.nodes} /> : <div className="gap">No process is visible.</div>}</details>
  </div>;
}

function InternalView({ view }: { view: ViewModel }) {
  const evidenceCount = view.claims.reduce((sum, claim) => sum + claim.evidence.length, 0);
  return <div className="view-canvas">
    <header className="view-header"><div><div className="kicker">{view.organisationName} · internal scrutiny</div><h2>{view.useName}</h2><p>{view.summary}</p></div><div className="view-purpose"><strong>For the people responsible for this use.</strong><br />Test whether the intended process, authority and evidence line up — and notice what still needs attention.</div></header>
    <div className="quick-facts"><div className="quick-fact"><span>Evidence linked</span><strong>{evidenceCount}</strong></div><div className="quick-fact"><span>Gaps / unknowns</span><strong>{view.unknowns.length}</strong></div><div className="quick-fact"><span>Runtime observations</span><strong>{view.observationCount}</strong></div></div>
    <div className="visual-title"><h3>Process & authority</h3><span>Where does AI stop and human authority begin?</span></div>{view.nodes.length ? <ProcessVisual nodes={view.nodes} /> : <div className="gap">No process is recorded.</div>}
    <div className="three-col"><article className="visual-card"><h3>What we say</h3>{view.claims.length ? view.claims.map((claim) => <div className="icon-line" key={claim.id}><span className={`icon-mark ${claim.evidence.length ? "yes" : "no"}`}>{claim.evidence.length ? "✓" : "○"}</span><div><strong>{claim.statement}</strong><small>{claim.evidence.length ? `${claim.evidence.length} linked evidence item${claim.evidence.length === 1 ? "" : "s"}` : "No linked evidence"}</small></div></div>) : <div className="gap">No scoped claims are recorded.</div>}</article><article className="visual-card"><h3>Evidence & limits</h3>{view.claims.flatMap((claim) => claim.evidence).length ? view.claims.flatMap((claim) => claim.evidence).map((item) => <div className="evidence-chip" key={item.id}><span className="evidence-symbol">✓</span><div><strong>{item.summary}</strong><small>{item.kind.replaceAll("_", " ")}</small>{item.limitations.length ? <small>△ {item.limitations.join(" · ")}</small> : null}</div></div>) : <div className="gap">No evidence is linked yet.</div>}</article><article className="visual-card"><h3>Gaps & unknowns</h3>{view.unknowns.length ? view.unknowns.map((item) => <div className="gap" key={item}>{item}</div>) : <div className="icon-line"><span className="icon-mark yes">✓</span><div><strong>No obvious structural gaps in this example.</strong><small>That is not a trust or safety score.</small></div></div>}</article></div>
    <details className="detail-fold"><summary>Operational and technical detail</summary><div className="two-col"><article className="visual-card"><h3>System</h3><div className="icon-line"><span className="icon-mark">AI</span><div><strong>{view.systemName}</strong><small>Version {view.version ?? "unknown"}</small></div></div>{view.agency ? <div className="icon-line"><span className="icon-mark">→</span><div><strong>{agencyLabel[view.agency]}</strong></div></div> : null}</article><article className="visual-card"><h3>Observed activity</h3><div className="internal-metric">{view.observationCount}</div><small className="muted">runtime observation{view.observationCount === 1 ? "" : "s"} attached to this record</small></article></div></details>
  </div>;
}

export function AudienceWorkbench() {
  const initial = examples[1]!.bundle;
  const [bundle, setBundle] = useState<CruxPortableBundle>(() => structuredClone(initial));
  const [lens, setLens] = useState<Lens>("public");
  const [activeExample, setActiveExample] = useState("funding-review");
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => portableBundleSchema.safeParse(bundle), [bundle]);
  const refs = useMemo(() => parsed.success ? validateBundleReferences(parsed.data) : null, [parsed]);
  const canonical = parsed.success && refs?.valid ? parsed.data : null;
  const projection = useMemo(() => canonical && lens !== "working" ? redactBundle(canonical, lens) : null, [canonical, lens]);
  const view = useMemo(() => projection ? buildProjectedView(projection) : buildWorkingView(bundle), [projection, bundle]);

  const loadExample = (example: ExampleCase) => { setBundle(structuredClone(example.bundle)); setActiveExample(example.id); setLens("public"); setError(null); };
  const openBundle = async (file: File | undefined) => {
    if (!file) return;
    try { const next = parsePortableBundle(JSON.parse(await file.text()) as unknown); setBundle(next); setActiveExample(""); setLens("public"); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open this CRUX record."); }
  };

  return <section className="workbench audience-shell" aria-label="CRUX audience views"><style>{styles}</style>
    <div className="audience-toolbar"><div className="audience-group"><span className="audience-label">Example</span>{examples.map((example) => <button type="button" className={`example-link ${activeExample === example.id ? "active" : ""}`} key={example.id} onClick={() => loadExample(example)} title={example.note}>{example.name}</button>)}</div><div className="audience-group"><label className="btn file-label">Open your record<input type="file" accept="application/json,.json" onChange={(event) => void openBundle(event.target.files?.[0])} /></label><a className="btn" href="/author">Create or edit a record</a></div></div>
    <div className="audience-switch">{(["working", "public", "affected_party"] as Lens[]).map((item) => <button type="button" key={item} className={`audience-choice ${lens === item ? "active" : ""}`} disabled={item !== "working" && !canonical} onClick={() => setLens(item)}><span>{audienceCopy[item].label}</span><strong>{audienceCopy[item].job}</strong><small>{audienceCopy[item].intro}</small></button>)}</div>
    {error ? <div className="error-box" style={{ margin: 18 }}>{error}</div> : null}
    {lens === "working" ? <InternalView view={view} /> : lens === "public" ? <PublicView view={view} /> : <AffectedView view={view} />}
    <div className="view-footer"><span>Same CRUX record; different audience purpose.</span><span>{lens === "working" ? "Internal reads the working record." : `${audienceCopy[lens].label} uses a disclosure-safe projection.`}</span></div>
  </section>;
}
