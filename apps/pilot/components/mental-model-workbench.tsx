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
import { appendAIUse } from "../lib/authoring";
import { observedBehaviourForVersion } from "../lib/observed";
import { createStarterBundle } from "../lib/starter";
import { AuthorityEditor } from "./authority-editor";
import { EvidenceEditor } from "./evidence-editor";
import { ReceiptEditor } from "./receipt-editor";

type Question = "where" | "power" | "believe" | "happened" | "edit";
type Lens = "working" | "public" | "affected_party";

type ViewUse = {
  id: string;
  name: string;
  summary: string;
  consequential: boolean;
  peopleAffected: string[];
};

type ViewSystem = {
  id: string;
  name: string;
  description: string;
  influence: AIInfluence[];
  agency: AIAgency;
};

type ViewVersion = {
  id: string;
  processName: string;
  nodes: Array<{ id: string; type: string; name: string; description?: string }>;
  decisions: Array<{ id: string; name: string; authority: string; reviewBeforeEffect: boolean }>;
  actions: Array<{
    id: string;
    name: string;
    initiatedBy: string;
    humanApprovalRequired: boolean;
    reversibility: string;
    scope: string;
  }>;
};

type ViewClaim = { id: string; statement: string };
type ViewEvidence = {
  id: string;
  kind: string;
  summary: string;
  limitations: string[];
  externalRefs: string[];
};
type ViewLink = { claimRef: string; evidenceRef: string; relationship: string };
type ViewReceipt = {
  id: string;
  aiSummary: string;
  effectOfAi: string;
  humanInvolvement?: string;
  finalAuthority: string;
  outcome: string;
  challenge?: NonNullable<CruxPortableBundle["receipts"][number]["challenge"]>;
};

type ViewModel = {
  organisationName: string;
  use?: ViewUse;
  system?: ViewSystem;
  version?: ViewVersion | undefined;
  claims: ViewClaim[];
  evidence: ViewEvidence[];
  links: ViewLink[];
  receipts: ViewReceipt[];
};

const lensLabel: Record<Lens, string> = {
  working: "Working record",
  public: "Public view",
  affected_party: "Affected-person view",
};

const questions: Array<{ id: Exclude<Question, "edit">; number: string; title: string; short: string }> = [
  { id: "where", number: "01", title: "Where is AI involved?", short: "See the real-world process and where AI enters it." },
  { id: "power", number: "02", title: "What power does it have?", short: "Understand what AI can influence, decide or cause." },
  { id: "believe", number: "03", title: "Why should I believe this?", short: "Keep what is said separate from what the evidence shows." },
  { id: "happened", number: "04", title: "What happened here?", short: "See what AI did in a particular consequential case." },
];

const influenceChoices: Array<{ value: AIInfluence; label: string; help: string }> = [
  { value: "assistive", label: "Draft or transform", help: "AI helps produce or change content." },
  { value: "informational", label: "Find or surface information", help: "AI brings information to someone’s attention." },
  { value: "advisory", label: "Recommend", help: "AI suggests what someone might do or decide." },
  { value: "conditional", label: "Influence what happens next", help: "AI affects a later step when conditions are met." },
  { value: "decisional", label: "Contribute directly to a decision", help: "AI output forms part of the decision itself." },
];

const agencyChoices: Array<{ value: AIAgency; label: string }> = [
  { value: "none", label: "AI cannot cause an action" },
  { value: "proposes_action", label: "AI can propose an action, but cannot execute it" },
  { value: "human_approval_required", label: "AI can act only after a person approves" },
  { value: "automatic_bounded", label: "AI can act automatically within fixed limits" },
  { value: "autonomous_bounded", label: "AI can choose and act within defined limits" },
];

