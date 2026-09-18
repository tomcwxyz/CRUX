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

type ViewNode = { id: string; type: string; name: string; description?: string };
type ViewDecision = { id: string; name: string; authority: string; reviewBeforeEffect: boolean; challenge?: { available: boolean; description?: string; uri?: string } };
type ViewAction = { id: string; name: string; initiatedBy: string; humanApprovalRequired: boolean; reversibility: string; scope: string };
type ViewEvidence = { id: string; kind: string; summary: string; limitations: string[]; externalRefs: string[] };
type ViewReceipt = { id: string; aiSummary: string; effectOfAi: string; humanInvolvement?: string; finalAuthority: string; outcome: string; challenge?: { available: boolean; description?: string; uri?: string } };

type ViewModel = {
  organisationName: string;
  use?: { id: string; name: string; summary: string; consequential: boolean; peopleAffected: string[] };
  system?: { id: string; name: string; description: string; influence: AIInfluence[]; agency: AIAgency };
  version?: {
    id: string;
    version: string;
    processName: string;
    nodes: ViewNode[];
    decisions: ViewDecision[];
    actions: ViewAction[];
    modelKnowledge: string[];
  };
  claims: Array<{ id: string; statement: string }>;
  evidence: ViewEvidence[];
  links: Array<{ claimRef: string; evidenceRef: string; relationship: string }>;
  receipts: ViewReceipt[];
  observationCount: number;
};

type ExampleCase = { id: string; name: string; note: string; bundle: CruxPortableBundle };

const examples: ExampleCase[] = [
  { id: "writing-assistant", name: "Writing assistant", note: "Low consequence", bundle: parsePortableBundle(writingAssistantJson as unknown) },
  { id: "funding-review", name: "Funding review", note: "Human decision", bundle: parsePortableBundle(fundingReviewJson as unknown) },
  { id: "bounded-action", name: "Bounded action", note: "Bounded action", bundle: parsePortableBundle(boundedActionJson as unknown) },
];

