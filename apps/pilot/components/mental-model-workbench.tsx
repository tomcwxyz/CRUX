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
type DisplayBundle = CruxPortableBundle | CruxDisclosureBundle;
type DisplayAIUse = DisplayBundle["ai_uses"][number];
type DisplaySystem = DisplayBundle["systems"][number];
type DisplayVersion = DisplayBundle["system_versions"][number];
type DisplayClaim = DisplayBundle["claims"][number];
type DisplayEvidence = DisplayBundle["evidence"][number];

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

const selectedSystemFor = (use: DisplayAIUse | undefined, systems: DisplaySystem[]) => {
  if (!use) return undefined;
  return systems.find(
    (system) => use.system_refs.includes(system.id) || system.ai_use_refs.includes(use.id),
  );
};

const selectedVersionFor = (system: DisplaySystem | undefined, versions: DisplayVersion[]) => {
  if (!system) return undefined;
  if (system.current_version_ref) {
    return versions.find((version) => version.id === system.current_version_ref);
  }
  return versions.find((version) => version.system_ref === system.id);
};

const claimAppliesToSelection = (
  claim: DisplayClaim,
  use: DisplayAIUse | undefined,
  system: DisplaySystem | undefined,
  version: DisplayVersion | undefined,
) => {
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  return claim.applies_to.some((target) => refs.has(target.ref));
};

const evidenceKindLabel = (kind: string) => kind.replaceAll("_", " ");

const relationshipLabel = (relationship: string) => {
  if (relationship === "supports") return "Supports";
  if (relationship === "qualifies") return "Qualifies";
  if (relationship === "contradicts") return "Challenges";
  return "Inconclusive";
};