const nodeLabels: Record<string, string> = {
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

const formatError = (error: unknown) =>
  error instanceof Error ? error.message : "That file could not be opened as a CRUX record.";

const slug = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "crux";

const downloadJson = (value: unknown, filename: string) => {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const selectedCanonicalSystem = (
  bundle: CruxPortableBundle,
  use: CruxPortableBundle["ai_uses"][number] | undefined,
) => {
  if (!use) return undefined;
  return bundle.systems.find(
    (system) => use.system_refs.includes(system.id) || system.ai_use_refs.includes(use.id),
  );
};

const selectedCanonicalVersion = (
  bundle: CruxPortableBundle,
  system: CruxPortableBundle["systems"][number] | undefined,
) => {
  if (!system) return undefined;
  return system.current_version_ref
    ? bundle.system_versions.find((version) => version.id === system.current_version_ref)
    : bundle.system_versions.find((version) => version.system_ref === system.id);
};

const relevantClaim = (
  claim: { applies_to: Array<{ ref: string }> },
  refs: Set<string>,
) => claim.applies_to.some((target) => refs.has(target.ref));

const normaliseVersion = (version: CruxPortableBundle["system_versions"][number] | CruxDisclosureBundle["system_versions"][number] | undefined): ViewVersion | undefined => {
  if (!version) return undefined;
  return {
    id: version.id,
    processName: version.process.name,
    nodes: version.process.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name,
      ...(node.description ? { description: node.description } : {}),
    })),
    decisions: version.decisions.map((decision) => ({
      id: decision.id,
      name: decision.name,
      authority: decision.authority,
      reviewBeforeEffect: decision.review_before_effect,
    })),
    actions: version.actions.map((action) => ({
      id: action.id,
      name: action.name,
      initiatedBy: action.initiated_by,
      humanApprovalRequired: action.human_approval_required,
      reversibility: action.reversibility,
      scope: action.scope.summary,
    })),
  };
};

const buildWorkingView = (bundle: CruxPortableBundle, selectedUseId: string): ViewModel => {
  const use = bundle.ai_uses.find((item) => item.id === selectedUseId) ?? bundle.ai_uses[0];
  const system = selectedCanonicalSystem(bundle, use);
  const version = selectedCanonicalVersion(bundle, system);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claims = bundle.claims.filter((claim) => relevantClaim(claim, refs));
  const claimIds = new Set(claims.map((claim) => claim.id));
  const links = bundle.evidence_links.filter((link) => claimIds.has(link.claim_ref));
  const evidenceIds = new Set(links.map((link) => link.evidence_ref));
  const evidence = bundle.evidence.filter((item) => evidenceIds.has(item.id));
  const receipts = version
    ? bundle.receipts.filter((receipt) => receipt.system_version_ref === version.id)
    : [];

  return {
    organisationName: bundle.organisations[0]?.name ?? "Your organisation",
    ...(use ? {
      use: {
        id: use.id,
        name: use.name,
        summary: use.public_summary || use.purpose,
        consequential: use.consequential,
        peopleAffected: use.people_affected,
      },
    } : {}),
    ...(system ? {
      system: {
        id: system.id,
        name: system.name,
        description: system.description,
        influence: [...system.influence],
        agency: system.agency,
      },
    } : {}),
    ...(version ? { version: normaliseVersion(version) } : {}),
    claims: claims.map((claim) => ({ id: claim.id, statement: claim.statement })),
    evidence: evidence.map((item) => ({
      id: item.id,
      kind: item.kind,
      summary: item.summary,
      limitations: item.limitations,
      externalRefs: item.external_refs,
    })),
    links: links.map((link) => ({ claimRef: link.claim_ref, evidenceRef: link.evidence_ref, relationship: link.relationship })),
    receipts: receipts.map((receipt) => ({
      id: receipt.id,
      aiSummary: receipt.ai_summary,
      effectOfAi: receipt.effect_of_ai,
      ...(receipt.human_involvement ? { humanInvolvement: receipt.human_involvement } : {}),
      finalAuthority: receipt.final_authority,
      outcome: receipt.outcome,
      ...(receipt.challenge ? { challenge: receipt.challenge } : {}),
    })),
  };
};