const audienceCopy: Record<Lens, { label: string; job: string; intro: string }> = {
  working: {
    label: "Internal",
    job: "Scrutinise & improve",
    intro: "See the intended process, evidence gaps, operational detail and what needs attention.",
  },
  public: {
    label: "Public",
    job: "Understand the system",
    intro: "A plain-language explanation of where AI is used, what it can do and who remains responsible.",
  },
  affected_party: {
    label: "Affected person",
    job: "Understand my case",
    intro: "See what role AI played in a particular case, who made the decision and how to ask questions or challenge it.",
  },
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

const relationshipLabel = (relationship: string) => {
  if (relationship === "supports") return "Supports";
  if (relationship === "qualifies") return "Qualifies";
  if (relationship === "contradicts") return "Challenges";
  return "Inconclusive";
};

const selectedCanonicalSystem = (bundle: CruxPortableBundle, use: CruxPortableBundle["ai_uses"][number] | undefined) => {
  if (!use) return undefined;
  return bundle.systems.find((system) => use.system_refs.includes(system.id) || system.ai_use_refs.includes(use.id));
};

const selectedCanonicalVersion = (bundle: CruxPortableBundle, system: CruxPortableBundle["systems"][number] | undefined) => {
  if (!system) return undefined;
  return system.current_version_ref
    ? bundle.system_versions.find((version) => version.id === system.current_version_ref)
    : bundle.system_versions.find((version) => version.system_ref === system.id);
};

const relevantClaim = (claim: { applies_to: Array<{ ref: string }> }, refs: Set<string>) =>
  claim.applies_to.some((target) => refs.has(target.ref));

const modelKnowledge = (components: Array<{ kind: string; name: string; model_identifier?: { status: string; value?: string }; provider?: { status: string; value?: string } }>) =>
  components
    .filter((component) => component.kind === "model")
    .flatMap((component) => {
      const items: string[] = [];
      if (!component.model_identifier || component.model_identifier.status !== "known") items.push(`${component.name}: model identifier ${component.model_identifier?.status?.replaceAll("_", " ") ?? "unknown"}`);
      if (component.provider && component.provider.status !== "known") items.push(`${component.name}: provider ${component.provider.status.replaceAll("_", " ")}`);
      return items;
    });

const normaliseWorking = (bundle: CruxPortableBundle): ViewModel => {
  const use = bundle.ai_uses[0];
  const system = selectedCanonicalSystem(bundle, use);
  const version = selectedCanonicalVersion(bundle, system);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claims = bundle.claims.filter((claim) => relevantClaim(claim, refs));
  const claimIds = new Set(claims.map((claim) => claim.id));
  const links = bundle.evidence_links.filter((link) => claimIds.has(link.claim_ref));
  const evidenceIds = new Set(links.map((link) => link.evidence_ref));
  const evidence = bundle.evidence.filter((item) => evidenceIds.has(item.id));
  const receipts = version ? bundle.receipts.filter((receipt) => receipt.system_version_ref === version.id) : [];

  return {
    organisationName: bundle.organisations[0]?.name ?? "Your organisation",
    ...(use ? { use: { id: use.id, name: use.name, summary: use.public_summary || use.purpose, consequential: use.consequential, peopleAffected: use.people_affected } } : {}),
    ...(system ? { system: { id: system.id, name: system.name, description: system.description, influence: [...system.influence], agency: system.agency } } : {}),
    ...(version ? {
      version: {
        id: version.id,
        version: version.version,
        processName: version.process.name,
        nodes: version.process.nodes.map((node) => ({ id: node.id, type: node.type, name: node.name, ...(node.description ? { description: node.description } : {}) })),
        decisions: version.decisions.map((decision) => ({ id: decision.id, name: decision.name, authority: decision.authority, reviewBeforeEffect: decision.review_before_effect, ...(decision.challenge ? { challenge: decision.challenge } : {}) })),
        actions: version.actions.map((action) => ({ id: action.id, name: action.name, initiatedBy: action.initiated_by, humanApprovalRequired: action.human_approval_required, reversibility: action.reversibility, scope: action.scope.summary })),
        modelKnowledge: modelKnowledge(version.components),
      },
    } : {}),
    claims: claims.map((claim) => ({ id: claim.id, statement: claim.statement })),
    evidence: evidence.map((item) => ({ id: item.id, kind: item.kind, summary: item.summary, limitations: item.limitations, externalRefs: item.external_refs })),
    links: links.map((link) => ({ claimRef: link.claim_ref, evidenceRef: link.evidence_ref, relationship: link.relationship })),
    receipts: receipts.map((receipt) => ({ id: receipt.id, aiSummary: receipt.ai_summary, effectOfAi: receipt.effect_of_ai, ...(receipt.human_involvement ? { humanInvolvement: receipt.human_involvement } : {}), finalAuthority: receipt.final_authority, outcome: receipt.outcome, ...(receipt.challenge ? { challenge: receipt.challenge } : {}) })),
    observationCount: version ? bundle.observations.filter((item) => item.system_version_ref === version.id).length : 0,
  };
};

const normaliseProjection = (projection: CruxDisclosureBundle): ViewModel => {
  const use = projection.ai_uses[0];
  const system = use ? projection.systems.find((item) => use.system_refs.includes(item.id) || item.ai_use_refs.includes(use.id)) : undefined;
  const version = system?.current_version_ref
    ? projection.system_versions.find((item) => item.id === system.current_version_ref)
    : projection.system_versions.find((item) => item.system_ref === system?.id);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claims = projection.claims.filter((claim) => relevantClaim(claim, refs));
  const claimIds = new Set(claims.map((claim) => claim.id));
  const links = projection.claim_evidence_links.filter((link) => claimIds.has(link.claim_ref));
  const evidenceIds = new Set(links.map((link) => link.evidence_ref));
  const evidence = projection.evidence.filter((item) => evidenceIds.has(item.id));
  const receipts = projection.trace_views.flatMap((trace) => trace.receipt ? [{
    id: trace.receipt.id,
    aiSummary: trace.receipt.ai_summary,
    effectOfAi: trace.receipt.effect_of_ai,
    ...(trace.receipt.human_involvement ? { humanInvolvement: trace.receipt.human_involvement } : {}),
    finalAuthority: trace.receipt.final_authority,
    outcome: trace.receipt.outcome,
    ...(trace.receipt.challenge ? { challenge: trace.receipt.challenge } : {}),
  }] : []);

  return {
    organisationName: projection.organisations[0]?.name ?? "Organisation",
    ...(use ? { use: { id: use.id, name: use.name, summary: use.public_summary ?? "No public summary has been provided.", consequential: use.consequential, peopleAffected: use.people_affected } } : {}),
    ...(system ? { system: { id: system.id, name: system.name, description: system.description, influence: [...system.influence], agency: system.agency } } : {}),
    ...(version ? {
      version: {
        id: version.id,
        version: version.version,
        processName: version.process.name,
        nodes: version.process.nodes.map((node) => ({ id: node.id, type: node.type, name: node.name, ...(node.description ? { description: node.description } : {}) })),
        decisions: version.decisions.map((decision) => ({ id: decision.id, name: decision.name, authority: decision.authority, reviewBeforeEffect: decision.review_before_effect, ...(decision.challenge ? { challenge: decision.challenge } : {}) })),
        actions: version.actions.map((action) => ({ id: action.id, name: action.name, initiatedBy: action.initiated_by, humanApprovalRequired: action.human_approval_required, reversibility: action.reversibility, scope: action.scope.summary })),
        modelKnowledge: modelKnowledge(version.components),
      },
    } : {}),
    claims: claims.map((claim) => ({ id: claim.id, statement: claim.statement })),
    evidence: evidence.map((item) => ({ id: item.id, kind: item.kind, summary: item.summary, limitations: item.limitations, externalRefs: item.external_refs })),
    links: links.map((link) => ({ claimRef: link.claim_ref, evidenceRef: link.evidence_ref, relationship: link.relationship })),
    receipts,
    observationCount: projection.observations.length,
  };
};

const styles = `
.audience-shell { overflow:hidden; }
.audience-toolbar { padding:14px 18px; display:flex; gap:16px; justify-content:space-between; flex-wrap:wrap; align-items:center; border-bottom:1px solid var(--line); background:rgba(255,255,255,.36); }
.audience-group { display:flex; gap:7px; align-items:center; flex-wrap:wrap; }
.audience-label { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); font-weight:800; }
.example-link { border:0; background:transparent; padding:7px 9px; color:var(--muted); font-weight:700; font-size:12px; border-radius:999px; cursor:pointer; }
.example-link.active,.example-link:hover { background:var(--chalk); color:var(--ink); box-shadow:inset 0 0 0 1px var(--line); }
.audience-switch { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); border-bottom:1px solid var(--line); }
.audience-choice { border:0; border-right:1px solid var(--line); background:rgba(255,255,255,.18); padding:18px 20px; text-align:left; cursor:pointer; display:grid; gap:4px; }
.audience-choice:last-child { border-right:0; }
.audience-choice.active { background:var(--chalk); box-shadow:inset 0 -3px 0 var(--rust); }
.audience-choice span { color:var(--rust); font-size:10px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; }
.audience-choice strong { font-family:Georgia,'Times New Roman',serif; font-size:19px; font-weight:400; }
.audience-choice small { color:var(--muted); line-height:1.35; }
.view-canvas { padding:clamp(24px,4vw,48px); background:rgba(255,253,248,.68); }
.view-header { display:grid; grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr); gap:30px; align-items:start; margin-bottom:32px; }
.view-header h2 { font-family:Georgia,'Times New Roman',serif; font-weight:400; font-size:clamp(36px,5vw,64px); line-height:.98; letter-spacing:-.045em; margin:5px 0 12px; }
.view-header p { color:var(--muted); font-size:16px; line-height:1.55; max-width:760px; margin:0; }
.view-purpose { border-left:3px solid var(--rust); padding:4px 0 4px 16px; color:var(--muted); line-height:1.45; font-size:13px; }
.quick-facts { display:grid; grid-template-columns:repeat(3,1fr); border:1px solid var(--line); border-radius:20px; overflow:hidden; margin-bottom:28px; }
.quick-fact { padding:15px 17px; border-right:1px solid var(--line); background:rgba(255,255,255,.4); }
.quick-fact:last-child { border-right:0; }
.quick-fact span { display:block; font-size:9px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
.quick-fact strong { font-family:Georgia,'Times New Roman',serif; font-size:18px; font-weight:400; }
.visual-title { display:flex; align-items:center; justify-content:space-between; gap:16px; margin:30px 0 12px; }
.visual-title h3 { font-family:Georgia,'Times New Roman',serif; font-size:26px; font-weight:400; margin:0; }
.visual-title span { color:var(--muted); font-size:12px; }
.process-visual { display:flex; align-items:stretch; gap:8px; overflow-x:auto; padding:5px 0 12px; }
.process-card { min-width:150px; flex:1 0 150px; border:1px solid var(--line); border-radius:17px; padding:15px; background:var(--chalk); min-height:112px; }
.process-card.ai { border:2px solid rgba(168,76,50,.5); background:rgba(168,76,50,.055); }
.process-card.human { border:2px solid rgba(64,88,74,.42); background:rgba(64,88,74,.05); }
.process-card.decision { border-radius:4px 17px 4px 17px; border-color:rgba(64,88,74,.55); }
.process-card span { display:block; font-size:9px; font-weight:900; letter-spacing:.13em; text-transform:uppercase; color:var(--muted); margin-bottom:18px; }
.process-card strong { font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:1.25; font-weight:400; }
.process-arrow { display:grid; place-items:center; color:var(--muted); min-width:22px; }
.authority-boundary { min-width:74px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; color:var(--rust); }
.authority-boundary:before { content:''; width:1px; height:42px; background:var(--rust); }
.authority-boundary b { font-size:8px; letter-spacing:.13em; text-transform:uppercase; text-align:center; }
.two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:22px; }
.three-col { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:22px; }
.visual-card { border:1px solid var(--line); border-radius:20px; padding:20px; background:rgba(255,255,255,.38); }
.visual-card h3 { font-family:Georgia,'Times New Roman',serif; font-size:23px; font-weight:400; margin:0 0 14px; }
.icon-line { display:flex; gap:12px; align-items:flex-start; padding:11px 0; border-top:1px solid var(--line); }
.icon-line:first-of-type { border-top:0; }
.icon-mark { width:27px; height:27px; border:1px solid var(--line); border-radius:50%; display:grid; place-items:center; flex:0 0 27px; font-size:11px; font-weight:900; }
.icon-mark.yes { color:var(--moss); border-color:rgba(64,88,74,.4); }
.icon-mark.no { color:var(--rust); border-color:rgba(168,76,50,.35); }
.icon-line strong { display:block; line-height:1.35; }
.icon-line small { display:block; color:var(--muted); line-height:1.4; margin-top:3px; }
.evidence-chip { display:flex; gap:10px; padding:13px 0; border-top:1px solid var(--line); align-items:flex-start; }
.evidence-chip:first-of-type { border-top:0; }
.evidence-symbol { font-weight:900; color:var(--moss); font-size:17px; line-height:1; }
.evidence-symbol.qualifies { color:var(--rust); }
.evidence-chip strong { display:block; line-height:1.35; }
.evidence-chip small { color:var(--muted); display:block; margin-top:4px; line-height:1.4; }
.gap { border:1px dashed rgba(119,120,111,.5); border-radius:14px; padding:12px 14px; margin-top:9px; color:var(--muted); font-size:13px; line-height:1.4; }
.gap:before { content:'○'; margin-right:8px; }
.case-hero { border:1px solid var(--line); border-radius:24px; padding:clamp(20px,3vw,32px); background:var(--chalk); }
.case-timeline { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:20px; }
.case-step { position:relative; border:1px solid var(--line); border-radius:16px; padding:16px; min-height:140px; }
.case-step.ai { border-color:rgba(168,76,50,.42); background:rgba(168,76,50,.04); }
.case-step.human { border-color:rgba(64,88,74,.42); background:rgba(64,88,74,.04); }
.case-step span { display:block; font-size:9px; letter-spacing:.12em; text-transform:uppercase; font-weight:900; color:var(--muted); margin-bottom:14px; }
.case-step strong { font-family:Georgia,'Times New Roman',serif; font-size:17px; font-weight:400; line-height:1.3; }
.case-decision { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px; }
.authority-callout { border-radius:20px; padding:22px; background:var(--moss); color:var(--chalk); }
.authority-callout span { display:block; font-size:10px; letter-spacing:.12em; text-transform:uppercase; opacity:.75; margin-bottom:9px; }
.authority-callout strong { font-family:Georgia,'Times New Roman',serif; font-size:24px; font-weight:400; line-height:1.25; }
.challenge-callout { border:1px solid rgba(168,76,50,.35); border-radius:20px; padding:22px; background:rgba(168,76,50,.05); }
.challenge-callout span { display:block; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--rust); font-weight:900; margin-bottom:9px; }
.challenge-callout strong { font-family:Georgia,'Times New Roman',serif; font-size:21px; font-weight:400; line-height:1.3; }
.internal-metric { font-family:Georgia,'Times New Roman',serif; font-size:38px; line-height:1; margin:3px 0 8px; }
.detail-fold { margin-top:18px; border-top:1px solid var(--line); padding-top:14px; }
.detail-fold summary { cursor:pointer; font-size:12px; font-weight:800; }
.record-tools { margin-top:22px; padding-top:16px; border-top:1px solid var(--line); display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center; }
@media(max-width:900px){.view-header{grid-template-columns:1fr}.three-col{grid-template-columns:1fr}.case-timeline{grid-template-columns:1fr 1fr}.audience-choice small{display:none}}
@media(max-width:680px){.audience-switch{grid-template-columns:1fr}.audience-choice{border-right:0;border-bottom:1px solid var(--line)}.quick-facts,.two-col,.case-decision,.case-timeline{grid-template-columns:1fr}.quick-fact{border-right:0;border-bottom:1px solid var(--line)}.quick-fact:last-child{border-bottom:0}.view-canvas{padding:20px}}
`;

function ProcessVisual({ nodes }: { nodes: ViewNode[] }) {
  return (
    <div className="process-visual">
      {nodes.map((node, index) => {
        const previous = nodes[index - 1];
        const boundary = previous?.type === "ai" && (node.type === "human" || node.type === "decision");
        return (
          <div style={{ display: "contents" }} key={node.id}>
            {index > 0 ? boundary ? <div className="authority-boundary"><b>AI stops here</b></div> : <div className="process-arrow">→</div> : null}
            <article className={`process-card ${node.type === "ai" ? "ai" : ""} ${node.type === "human" ? "human" : ""} ${node.type === "decision" ? "decision" : ""}`}>
              <span>{nodeLabel[node.type] ?? node.type}</span>
              <strong>{node.name}</strong>
            </article>
          </div>
        );
      })}
    </div>
  );
}

function PublicView({ view }: { view: ViewModel }) {
  const decision = view.version?.decisions[0];
  const linkedEvidence = view.links.flatMap((link) => {
    const evidence = view.evidence.find((item) => item.id === link.evidenceRef);
    return evidence ? [{ ...evidence, relationship: link.relationship }] : [];
  });

  return (
    <div className="view-canvas">
      <header className="view-header">
        <div>
          <div className="kicker">{view.organisationName} · public explanation</div>
          <h2>How AI is used in {view.use?.name ?? "this process"}</h2>
          <p>{view.use?.summary ?? "No public explanation is available yet."}</p>
        </div>
        <div className="view-purpose"><strong>For anyone using or interested in this service.</strong><br />This view should make the role and limits of AI clear without exposing internal operational detail.</div>
      </header>

      <div className="quick-facts">
        <div className="quick-fact"><span>AI does</span><strong>{view.system?.influence.map((item) => influenceLabel[item]).join(" · ") || "Not described"}</strong></div>
        <div className="quick-fact"><span>AI does not</span><strong>{view.system?.agency === "none" ? "Act or decide by itself" : agencyLabel[view.system?.agency ?? "none"]}</strong></div>
        <div className="quick-fact"><span>Final authority</span><strong>{decision?.authority ? decision.authority.replaceAll("_", " ") : "Not recorded"}</strong></div>
      </div>

      <div className="visual-title"><h3>How it works</h3><span>Follow the work, not the technology.</span></div>
      {view.version?.nodes.length ? <ProcessVisual nodes={view.version.nodes} /> : <div className="gap">The public process has not been described yet.</div>}

      <div className="two-col">
        <article className="visual-card">
          <h3>Who decides?</h3>
          {decision ? <div className="icon-line"><span className="icon-mark yes">✓</span><div><strong>{decision.name}</strong><small>{decision.authority.replaceAll("_", " ")} authority{decision.reviewBeforeEffect ? " · review before effect" : ""}</small></div></div> : <div className="gap">Decision authority is not visible.</div>}
        </article>
        <article className="visual-card">
          <h3>How we know</h3>
          {linkedEvidence.length ? linkedEvidence.map((item) => <div className="evidence-chip" key={item.id}><span className={`evidence-symbol ${item.relationship === "supports" ? "" : "qualifies"}`}>{item.relationship === "supports" ? "✓" : "△"}</span><div><strong>{item.summary}</strong><small>{relationshipLabel(item.relationship)} · {item.kind.replaceAll("_", " ")}</small></div></div>) : <div className="gap">No public evidence is linked yet.</div>}
        </article>
      </div>

      {view.version?.modelKnowledge.length ? <div className="visual-title"><h3>What is not known or disclosed</h3></div> : null}
      {view.version?.modelKnowledge.map((item) => <div className="gap" key={item}>{item}</div>)}
    </div>
  );
}

function AffectedView({ view }: { view: ViewModel }) {
  const receipt = view.receipts[0];
  const decision = view.version?.decisions[0];
  const challenge = receipt?.challenge ?? decision?.challenge;

  return (
    <div className="view-canvas">
      <header className="view-header">
        <div>
          <div className="kicker">{view.organisationName} · affected-person explanation</div>
          <h2>How AI was involved in this case</h2>
          <p>This view focuses on what happened to a person, not on the organisation's whole technical record.</p>
        </div>
        <div className="view-purpose"><strong>The question this view answers:</strong><br />What did AI contribute, who made the decision, and what can I do if I have questions or concerns?</div>
      </header>

      {receipt ? (
        <article className="case-hero">
          <div className="kicker">This particular case</div>
          <div className="case-timeline">
            <div className="case-step ai"><span>AI</span><strong>{receipt.aiSummary}</strong></div>
            <div className="case-step"><span>What happened next</span><strong>{receipt.effectOfAi}</strong></div>
            <div className="case-step human"><span>Person</span><strong>{receipt.humanInvolvement ?? "No human involvement is recorded."}</strong></div>
            <div className="case-step"><span>Outcome</span><strong>{receipt.outcome}</strong></div>
          </div>
          <div className="case-decision">
            <div className="authority-callout"><span>Who had final authority?</span><strong>{receipt.finalAuthority.replaceAll("_", " ")}</strong></div>
            <div className="challenge-callout"><span>Questions or concerns?</span><strong>{challenge?.available ? challenge.description ?? challenge.uri ?? "A challenge route is available." : "No challenge route is recorded."}</strong></div>
          </div>
        </article>
      ) : (
        <div className="gap">No case-specific record is visible to the affected person. The organisation may still publish a general public explanation of the system.</div>
      )}

      <details className="detail-fold">
        <summary>About the AI system used in this process</summary>
        <div className="visual-title"><h3>Where AI sits in the wider process</h3></div>
        {view.version?.nodes.length ? <ProcessVisual nodes={view.version.nodes} /> : <div className="gap">No process is visible.</div>}
        <div className="two-col">
          <article className="visual-card"><h3>AI's role</h3>{view.system?.influence.map((item) => <div className="icon-line" key={item}><span className="icon-mark">AI</span><div><strong>{influenceLabel[item]}</strong></div></div>)}</article>
          <article className="visual-card"><h3>Human authority</h3>{decision ? <div className="icon-line"><span className="icon-mark yes">✓</span><div><strong>{decision.name}</strong><small>{decision.authority.replaceAll("_", " ")} authority</small></div></div> : <div className="gap">Not recorded.</div>}</article>
        </div>
      </details>
    </div>
  );
}

function InternalView({ view }: { view: ViewModel }) {
  const evidenceByClaim = view.claims.map((claim) => ({
    claim,
    links: view.links.filter((link) => link.claimRef === claim.id).flatMap((link) => {
      const evidence = view.evidence.find((item) => item.id === link.evidenceRef);
      return evidence ? [{ evidence, relationship: link.relationship }] : [];
    }),
  }));
  const gapCount = evidenceByClaim.filter((item) => item.links.length === 0).length + (view.version?.modelKnowledge.length ?? 0) + (view.use?.consequential && !view.version?.decisions.length ? 1 : 0);

  return (
    <div className="view-canvas">
      <header className="view-header">
        <div>
          <div className="kicker">{view.organisationName} · internal scrutiny</div>
          <h2>{view.use?.name ?? "AI use"}</h2>
          <p>{view.use?.summary ?? view.system?.description ?? "No description recorded."}</p>
        </div>
        <div className="view-purpose"><strong>For the people responsible for this use.</strong><br />Use this view to test whether the description, controls and evidence line up — and to notice what is still unknown.</div>
      </header>

      <div className="quick-facts">
        <div className="quick-fact"><span>Evidence linked</span><strong>{view.evidence.length}</strong></div>
        <div className="quick-fact"><span>Gaps / unknowns</span><strong>{gapCount}</strong></div>
        <div className="quick-fact"><span>Runtime observations</span><strong>{view.observationCount}</strong></div>
      </div>

      <div className="visual-title"><h3>Process & authority</h3><span>Where does AI stop and human authority begin?</span></div>
      {view.version?.nodes.length ? <ProcessVisual nodes={view.version.nodes} /> : <div className="gap">No process is recorded.</div>}

      <div className="three-col">
        <article className="visual-card">
          <h3>What we say</h3>
          {evidenceByClaim.length ? evidenceByClaim.map(({ claim, links }) => <div className="icon-line" key={claim.id}><span className={`icon-mark ${links.length ? "yes" : "no"}`}>{links.length ? "✓" : "○"}</span><div><strong>{claim.statement}</strong><small>{links.length ? `${links.length} linked evidence item${links.length === 1 ? "" : "s"}` : "No linked evidence"}</small></div></div>) : <div className="gap">No scoped claims are recorded.</div>}
        </article>

        <article className="visual-card">
          <h3>Evidence & limitations</h3>
          {view.evidence.length ? view.evidence.map((item) => <div className="evidence-chip" key={item.id}><span className="evidence-symbol">✓</span><div><strong>{item.summary}</strong><small>{item.kind.replaceAll("_", " ")}</small>{item.limitations.length ? <small>△ {item.limitations.join(" · ")}</small> : null}</div></div>) : <div className="gap">No evidence is linked yet.</div>}
        </article>

        <article className="visual-card">
          <h3>Gaps & unknowns</h3>
          {view.version?.modelKnowledge.map((item) => <div className="gap" key={item}>{item}</div>)}
          {evidenceByClaim.filter((item) => item.links.length === 0).map(({ claim }) => <div className="gap" key={claim.id}>No evidence linked to: {claim.statement}</div>)}
          {view.use?.consequential && !view.version?.decisions.length ? <div className="gap">This use is marked consequential but no decision authority is recorded.</div> : null}
          {!gapCount ? <div className="icon-line"><span className="icon-mark yes">✓</span><div><strong>No obvious structural gaps in this example.</strong><small>That is not a trust or safety score.</small></div></div> : null}
        </article>
      </div>

      <details className="detail-fold">
        <summary>Operational and technical detail</summary>
        <div className="two-col">
          <article className="visual-card"><h3>System</h3><div className="icon-line"><span className="icon-mark">AI</span><div><strong>{view.system?.name ?? "Not recorded"}</strong><small>Version {view.version?.version ?? "unknown"}</small></div></div>{view.system ? <div className="icon-line"><span className="icon-mark">→</span><div><strong>{agencyLabel[view.system.agency]}</strong></div></div> : null}</article>
          <article className="visual-card"><h3>Observed activity</h3><div className="internal-metric">{view.observationCount}</div><small className="muted">runtime observation{view.observationCount === 1 ? "" : "s"} attached to this projected record</small></article>
        </div>
      </details>
    </div>
  );
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
  const view = useMemo(() => projection ? normaliseProjection(projection) : normaliseWorking(bundle), [projection, bundle]);

  const loadExample = (example: ExampleCase) => {
    setBundle(structuredClone(example.bundle));
    setActiveExample(example.id);
    setLens(example.id === "funding-review" ? "public" : "public");
    setError(null);
  };

  const openBundle = async (file: File | undefined) => {
    if (!file) return;
    try {
      const next = parsePortableBundle(JSON.parse(await file.text()) as unknown);
      setBundle(next);
      setActiveExample("");
      setLens("public");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open this CRUX record.");
    }
  };

  return (
    <section className="workbench audience-shell" aria-label="CRUX audience views">
      <style>{styles}</style>
      <div className="audience-toolbar">
        <div className="audience-group"><span className="audience-label">Example</span>{examples.map((example) => <button type="button" className={`example-link ${activeExample === example.id ? "active" : ""}`} key={example.id} onClick={() => loadExample(example)} title={example.note}>{example.name}</button>)}</div>
        <div className="audience-group"><label className="btn file-label">Open your record<input type="file" accept="application/json,.json" onChange={(event) => void openBundle(event.target.files?.[0])} /></label><a className="btn" href="/author">Create or edit a record</a></div>
      </div>

      <div className="audience-switch" aria-label="Choose audience view">
        {(["working", "public", "affected_party"] as Lens[]).map((item) => <button type="button" key={item} className={`audience-choice ${lens === item ? "active" : ""}`} disabled={item !== "working" && !canonical} onClick={() => setLens(item)}><span>{audienceCopy[item].label}</span><strong>{audienceCopy[item].job}</strong><small>{audienceCopy[item].intro}</small></button>)}
      </div>

      {error ? <div className="error-box" style={{ margin: 18 }}>{error}</div> : null}
      {!canonical ? <div className="notice" style={{ margin: 18 }}>This record is still a draft. Public and affected-person projections are unavailable until it is structurally valid.</div> : null}

      {lens === "working" ? <InternalView view={view} /> : null}
      {lens === "public" ? <PublicView view={view} /> : null}
      {lens === "affected_party" ? <AffectedView view={view} /> : null}

      <div className="record-tools">
        <span className="small muted">Same CRUX record, different audience purpose and disclosure projection.</span>
        <span className="small muted">{lens === "working" ? "Internal view uses the canonical working record." : `${audienceCopy[lens].label} view is generated from the ${lens.replaceAll("_", " ")} disclosure projection.`}</span>
      </div>
    </section>
  );
}