const powerSummary = (system: DisplaySystem | undefined) => {
  if (!system) return ["No system details recorded yet."];
  const labels = system.influence.map((value) => {
    const match = influenceChoices.find((choice) => choice.value === value);
    return match?.label ?? value.replaceAll("_", " ");
  });
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
  const references = useMemo(
    () => (structural.success ? validateBundleReferences(structural.data) : null),
    [structural],
  );
  const canonical = structural.success && references?.valid ? structural.data : null;
  const effectiveLens: Lens = canonical ? lens : "working";
  const projection = useMemo(
    () => (canonical && effectiveLens !== "working" ? redactBundle(canonical, effectiveLens) : null),
    [canonical, effectiveLens],
  );
  const display: DisplayBundle = projection ?? bundle;

  const displayUse = display.ai_uses.find((item) => item.id === selectedUseId) ?? display.ai_uses[0];
  const displaySystem = selectedSystemFor(displayUse, display.systems);
  const displayVersion = selectedVersionFor(displaySystem, display.system_versions);
  const displayClaims = display.claims.filter((claim) => claimAppliesToSelection(claim, displayUse, displaySystem, displayVersion));
  const displayEvidence = display.evidence;

  const canonicalUse = bundle.ai_uses.find((item) => item.id === selectedUseId) ?? bundle.ai_uses[0];
  const canonicalSystem = canonicalUse ? selectedSystemFor(canonicalUse, bundle.systems) : undefined;
  const canonicalVersion = canonicalSystem ? selectedVersionFor(canonicalSystem, bundle.system_versions) : undefined;
  const selectedVersionRef = canonicalVersion?.id;
  const selectedClaim = bundle.claims.find((claim) =>
    claimAppliesToSelection(claim, canonicalUse, canonicalSystem, canonicalVersion),
  );

  const visibleLinks = projection ? projection.claim_evidence_links : bundle.evidence_links;
  const receipts = effectiveLens === "working"
    ? bundle.receipts
    : (projection?.trace_views.flatMap((view) => (view.receipt ? [view.receipt] : [])) ?? []);
  const observed = useMemo(
    () => observedBehaviourForVersion(bundle, canonicalVersion?.id),
    [bundle, canonicalVersion?.id],
  );
  const isFundingExample = (canonicalUse?.name ?? "").toLowerCase().includes("funding") || canonicalUse?.id.includes("funding");
  const canShare = canonical !== null;

  const mutate = (change: (next: CruxPortableBundle) => void) => {
    setBundle((current) => {
      const next = structuredClone(current);
      change(next);
      next.generated_at = new Date().toISOString();
      return next;
    });
  };

  const updateUse = (patch: Partial<CruxPortableBundle["ai_uses"][number]>) => {
    if (!canonicalUse) return;
    mutate((next) => {
      const use = next.ai_uses.find((item) => item.id === canonicalUse.id);
      if (use) Object.assign(use, patch);
    });
  };

  const updateSystem = (patch: Partial<CruxPortableBundle["systems"][number]>) => {
    if (!canonicalSystem) return;
    mutate((next) => {
      const system = next.systems.find((item) => item.id === canonicalSystem.id);
      if (system) Object.assign(system, patch);
    });
  };

  const updateClaim = (statement: string) => {
    if (!selectedClaim) return;
    mutate((next) => {
      const claim = next.claims.find((item) => item.id === selectedClaim.id);
      if (claim) claim.statement = statement;
    });
  };

  const toggleInfluence = (value: AIInfluence, checked: boolean) => {
    if (!canonicalSystem) return;
    const nextValues = checked
      ? Array.from(new Set([...canonicalSystem.influence, value]))
      : canonicalSystem.influence.filter((item) => item !== value);
    if (nextValues.length === 0) return;
    updateSystem({ influence: nextValues });
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
    try {
      const result = appendAIUse(bundle);
      setBundle(result.bundle);
      setSelectedUseId(result.aiUseId);
      setQuestion("edit");
      setLens("working");
      setError(null);
    } catch (caught) {
      setError(formatError(caught));
    }
  };

  const organisationName = display.organisations[0]?.name ?? "Your organisation";
  const baseName = slug(bundle.organisations[0]?.name ?? "crux");

  return (
    <section className="workbench mental-workbench" aria-label="CRUX pilot workbench">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="btn file-label">
            Open record
            <input type="file" accept="application/json,.json" onChange={(event) => void openBundle(event.target.files?.[0])} />
          </label>
          <button className="btn ghost" type="button" onClick={reset}>New record</button>
          <button className="btn" type="button" disabled={!canShare} onClick={() => canonical && downloadJson(canonical, `${baseName}-crux.json`)}>Download record</button>
        </div>
        <div className="toolbar-group" aria-label="Disclosure lens">
          {(["working", "public", "affected_party"] as Lens[]).map((item) => (
            <button
              key={item}
              className={`btn ${effectiveLens === item ? "primary" : "ghost"}`}
              type="button"
              disabled={item !== "working" && !canShare}
              onClick={() => {
                setLens(item);
                if (item !== "working" && question === "edit") setQuestion("where");
              }}
            >
              {lensLabel[item]}
            </button>
          ))}
          {effectiveLens === "working" ? (
            <button className="btn primary" type="button" onClick={() => setQuestion("edit")}>Describe this use</button>
          ) : null}
        </div>
      </div>

      <div className="question-strip" aria-label="Four CRUX questions">
        {questions.map((item) => (
          <button
            className={`question-tab ${question === item.id ? "active" : ""}`}
            type="button"
            key={item.id}
            onClick={() => setQuestion(item.id)}
          >
            <span className="question-number">{item.number}</span>
            <span><strong>{item.title}</strong><small>{item.short}</small></span>
          </button>
        ))}
      </div>

      <div className="panel">
        {error ? <div className="error-box" style={{ marginBottom: 18 }}>{error}</div> : null}
        {!canShare ? (
          <div className="notice" style={{ marginBottom: 18 }}>
            This is still a working draft. CRUX will not create public or affected-person views until the record is structurally valid.
          </div>
        ) : null}

        <div className="context-line">
          <div>
            <div className="kicker">{lensLabel[effectiveLens]}</div>
            <strong>{organisationName}</strong>{displayUse ? <span> · {displayUse.name}</span> : null}
          </div>
          {effectiveLens === "working" && bundle.ai_uses.length > 1 ? (
            <select className="select compact-select" value={canonicalUse?.id ?? ""} onChange={(event) => setSelectedUseId(event.target.value)}>
              {bundle.ai_uses.map((use) => <option value={use.id} key={use.id}>{use.name || "Untitled AI use"}</option>)}
            </select>
          ) : null}
        </div>

        {question === "where" ? (
          <WherePanel use={displayUse} system={displaySystem} version={displayVersion} isFundingExample={isFundingExample} />
        ) : null}

        {question === "power" ? (
          <PowerPanel use={displayUse} system={displaySystem} version={displayVersion} observed={observed} working={effectiveLens === "working"} />
        ) : null}

        {question === "believe" ? (
          <BelievePanel
            claims={displayClaims}
            evidence={displayEvidence}
            links={visibleLinks}
            working={effectiveLens === "working"}
            selectedClaim={selectedClaim}
            bundle={bundle}
            onBundleChange={setBundle}
          />
        ) : null}

        {question === "happened" ? (
          <HappenedPanel
            receipts={receipts}
            working={effectiveLens === "working"}
            consequential={Boolean(canonicalUse?.consequential)}
            bundle={bundle}
            versionId={selectedVersionRef}
            onBundleChange={setBundle}
          />
        ) : null}

        {question === "edit" && effectiveLens === "working" ? (
          <EditPanel
            bundle={bundle}
            use={canonicalUse}
            system={canonicalSystem}
            versionId={selectedVersionRef}
            claim={selectedClaim}
            onMutate={mutate}
            onUseChange={updateUse}
            onSystemChange={updateSystem}
            onClaimChange={updateClaim}
            onToggleInfluence={toggleInfluence}
            onBundleChange={setBundle}
            onAddUse={addUse}
            onGoTo={setQuestion}
          />
        ) : null}
      </div>

      <div className="mental-footer">
        <span><strong>SAYS</strong> is not the same as <strong>SHOWS</strong>.</span>
        <span><strong>HAPPENED</strong> describes a particular case.</span>
        <span><strong>UNKNOWN</strong> is allowed to stay unknown.</span>
      </div>
    </section>
  );
}