const buildDisclosureView = (projection: CruxDisclosureBundle, selectedUseId: string): ViewModel => {
  const use = projection.ai_uses.find((item) => item.id === selectedUseId) ?? projection.ai_uses[0];
  const system = use
    ? projection.systems.find((item) => use.system_refs.includes(item.id) || item.ai_use_refs.includes(use.id))
    : undefined;
  const version = system?.current_version_ref
    ? projection.system_versions.find((item) => item.id === system.current_version_ref)
    : projection.system_versions.find((item) => item.system_ref === system?.id);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claims = projection.claims.filter((claim) => relevantClaim(claim, refs));
  const claimIds = new Set(claims.map((claim) => claim.id));
  const links = projection.claim_evidence_links.filter((link) => claimIds.has(link.claim_ref));
  const evidenceIds = new Set(links.map((link) => link.evidence_ref));
  const evidence = projection.evidence.filter((item) => evidenceIds.has(item.id));
  const receipts = projection.trace_views.flatMap((trace) => {
    if (!trace.receipt || (version && trace.receipt.system_version_ref !== version.id)) return [];
    return [{
      id: trace.receipt.id,
      aiSummary: trace.receipt.ai_summary,
      effectOfAi: trace.receipt.effect_of_ai,
      ...(trace.receipt.human_involvement ? { humanInvolvement: trace.receipt.human_involvement } : {}),
      finalAuthority: trace.receipt.final_authority,
      outcome: trace.receipt.outcome,
      ...(trace.receipt.challenge ? { challenge: trace.receipt.challenge } : {}),
    }];
  });

  return {
    organisationName: projection.organisations[0]?.name ?? "Organisation",
    ...(use ? {
      use: {
        id: use.id,
        name: use.name,
        summary: use.public_summary ?? "No public summary has been provided.",
        consequential: use.consequential,
        peopleAffected: use.people_affected,
      },
    } : {}),
    ...(system ? {
      system: {
        id: system.id,
        name: system.name,
        description: system.description,
        influence: [...system.influence],
        agency: system.agency,
      },
    } : {}),
    ...(version ? { version: normaliseVersion(version) } : {}),
    claims: claims.map((claim) => ({ id: claim.id, statement: claim.statement })),
    evidence: evidence.map((item) => ({
      id: item.id,
      kind: item.kind,
      summary: item.summary,
      limitations: item.limitations,
      externalRefs: item.external_refs,
    })),
    links: links.map((link) => ({ claimRef: link.claim_ref, evidenceRef: link.evidence_ref, relationship: link.relationship })),
    receipts,
  };
};

const relationshipLabel = (relationship: string) => {
  if (relationship === "supports") return "Supports";
  if (relationship === "qualifies") return "Qualifies";
  if (relationship === "contradicts") return "Challenges";
  return "Inconclusive";
};

const powerSummary = (system: ViewSystem | undefined) => {
  if (!system) return ["No system details recorded yet."];
  const labels = system.influence.map((value) =>
    influenceChoices.find((choice) => choice.value === value)?.label ?? value.replaceAll("_", " "),
  );
  const agency = agencyChoices.find((choice) => choice.value === system.agency)?.label;
  return [...labels, ...(agency ? [agency] : [])];
};