function WherePanel({
  use,
  system,
  version,
  isFundingExample,
}: {
  use?: DisplayAIUse;
  system?: DisplaySystem;
  version?: DisplayVersion;
  isFundingExample: boolean;
}) {
  const nodes = version?.process.nodes ?? [];
  return (
    <div>
      <QuestionHeading number="01" title="Where is AI involved?" copy="Start with the real-world process. AI should be visible as one part of the story, not as the story itself." />

      {isFundingExample ? (
        <div className="teaching-card">
          <div className="kicker">How to read this example</div>
          <div className="teaching-steps">
            <div><strong>1</strong><span>Follow the application through the real process.</span></div>
            <div><strong>2</strong><span>Notice where AI appears — and where it stops.</span></div>
            <div><strong>3</strong><span>Then ask who actually decides whether the applicant is eligible.</span></div>
          </div>
        </div>
      ) : null}

      <div className="story-intro">
        <div>
          <div className="kicker">The use</div>
          <h3>{use?.name ?? "AI use not yet described"}</h3>
          <p>{use?.public_summary || use?.purpose || system?.description || "No plain-language explanation has been recorded yet."}</p>
        </div>
        {use?.consequential ? <span className="impact-flag">May materially affect people</span> : <span className="impact-flag quiet">Low-consequence / assistive</span>}
      </div>

      {nodes.length ? (
        <div className="story-flow" aria-label="AI process story">
          {nodes.map((node, index) => (
            <div style={{ display: "contents" }} key={node.id}>
              {index > 0 ? <div className="story-arrow" aria-hidden="true">→</div> : null}
              <article className={`story-node node-${node.type}`}>
                <span>{nodeLabels[node.type] ?? node.type}</span>
                <strong>{node.name}</strong>
                {node.description ? <small>{node.description}</small> : null}
              </article>
            </div>
          ))}
        </div>
      ) : <div className="empty">The process has not been described yet.</div>}

      <Guidance title="Critical question">Could someone point to the exact step where AI enters this process, and the exact step where human judgement or authority takes over?</Guidance>
    </div>
  );
}