export function MentalModelWorkbench() {
  const [bundle, setBundle] = useState<CruxPortableBundle>(() => createStarterBundle());
  const [selectedUseId, setSelectedUseId] = useState("ai-use:primary");
  const [question, setQuestion] = useState<Question>("where");
  const [lens, setLens] = useState<Lens>("working");
  const [error, setError] = useState<string | null>(null);

  const structural = useMemo(() => portableBundleSchema.safeParse(bundle), [bundle]);
  const references = useMemo(() => structural.success ? validateBundleReferences(structural.data) : null, [structural]);
  const canonical = structural.success && references?.valid ? structural.data : null;
  const effectiveLens: Lens = canonical ? lens : "working";
  const projection = useMemo(
    () => canonical && effectiveLens !== "working" ? redactBundle(canonical, effectiveLens) : null,
    [canonical, effectiveLens],
  );
  const view = useMemo(
    () => projection ? buildDisclosureView(projection, selectedUseId) : buildWorkingView(bundle, selectedUseId),
    [projection, bundle, selectedUseId],
  );

  const use = bundle.ai_uses.find((item) => item.id === selectedUseId) ?? bundle.ai_uses[0];
  const system = selectedCanonicalSystem(bundle, use);
  const version = selectedCanonicalVersion(bundle, system);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claim = bundle.claims.find((item) => relevantClaim(item, refs));
  const observed = useMemo(() => observedBehaviourForVersion(bundle, version?.id), [bundle, version?.id]);
  const canShare = canonical !== null;
  const isFundingExample = Boolean((use?.name ?? "").toLowerCase().includes("funding") || use?.id.includes("funding"));

  const mutate = (change: (next: CruxPortableBundle) => void) => {
    setBundle((current) => {
      const next = structuredClone(current);
      change(next);
      next.generated_at = new Date().toISOString();
      return next;
    });
  };

  const updateUse = (patch: Partial<CruxPortableBundle["ai_uses"][number]>) => {
    if (!use) return;
    mutate((next) => {
      const target = next.ai_uses.find((item) => item.id === use.id);
      if (target) Object.assign(target, patch);
    });
  };

  const updateSystem = (patch: Partial<CruxPortableBundle["systems"][number]>) => {
    if (!system) return;
    mutate((next) => {
      const target = next.systems.find((item) => item.id === system.id);
      if (target) Object.assign(target, patch);
    });
  };

  const toggleInfluence = (value: AIInfluence, checked: boolean) => {
    if (!system) return;
    const influence = checked
      ? Array.from(new Set([...system.influence, value]))
      : system.influence.filter((item) => item !== value);
    if (influence.length > 0) updateSystem({ influence });
  };

  const openBundle = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parsePortableBundle(JSON.parse(await file.text()) as unknown);
      setBundle(parsed);
      setSelectedUseId(parsed.ai_uses[0]?.id ?? "");
      setQuestion("where");
      setLens("working");
      setError(null);
    } catch (caught) {
      setError(formatError(caught));
    }
  };

  const reset = () => {
    const starter = createStarterBundle();
    setBundle(starter);
    setSelectedUseId(starter.ai_uses[0]?.id ?? "");
    setQuestion("edit");
    setLens("working");
    setError(null);
  };

  const addUse = () => {
    const result = appendAIUse(bundle);
    setBundle(result.bundle);
    setSelectedUseId(result.aiUseId);
    setQuestion("edit");
    setLens("working");
  };

  const baseName = slug(bundle.organisations[0]?.name ?? "crux");

  return (
    <section className="workbench mental-workbench" aria-label="CRUX pilot workbench">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="btn file-label">Open record<input type="file" accept="application/json,.json" onChange={(event) => void openBundle(event.target.files?.[0])} /></label>
          <button className="btn ghost" type="button" onClick={reset}>New record</button>
          <button className="btn" type="button" disabled={!canShare} onClick={() => canonical && downloadJson(canonical, `${baseName}-crux.json`)}>Download record</button>
        </div>
        <div className="toolbar-group">
          {(["working", "public", "affected_party"] as Lens[]).map((item) => (
            <button key={item} className={`btn ${effectiveLens === item ? "primary" : "ghost"}`} type="button" disabled={item !== "working" && !canShare} onClick={() => { setLens(item); if (item !== "working" && question === "edit") setQuestion("where"); }}>{lensLabel[item]}</button>
          ))}
          {effectiveLens === "working" ? <button className="btn primary" type="button" onClick={() => setQuestion("edit")}>Describe this use</button> : null}
        </div>
      </div>

      <div className="question-strip">
        {questions.map((item) => (
          <button className={`question-tab ${question === item.id ? "active" : ""}`} type="button" key={item.id} onClick={() => setQuestion(item.id)}>
            <span className="question-number">{item.number}</span>
            <span><strong>{item.title}</strong><small>{item.short}</small></span>
          </button>
        ))}
      </div>

      <div className="panel">
        {error ? <div className="error-box" style={{ marginBottom: 18 }}>{error}</div> : null}
        {!canShare ? <div className="notice" style={{ marginBottom: 18 }}>This is still a working draft. CRUX will not create public or affected-person views until the record is structurally valid.</div> : null}

        <div className="context-line">
          <div><div className="kicker">{lensLabel[effectiveLens]}</div><strong>{view.organisationName}</strong>{view.use ? <span> · {view.use.name}</span> : null}</div>
          {effectiveLens === "working" && bundle.ai_uses.length > 1 ? (
            <select className="select compact-select" value={use?.id ?? ""} onChange={(event) => setSelectedUseId(event.target.value)}>{bundle.ai_uses.map((item) => <option value={item.id} key={item.id}>{item.name || "Untitled AI use"}</option>)}</select>
          ) : null}
        </div>

        {question === "where" ? <WherePanel view={view} isFundingExample={isFundingExample} /> : null}
        {question === "power" ? <PowerPanel view={view} observed={observed} working={effectiveLens === "working"} /> : null}
        {question === "believe" ? <BelievePanel view={view} working={effectiveLens === "working"} bundle={bundle} claim={claim} onBundleChange={setBundle} /> : null}
        {question === "happened" ? <HappenedPanel view={view} working={effectiveLens === "working"} consequential={Boolean(use?.consequential)} bundle={bundle} versionId={version?.id} onBundleChange={setBundle} /> : null}
        {question === "edit" && effectiveLens === "working" ? (
          <EditPanel bundle={bundle} use={use} system={system} versionId={version?.id} claim={claim} onMutate={mutate} onUseChange={updateUse} onSystemChange={updateSystem} onToggleInfluence={toggleInfluence} onBundleChange={setBundle} onAddUse={addUse} onGoTo={setQuestion} />
        ) : null}
      </div>

      <div className="mental-footer"><span><strong>SAYS</strong> is not the same as <strong>SHOWS</strong>.</span><span><strong>HAPPENED</strong> describes a particular case.</span><span><strong>UNKNOWN</strong> is allowed to stay unknown.</span></div>
    </section>
  );
}