function PowerPanel({
  use,
  system,
  version,
  observed,
  working,
}: {
  use?: DisplayAIUse;
  system?: DisplaySystem;
  version?: DisplayVersion;
  observed: ReturnType<typeof observedBehaviourForVersion>;
  working: boolean;
}) {
  return (
    <div>
      <QuestionHeading number="02" title="What power does it have?" copy="The important question is not how advanced the model is. It is what the AI can influence, decide or cause in this particular process." />

      <div className="power-grid">
        <article className="mental-card">
          <div className="kicker">AI can…</div>
          {powerSummary(system).map((item) => <div className="power-line" key={item}>{item}</div>)}
        </article>
        <article className="mental-card">
          <div className="kicker">Before anything consequential happens…</div>
          {version?.decisions.length ? version.decisions.map((decision) => (
            <div className="authority-line" key={decision.id}>
              <strong>{decision.name}</strong>
              <span>Final authority: {decision.authority.replaceAll("_", " ")}</span>
              <span>{decision.review_before_effect ? "Review happens before effect" : "No pre-effect review recorded"}</span>
            </div>
          )) : <div className="small muted">No consequential decision point is recorded.</div>}
        </article>
      </div>

      {version?.actions.length ? (
        <div className="mental-card" style={{ marginTop: 16 }}>
          <div className="kicker">Actions AI may be connected to</div>
          {version.actions.map((action) => (
            <div className="action-boundary" key={action.id}>
              <div><strong>{action.name}</strong><span>{action.scope.summary}</span></div>
              <div className="pill-row" style={{ marginTop: 0 }}>
                <span className="pill">Initiated by {action.initiated_by}</span>
                <span className="pill">{action.human_approval_required ? "Human approval required" : "No human approval required"}</span>
                <span className="pill">Reversible: {action.reversibility}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Guidance title="The question to ask">Can this AI cause something to happen to a person without another person intervening?</Guidance>

      {working && observed.observationCount > 0 ? (
        <details className="advanced-details">
          <summary>System-reported activity</summary>
          <p className="small muted">Observed provider/model metadata can tell us whether the running system differs from what was described. It does not decide whether the system is trustworthy.</p>
          <div className="pill-row">
            <span className="pill">{observed.observationCount} observation{observed.observationCount === 1 ? "" : "s"}</span>
            <span className={`pill ${observed.divergenceCount ? "rust" : "moss"}`}>{observed.divergenceCount} difference{observed.divergenceCount === 1 ? "" : "s"} to review</span>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function BelievePanel({
  claims,
  evidence,
  links,
  working,
  selectedClaim,
  bundle,
  onBundleChange,
}: {
  claims: DisplayClaim[];
  evidence: DisplayEvidence[];
  links: Array<{ claim_ref: string; evidence_ref: string; relationship: string }>;
  working: boolean;
  selectedClaim?: CruxPortableBundle["claims"][number];
  bundle: CruxPortableBundle;
  onBundleChange: (bundle: CruxPortableBundle) => void;
}) {
  return (
    <div>
      <QuestionHeading number="03" title="Why should I believe this?" copy="CRUX deliberately separates what an organisation says from what evidence actually shows. Evidence may support, qualify or challenge a statement." />

      {claims.length ? claims.map((claim) => {
        const claimLinks = links.filter((link) => link.claim_ref === claim.id);
        const linkedEvidence = claimLinks.flatMap((link) => {
          const item = evidence.find((candidate) => candidate.id === link.evidence_ref);
          return item ? [{ item, relationship: link.relationship }] : [];
        });
        return (
          <article className="reasoning-stack" key={claim.id}>
            <div className="reasoning-row says-row">
              <div className="reasoning-label">SAYS</div>
              <div><strong>{claim.statement}</strong><p>What the organisation declares to be true.</p></div>
            </div>
            {linkedEvidence.length ? linkedEvidence.map(({ item, relationship }) => (
              <div className="reasoning-row shows-row" key={item.id}>
                <div className="reasoning-label">SHOWS</div>
                <div>
                  <strong>{item.summary}</strong>
                  <p>{relationshipLabel(relationship)} this statement · {evidenceKindLabel(item.kind)}</p>
                  {item.limitations.length ? <p className="caution">Limitation: {item.limitations.join(" · ")}</p> : null}
                  {item.external_refs[0] ? <a href={item.external_refs[0]} target="_blank" rel="noreferrer">Open source reference ↗</a> : null}
                </div>
              </div>
            )) : (
              <div className="reasoning-row unknown-row">
                <div className="reasoning-label">UNKNOWN</div>
                <div><strong>No evidence is linked yet.</strong><p>This remains a declaration. CRUX does not silently upgrade it into proof.</p></div>
              </div>
            )}
          </article>
        );
      }) : <div className="empty">No inspectable statement is visible for this use yet.</div>}

      {working && selectedClaim ? (
        <article className="mental-card add-evidence-card">
          <div className="kicker">Add to SHOWS</div>
          <h3>What helps you know whether this is true?</h3>
          <p className="small muted">For: “{selectedClaim.statement}”</p>
          <EvidenceEditor bundle={bundle} claimId={selectedClaim.id} onBundleChange={onBundleChange} />
        </article>
      ) : null}
    </div>
  );
}

function HappenedPanel({
  receipts,
  working,
  consequential,
  bundle,
  versionId,
  onBundleChange,
}: {
  receipts: Array<any>;
  working: boolean;
  consequential: boolean;
  bundle: CruxPortableBundle;
  versionId?: string;
  onBundleChange: (bundle: CruxPortableBundle) => void;
}) {
  return (
    <div>
      <QuestionHeading number="04" title="What happened here?" copy="A specific case is different from a general promise. This view records what AI contributed, what happened next and who had final authority." />

      {receipts.length ? receipts.map((receipt) => (
        <article className="reasoning-stack happened-stack" key={receipt.id}>
          <div className="reasoning-row happened-row">
            <div className="reasoning-label">HAPPENED</div>
            <div><strong>{receipt.ai_summary}</strong><p>AI contribution in this particular case.</p></div>
          </div>
          <div className="case-flow">
            <div><span>AI</span><strong>{receipt.ai_summary}</strong></div>
            <b>→</b>
            <div><span>Next</span><strong>{receipt.effect_of_ai}</strong></div>
            <b>→</b>
            <div><span>Person</span><strong>{receipt.human_involvement ?? "No human involvement recorded"}</strong></div>
            <b>→</b>
            <div><span>Outcome</span><strong>{receipt.outcome}</strong></div>
          </div>
          <div className="case-footer">
            <span><strong>Final authority:</strong> {receipt.final_authority}</span>
            <span><strong>Challenge:</strong> {receipt.challenge?.available ? receipt.challenge.description ?? receipt.challenge.uri ?? "Available" : "No challenge route recorded"}</span>
          </div>
        </article>
      )) : (
        <div className="empty">No specific consequential case has been recorded in this view.</div>
      )}

      {working && consequential && versionId ? (
        <article className="mental-card record-outcome-card">
          <div className="kicker">Add to HAPPENED</div>
          <ReceiptEditor bundle={bundle} systemVersionId={versionId} onBundleChange={onBundleChange} />
        </article>
      ) : null}
    </div>
  );
}

function EditPanel({
  bundle,
  use,
  system,
  versionId,
  claim,
  onMutate,
  onUseChange,
  onSystemChange,
  onClaimChange,
  onToggleInfluence,
  onBundleChange,
  onAddUse,
  onGoTo,
}: {
  bundle: CruxPortableBundle;
  use?: CruxPortableBundle["ai_uses"][number];
  system?: CruxPortableBundle["systems"][number];
  versionId?: string;
  claim?: CruxPortableBundle["claims"][number];
  onMutate: (change: (next: CruxPortableBundle) => void) => void;
  onUseChange: (patch: Partial<CruxPortableBundle["ai_uses"][number]>) => void;
  onSystemChange: (patch: Partial<CruxPortableBundle["systems"][number]>) => void;
  onClaimChange: (statement: string) => void;
  onToggleInfluence: (value: AIInfluence, checked: boolean) => void;
  onBundleChange: (bundle: CruxPortableBundle) => void;
  onAddUse: () => void;
  onGoTo: (question: Question) => void;
}) {
  const organisation = bundle.organisations[0];
  if (!organisation || !use || !system) return <div className="empty">This record can be read, but the simple guided editor cannot edit this shape yet.</div>;

  return (
    <div className="guided-thinking">
      <div className="guided-intro">
        <div className="kicker">Describe one real use of AI</div>
        <h2>Think about the work first. CRUX handles the schema underneath.</h2>
        <p>Answer in ordinary language. More questions appear only when the use can materially affect people or cause actions.</p>
      </div>

      <section className="thinking-step">
        <StepNumber number="01" title="Where is AI involved?" />
        <Guidance title="Example">“AI reads a funding application and highlights evidence that might relate to eligibility criteria.”</Guidance>
        <Field label="Organisation" id="organisation-name">
          <input id="organisation-name" className="input" value={organisation.name} onChange={(event) => onMutate((next) => { if (next.organisations[0]) next.organisations[0].name = event.target.value; })} />
        </Field>
        <Field label="Name this use" id="use-name">
          <input id="use-name" className="input" value={use.name} onChange={(event) => onUseChange({ name: event.target.value })} />
        </Field>
        <Field label="What are you trying to do?" id="purpose">
          <textarea id="purpose" className="textarea" value={use.purpose} onChange={(event) => onUseChange({ purpose: event.target.value })} />
        </Field>
        <Field label="Explain it simply for someone outside your organisation" id="public-summary">
          <textarea id="public-summary" className="textarea" value={use.public_summary ?? ""} onChange={(event) => onUseChange({ public_summary: event.target.value })} />
        </Field>
        <Field label="What does AI do in this process?" id="system-description">
          <textarea id="system-description" className="textarea" value={system.description} onChange={(event) => onSystemChange({ description: event.target.value })} />
        </Field>
      </section>

      <section className="thinking-step">
        <StepNumber number="02" title="What power does it have?" />
        <Guidance title="Why we ask">The key distinction is whether AI only helps someone think, or whether it can decide or cause something to happen.</Guidance>
        <div className="choice-grid">
          {influenceChoices.map((choice) => (
            <label className="choice-card" key={choice.value}>
              <input type="checkbox" checked={system.influence.includes(choice.value)} onChange={(event) => onToggleInfluence(choice.value, event.target.checked)} />
              <span><strong>{choice.label}</strong><small>{choice.help}</small></span>
            </label>
          ))}
        </div>
        <Field label="Can AI cause an action?" id="agency">
          <select id="agency" className="select" value={system.agency} onChange={(event) => onSystemChange({ agency: event.target.value as AIAgency })}>
            {agencyChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
        </Field>
        <label className="checkbox-line consequence-check">
          <input type="checkbox" checked={use.consequential} onChange={(event) => onUseChange({ consequential: event.target.checked })} />
          <span><strong>This use can materially affect someone.</strong><small>For example their eligibility, access to a service, opportunity, rights, money or treatment.</small></span>
        </label>
        {versionId && (use.consequential || system.agency !== "none") ? (
          <div className="progressive-detail">
            <div className="kicker">Because this matters, a few more questions</div>
            <h3>Who decides, and what can actually happen?</h3>
            <AuthorityEditor bundle={bundle} systemVersionId={versionId} onBundleChange={onBundleChange} />
          </div>
        ) : (
          <div className="proportionate-stop">For straightforward assistive use, this can stay lightweight. You do not need to model a complex governance workflow that does not exist.</div>
        )}
      </section>

      <section className="thinking-step">
        <StepNumber number="03" title="Why should someone believe this?" />
        <Guidance title="Think of this as SAYS → SHOWS">First write what the organisation says is true. Then add the evidence separately. A statement with no evidence is allowed to remain just a statement.</Guidance>
        {claim ? (
          <>
            <Field label="What are you saying is true?" id="claim">
              <textarea id="claim" className="textarea" value={claim.statement} onChange={(event) => onClaimChange(event.target.value)} />
            </Field>
            <EvidenceEditor bundle={bundle} claimId={claim.id} onBundleChange={onBundleChange} />
          </>
        ) : <div className="notice">This imported use has no directly scoped statement. CRUX will not invent one silently.</div>}
      </section>

      {use.consequential && versionId ? (
        <section className="thinking-step">
          <StepNumber number="04" title="What happened here?" />
          <Guidance title="Only for specific cases">This is not another policy statement. Record a particular consequential case so someone can see what AI contributed, who decided and what the outcome was.</Guidance>
          <ReceiptEditor bundle={bundle} systemVersionId={versionId} onBundleChange={onBundleChange} />
        </section>
      ) : null}

      <div className="guided-actions">
        <button className="btn" type="button" onClick={onAddUse}>+ Add another AI use</button>
        <button className="btn primary" type="button" onClick={() => onGoTo("where")}>See how this reads</button>
      </div>
    </div>
  );
}

function QuestionHeading({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <header className="question-heading">
      <span>{number}</span>
      <div><h2>{title}</h2><p>{copy}</p></div>
    </header>
  );
}

function StepNumber({ number, title }: { number: string; title: string }) {
  return <div className="step-number"><span>{number}</span><h3>{title}</h3></div>;
}

function Guidance({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="guidance"><strong>{title}</strong><span>{children}</span></div>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}</div>;
}