function WherePanel({ view, isFundingExample }: { view: ViewModel; isFundingExample: boolean }) {
  return (
    <div>
      <QuestionHeading number="01" title="Where is AI involved?" copy="Start with the real-world process. AI should be visible as one part of the story, not as the story itself." />
      {isFundingExample ? (
        <div className="teaching-card"><div className="kicker">How to read this example</div><div className="teaching-steps"><div><strong>1</strong><span>Follow the application through the real process.</span></div><div><strong>2</strong><span>Notice where AI appears — and where it stops.</span></div><div><strong>3</strong><span>Then ask who actually decides whether the applicant is eligible.</span></div></div></div>
      ) : null}
      <div className="story-intro"><div><div className="kicker">The use</div><h3>{view.use?.name ?? "AI use not yet described"}</h3><p>{view.use?.summary ?? view.system?.description ?? "No plain-language explanation has been recorded yet."}</p></div>{view.use?.consequential ? <span className="impact-flag">May materially affect people</span> : <span className="impact-flag quiet">Low-consequence / assistive</span>}</div>
      {view.version?.nodes.length ? <div className="story-flow">{view.version.nodes.map((node, index) => <div style={{ display: "contents" }} key={node.id}>{index > 0 ? <div className="story-arrow">→</div> : null}<article className={`story-node node-${node.type}`}><span>{nodeLabels[node.type] ?? node.type}</span><strong>{node.name}</strong>{node.description ? <small>{node.description}</small> : null}</article></div>)}</div> : <div className="empty">The process has not been described yet.</div>}
      <Guidance title="Critical question">Could someone point to the exact step where AI enters this process, and the exact step where human judgement or authority takes over?</Guidance>
    </div>
  );
}

function PowerPanel({ view, observed, working }: { view: ViewModel; observed: ReturnType<typeof observedBehaviourForVersion>; working: boolean }) {
  return (
    <div>
      <QuestionHeading number="02" title="What power does it have?" copy="The important question is not how advanced the model is. It is what the AI can influence, decide or cause in this particular process." />
      <div className="power-grid"><article className="mental-card"><div className="kicker">AI can…</div>{powerSummary(view.system).map((item) => <div className="power-line" key={item}>{item}</div>)}</article><article className="mental-card"><div className="kicker">Before anything consequential happens…</div>{view.version?.decisions.length ? view.version.decisions.map((decision) => <div className="authority-line" key={decision.id}><strong>{decision.name}</strong><span>Final authority: {decision.authority.replaceAll("_", " ")}</span><span>{decision.reviewBeforeEffect ? "Review happens before effect" : "No pre-effect review recorded"}</span></div>) : <div className="small muted">No consequential decision point is recorded.</div>}</article></div>
      {view.version?.actions.length ? <div className="mental-card" style={{ marginTop: 16 }}><div className="kicker">Actions AI may be connected to</div>{view.version.actions.map((action) => <div className="action-boundary" key={action.id}><div><strong>{action.name}</strong><span>{action.scope}</span></div><div className="pill-row" style={{ marginTop: 0 }}><span className="pill">Initiated by {action.initiatedBy}</span><span className="pill">{action.humanApprovalRequired ? "Human approval required" : "No human approval required"}</span><span className="pill">Reversible: {action.reversibility}</span></div></div>)}</div> : null}
      <Guidance title="The question to ask">Can this AI cause something to happen to a person without another person intervening?</Guidance>
      {working && observed.observationCount > 0 ? <details className="advanced-details"><summary>System-reported activity</summary><p className="small muted">Observed provider/model metadata can tell us whether the running system differs from what was described. It does not decide whether the system is trustworthy.</p><div className="pill-row"><span className="pill">{observed.observationCount} observation{observed.observationCount === 1 ? "" : "s"}</span><span className={`pill ${observed.divergenceCount ? "rust" : "moss"}`}>{observed.divergenceCount} difference{observed.divergenceCount === 1 ? "" : "s"} to review</span></div></details> : null}
    </div>
  );
}

function BelievePanel({ view, working, bundle, claim, onBundleChange }: { view: ViewModel; working: boolean; bundle: CruxPortableBundle; claim: CruxPortableBundle["claims"][number] | undefined; onBundleChange: (bundle: CruxPortableBundle) => void }) {
  return (
    <div>
      <QuestionHeading number="03" title="Why should I believe this?" copy="CRUX deliberately separates what an organisation says from what evidence actually shows. Evidence may support, qualify or challenge a statement." />
      {view.claims.length ? view.claims.map((item) => {
        const linked = view.links.filter((link) => link.claimRef === item.id).flatMap((link) => { const evidence = view.evidence.find((candidate) => candidate.id === link.evidenceRef); return evidence ? [{ evidence, relationship: link.relationship }] : []; });
        return <article className="reasoning-stack" key={item.id}><div className="reasoning-row says-row"><div className="reasoning-label">SAYS</div><div><strong>{item.statement}</strong><p>What the organisation declares to be true.</p></div></div>{linked.length ? linked.map(({ evidence, relationship }) => <div className="reasoning-row shows-row" key={evidence.id}><div className="reasoning-label">SHOWS</div><div><strong>{evidence.summary}</strong><p>{relationshipLabel(relationship)} this statement · {evidence.kind.replaceAll("_", " ")}</p>{evidence.limitations.length ? <p className="caution">Limitation: {evidence.limitations.join(" · ")}</p> : null}{evidence.externalRefs[0] ? <a href={evidence.externalRefs[0]} target="_blank" rel="noreferrer">Open source reference ↗</a> : null}</div></div>) : <div className="reasoning-row unknown-row"><div className="reasoning-label">UNKNOWN</div><div><strong>No evidence is linked yet.</strong><p>This remains a declaration. CRUX does not silently upgrade it into proof.</p></div></div>}</article>;
      }) : <div className="empty">No inspectable statement is visible for this use yet.</div>}
      {working && claim ? <article className="mental-card add-evidence-card"><div className="kicker">Add to SHOWS</div><h3>What helps you know whether this is true?</h3><p className="small muted">For: “{claim.statement}”</p><EvidenceEditor bundle={bundle} claimId={claim.id} onBundleChange={onBundleChange} /></article> : null}
    </div>
  );
}

function HappenedPanel({ view, working, consequential, bundle, versionId, onBundleChange }: { view: ViewModel; working: boolean; consequential: boolean; bundle: CruxPortableBundle; versionId: string | undefined; onBundleChange: (bundle: CruxPortableBundle) => void }) {
  return (
    <div>
      <QuestionHeading number="04" title="What happened here?" copy="A specific case is different from a general promise. This view records what AI contributed, what happened next and who had final authority." />
      {view.receipts.length ? view.receipts.map((receipt) => <article className="reasoning-stack happened-stack" key={receipt.id}><div className="reasoning-row happened-row"><div className="reasoning-label">HAPPENED</div><div><strong>{receipt.aiSummary}</strong><p>AI contribution in this particular case.</p></div></div><div className="case-flow"><div><span>AI</span><strong>{receipt.aiSummary}</strong></div><b>→</b><div><span>Next</span><strong>{receipt.effectOfAi}</strong></div><b>→</b><div><span>Person</span><strong>{receipt.humanInvolvement ?? "No human involvement recorded"}</strong></div><b>→</b><div><span>Outcome</span><strong>{receipt.outcome}</strong></div></div><div className="case-footer"><span><strong>Final authority:</strong> {receipt.finalAuthority}</span><span><strong>Challenge:</strong> {receipt.challenge?.available ? receipt.challenge.description ?? receipt.challenge.uri ?? "Available" : "No challenge route recorded"}</span></div></article>) : <div className="empty">No specific consequential case has been recorded in this view.</div>}
      {working && consequential && versionId ? <article className="mental-card record-outcome-card"><div className="kicker">Add to HAPPENED</div><ReceiptEditor bundle={bundle} systemVersionId={versionId} onBundleChange={onBundleChange} /></article> : null}
    </div>
  );
}

function EditPanel({ bundle, use, system, versionId, claim, onMutate, onUseChange, onSystemChange, onToggleInfluence, onBundleChange, onAddUse, onGoTo }: { bundle: CruxPortableBundle; use: CruxPortableBundle["ai_uses"][number] | undefined; system: CruxPortableBundle["systems"][number] | undefined; versionId: string | undefined; claim: CruxPortableBundle["claims"][number] | undefined; onMutate: (change: (next: CruxPortableBundle) => void) => void; onUseChange: (patch: Partial<CruxPortableBundle["ai_uses"][number]>) => void; onSystemChange: (patch: Partial<CruxPortableBundle["systems"][number]>) => void; onToggleInfluence: (value: AIInfluence, checked: boolean) => void; onBundleChange: (bundle: CruxPortableBundle) => void; onAddUse: () => void; onGoTo: (question: Question) => void }) {
  const organisation = bundle.organisations[0];
  if (!organisation || !use || !system) return <div className="empty">This record can be read, but the simple guided editor cannot edit this shape yet.</div>;
  return (
    <div className="guided-thinking">
      <div className="guided-intro"><div className="kicker">Describe one real use of AI</div><h2>Think about the work first. CRUX handles the schema underneath.</h2><p>Answer in ordinary language. More questions appear only when the use can materially affect people or cause actions.</p></div>
      <section className="thinking-step"><StepNumber number="01" title="Where is AI involved?" /><Guidance title="Example">“AI reads a funding application and highlights evidence that might relate to eligibility criteria.”</Guidance><Field label="Organisation" id="organisation-name"><input id="organisation-name" className="input" value={organisation.name} onChange={(event) => onMutate((next) => { if (next.organisations[0]) next.organisations[0].name = event.target.value; })} /></Field><Field label="Name this use" id="use-name"><input id="use-name" className="input" value={use.name} onChange={(event) => onUseChange({ name: event.target.value })} /></Field><Field label="What are you trying to do?" id="purpose"><textarea id="purpose" className="textarea" value={use.purpose} onChange={(event) => onUseChange({ purpose: event.target.value })} /></Field><Field label="Explain it simply for someone outside your organisation" id="public-summary"><textarea id="public-summary" className="textarea" value={use.public_summary ?? ""} onChange={(event) => onUseChange({ public_summary: event.target.value })} /></Field><Field label="What does AI do in this process?" id="system-description"><textarea id="system-description" className="textarea" value={system.description} onChange={(event) => onSystemChange({ description: event.target.value })} /></Field></section>
      <section className="thinking-step"><StepNumber number="02" title="What power does it have?" /><Guidance title="Why we ask">The key distinction is whether AI only helps someone think, or whether it can decide or cause something to happen.</Guidance><div className="choice-grid">{influenceChoices.map((choice) => <label className="choice-card" key={choice.value}><input type="checkbox" checked={system.influence.includes(choice.value)} onChange={(event) => onToggleInfluence(choice.value, event.target.checked)} /><span><strong>{choice.label}</strong><small>{choice.help}</small></span></label>)}</div><Field label="Can AI cause an action?" id="agency"><select id="agency" className="select" value={system.agency} onChange={(event) => onSystemChange({ agency: event.target.value as AIAgency })}>{agencyChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></Field><label className="checkbox-line consequence-check"><input type="checkbox" checked={use.consequential} onChange={(event) => onUseChange({ consequential: event.target.checked })} /><span><strong>This use can materially affect someone.</strong><small>For example their eligibility, access to a service, opportunity, rights, money or treatment.</small></span></label>{versionId && (use.consequential || system.agency !== "none") ? <div className="progressive-detail"><div className="kicker">Because this matters, a few more questions</div><h3>Who decides, and what can actually happen?</h3><AuthorityEditor bundle={bundle} systemVersionId={versionId} onBundleChange={onBundleChange} /></div> : <div className="proportionate-stop">For straightforward assistive use, this can stay lightweight. You do not need to model a complex governance workflow that does not exist.</div>}</section>
      <section className="thinking-step"><StepNumber number="03" title="Why should someone believe this?" /><Guidance title="Think of this as SAYS → SHOWS">First write what the organisation says is true. Then add the evidence separately. A statement with no evidence is allowed to remain just a statement.</Guidance>{claim ? <><Field label="What are you saying is true?" id="claim"><textarea id="claim" className="textarea" value={claim.statement} onChange={(event) => onMutate((next) => { const target = next.claims.find((item) => item.id === claim.id); if (target) target.statement = event.target.value; })} /></Field><EvidenceEditor bundle={bundle} claimId={claim.id} onBundleChange={onBundleChange} /></> : <div className="notice">This imported use has no directly scoped statement. CRUX will not invent one silently.</div>}</section>
      {use.consequential && versionId ? <section className="thinking-step"><StepNumber number="04" title="What happened here?" /><Guidance title="Only for specific cases">This is not another policy statement. Record a particular consequential case so someone can see what AI contributed, who decided and what the outcome was.</Guidance><ReceiptEditor bundle={bundle} systemVersionId={versionId} onBundleChange={onBundleChange} /></section> : null}
      <div className="guided-actions"><button className="btn" type="button" onClick={onAddUse}>+ Add another AI use</button><button className="btn primary" type="button" onClick={() => onGoTo("where")}>See how this reads</button></div>
    </div>
  );
}

function QuestionHeading({ number, title, copy }: { number: string; title: string; copy: string }) { return <header className="question-heading"><span>{number}</span><div><h2>{title}</h2><p>{copy}</p></div></header>; }
function StepNumber({ number, title }: { number: string; title: string }) { return <div className="step-number"><span>{number}</span><h3>{title}</h3></div>; }
function Guidance({ title, children }: { title: string; children: React.ReactNode }) { return <div className="guidance"><strong>{title}</strong><span>{children}</span></div>; }
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="field"><label htmlFor={id}>{label}</label>{children}</div>; }
