"use client";

import { useMemo, useState } from "react";
import {
  parsePortableBundle,
  portableBundleSchema,
  redactBundle,
  validateBundleReferences,
  type CruxPortableBundle,
} from "@crux/formats";
import type { AIAgency, AIInfluence } from "@crux/schemas";
import writingAssistantJson from "../../../examples/writing-assistant/crux.json";
import fundingReviewJson from "../../../examples/funding-review/crux.json";
import boundedActionJson from "../../../examples/bounded-action/crux.json";
import { appendAIUse } from "../lib/authoring";
import { buildReaderModel, type Audience } from "../lib/reader-model";
import { createStarterBundle } from "../lib/starter";
import { AuthorityEditor } from "./authority-editor";
import { CruxReader } from "./crux-reader";
import { EvidenceEditor } from "./evidence-editor";
import { ReceiptEditor } from "./receipt-editor";

type Mode = "read" | "edit";

type ExampleCase = {
  id: string;
  name: string;
  note: string;
  bundle: CruxPortableBundle;
};

const examples: ExampleCase[] = [
  {
    id: "writing-assistant",
    name: "Writing assistant",
    note: "Low consequence",
    bundle: parsePortableBundle(writingAssistantJson as unknown),
  },
  {
    id: "funding-review",
    name: "Funding review",
    note: "Human decision",
    bundle: parsePortableBundle(fundingReviewJson as unknown),
  },
  {
    id: "bounded-action",
    name: "Bounded action",
    note: "Agentic workflow",
    bundle: parsePortableBundle(boundedActionJson as unknown),
  },
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


// Worked-example guidance for the funding review teaching case.
const fundingTeaching = {
  where: "Follow the application from input to outcome. AI appears once: it surfaces possible evidence. The funding officer then reviews the original application before the eligibility decision.",
};

const draftNotice = "This record is still a draft. Public and affected-person views become available once the record is structurally valid.";

const clarityStyles = `
  .clarity-workbench { overflow: hidden; }
  .clarity-workbench .toolbar { background: rgba(255,255,255,.42); }
  .clarity-record-tools { margin: 0; padding: 14px 18px; border-top: 0; border-bottom: 1px solid var(--line); background: rgba(255,255,255,.2); }
  .clarity-record-tools[open] summary { margin-bottom: 12px; }
  .clarity-edit-shell { padding: clamp(24px, 4vw, 48px); }
  .clarity-edit-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 22px; margin-bottom: 28px; border-bottom: 1px solid var(--line); }
  .clarity-mode-note { color: var(--muted); font-size: 13px; line-height: 1.45; max-width: 620px; }
  @media (max-width: 680px) {
    .clarity-edit-top { align-items: flex-start; flex-direction: column; }
  }
`;

export function ClarityWorkbench() {
  const initial = examples[1]!.bundle;
  const [bundle, setBundle] = useState<CruxPortableBundle>(() => structuredClone(initial));
  const [selectedUseId, setSelectedUseId] = useState(initial.ai_uses[0]?.id ?? "");
  const [audience, setAudience] = useState<Audience>("internal");
  const [mode, setMode] = useState<Mode>("read");
  const [activeExample, setActiveExample] = useState<string | null>("funding-review");
  const [error, setError] = useState<string | null>(null);

  const structural = useMemo(() => portableBundleSchema.safeParse(bundle), [bundle]);
  const references = useMemo(
    () => structural.success ? validateBundleReferences(structural.data) : null,
    [structural],
  );
  const canonical = structural.success && references?.valid ? structural.data : null;
  const effectiveAudience: Audience = canonical ? audience : "internal";
  const projection = useMemo(
    () => canonical && effectiveAudience !== "internal" ? redactBundle(canonical, effectiveAudience) : null,
    [canonical, effectiveAudience],
  );
  const model = useMemo(
    () => projection
      ? buildReaderModel({ kind: "disclosure", projection }, selectedUseId)
      : buildReaderModel({ kind: "working", bundle }, selectedUseId),
    [projection, bundle, selectedUseId],
  );

  const use = bundle.ai_uses.find((item) => item.id === selectedUseId) ?? bundle.ai_uses[0];
  const system = selectedCanonicalSystem(bundle, use);
  const version = selectedCanonicalVersion(bundle, system);
  const refs = new Set([use?.id, system?.id, version?.id].filter((value): value is string => Boolean(value)));
  const claim = bundle.claims.find((item) => relevantClaim(item, refs));

  const mutate = (change: (next: CruxPortableBundle) => void) => {
    setBundle((current) => {
      const next = structuredClone(current);
      change(next);
      next.generated_at = new Date().toISOString();
      return next;
    });
    setActiveExample(null);
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

  const loadExample = (example: ExampleCase) => {
    const next = structuredClone(example.bundle);
    setBundle(next);
    setSelectedUseId(next.ai_uses[0]?.id ?? "");
    setAudience("internal");
    setMode("read");
    setActiveExample(example.id);
    setError(null);
  };

  const openBundle = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parsePortableBundle(JSON.parse(await file.text()) as unknown);
      setBundle(parsed);
      setSelectedUseId(parsed.ai_uses[0]?.id ?? "");
      setAudience("internal");
      setMode("read");
      setActiveExample(null);
      setError(null);
    } catch (caught) {
      setError(formatError(caught));
    }
  };

  const startNew = () => {
    const starter = createStarterBundle();
    setBundle(starter);
    setSelectedUseId(starter.ai_uses[0]?.id ?? "");
    setAudience("internal");
    setMode("edit");
    setActiveExample(null);
    setError(null);
  };

  const addUse = () => {
    const result = appendAIUse(bundle);
    setBundle(result.bundle);
    setSelectedUseId(result.aiUseId);
    setAudience("internal");
    setMode("edit");
    setActiveExample(null);
  };

  const baseName = slug(bundle.organisations[0]?.name ?? "crux");
  // "Download this view" exports exactly what the reader sees: the projection for
  // lower-disclosure audiences, the validated record for internal.
  const exportValue = projection ?? canonical;

  const exampleButtons = (
    <div className="toolbar-group" aria-label="Example records">
      <span className="kicker" style={{ margin: 0 }}>Try an example</span>
      {examples.map((example) => (
        <button
          className={`btn ${activeExample === example.id ? "primary" : "ghost"}`}
          aria-pressed={activeExample === example.id}
          type="button"
          key={example.id}
          onClick={() => loadExample(example)}
          title={example.note}
        >
          {example.name}
        </button>
      ))}
      <button className="btn ghost" type="button" onClick={startNew}>Start your own</button>
    </div>
  );

  if (mode === "read") {
    return (
      <CruxReader
        model={model}
        onAudienceChange={setAudience}
        availableAudiences={canonical ? ["internal", "public", "affected_party"] : ["internal"]}
        note={error ?? (canonical ? undefined : draftNotice)}
        {...(activeExample === "funding-review" ? { teaching: fundingTeaching } : {})}
        toolbar={(
          <>
            {exampleButtons}
            <div className="toolbar-group" aria-label="Record actions">
              {bundle.ai_uses.length > 1 ? (
                <select className="select compact-select" aria-label="AI use" value={use?.id ?? ""} onChange={(event) => setSelectedUseId(event.target.value)}>
                  {bundle.ai_uses.map((item) => <option value={item.id} key={item.id}>{item.name || "Untitled AI use"}</option>)}
                </select>
              ) : null}
              <label className="btn file-label">Open JSON<input type="file" accept="application/json,.json" onChange={(event) => void openBundle(event.target.files?.[0])} /></label>
              <button
                className="btn"
                type="button"
                disabled={!exportValue}
                onClick={() => exportValue && downloadJson(
                  exportValue,
                  `${baseName}-${effectiveAudience === "internal" ? "crux" : effectiveAudience}.json`,
                )}
              >
                Download {effectiveAudience === "internal" ? "record" : "this view"}
              </button>
              <button className="btn primary" type="button" onClick={() => { setAudience("internal"); setMode("edit"); }}>Edit this record</button>
            </div>
          </>
        )}
      />
    );
  }

  return (
    <section className="workbench clarity-workbench" aria-label="CRUX record editor">
      <style>{clarityStyles}</style>

      <div className="toolbar">
        {exampleButtons}
        <button className="btn primary" type="button" onClick={() => setMode("read")}>Back to reading view</button>
      </div>

      {error ? <div className="error-box" style={{ margin: 18 }}>{error}</div> : null}

      <div className="clarity-edit-shell">
        <div className="clarity-edit-top">
          <div>
            <div className="kicker">Editing internal record</div>
            <strong>{bundle.organisations[0]?.name ?? "Your organisation"}{use ? ` · ${use.name}` : ""}</strong>
            <div className="clarity-mode-note">Describe the use in ordinary language. CRUX keeps the richer schema underneath and only asks for more detail when consequence or agency makes it useful.</div>
          </div>
          {bundle.ai_uses.length > 1 ? (
            <select className="select compact-select" aria-label="AI use" value={use?.id ?? ""} onChange={(event) => setSelectedUseId(event.target.value)}>
              {bundle.ai_uses.map((item) => <option value={item.id} key={item.id}>{item.name || "Untitled AI use"}</option>)}
            </select>
          ) : null}
        </div>

        <EditPanel
          bundle={bundle}
          use={use}
          system={system}
          versionId={version?.id}
          claim={claim}
          onMutate={mutate}
          onUseChange={updateUse}
          onSystemChange={updateSystem}
          onToggleInfluence={toggleInfluence}
          onBundleChange={(next) => {
            setBundle(next);
            setActiveExample(null);
          }}
          onAddUse={addUse}
          onRead={() => setMode("read")}
        />

        <details className="advanced-details clarity-record-tools" style={{ marginTop: 28 }}>
          <summary>Record actions</summary>
          <div className="toolbar-group">
            <label className="btn file-label">Open JSON<input type="file" accept="application/json,.json" onChange={(event) => void openBundle(event.target.files?.[0])} /></label>
            <button className="btn ghost" type="button" onClick={startNew}>Reset to a new record</button>
            <button className="btn" type="button" disabled={!canonical} onClick={() => canonical && downloadJson(canonical, `${baseName}-crux.json`)}>Download record</button>
          </div>
        </details>
      </div>
    </section>
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
  onToggleInfluence,
  onBundleChange,
  onAddUse,
  onRead,
}: {
  bundle: CruxPortableBundle;
  use: CruxPortableBundle["ai_uses"][number] | undefined;
  system: CruxPortableBundle["systems"][number] | undefined;
  versionId: string | undefined;
  claim: CruxPortableBundle["claims"][number] | undefined;
  onMutate: (change: (next: CruxPortableBundle) => void) => void;
  onUseChange: (patch: Partial<CruxPortableBundle["ai_uses"][number]>) => void;
  onSystemChange: (patch: Partial<CruxPortableBundle["systems"][number]>) => void;
  onToggleInfluence: (value: AIInfluence, checked: boolean) => void;
  onBundleChange: (bundle: CruxPortableBundle) => void;
  onAddUse: () => void;
  onRead: () => void;
}) {
  const organisation = bundle.organisations[0];
  if (!organisation || !use || !system) return <div className="empty">This record can be read, but the guided editor cannot edit this shape yet.</div>;

  return (
    <div className="guided-thinking">
      <div className="guided-intro">
        <div className="kicker">Describe one real use of AI</div>
        <h2>Start with the work, not the technology.</h2>
        <p>The four questions structure authoring too, but extra governance detail appears only when the use can materially affect people or cause actions.</p>
      </div>

      <section className="thinking-step">
        <StepNumber number="01" title="Where is AI involved?" />
        <Guidance title="Example">“AI reads a funding application and highlights evidence that might relate to eligibility criteria.”</Guidance>
        <Field label="Organisation" id="organisation-name"><input id="organisation-name" className="input" value={organisation.name} onChange={(event) => onMutate((next) => { if (next.organisations[0]) next.organisations[0].name = event.target.value; })} /></Field>
        <Field label="Name this use" id="use-name"><input id="use-name" className="input" value={use.name} onChange={(event) => onUseChange({ name: event.target.value })} /></Field>
        <Field label="What are you trying to do?" id="purpose"><textarea id="purpose" className="textarea" value={use.purpose} onChange={(event) => onUseChange({ purpose: event.target.value })} /></Field>
        <Field label="Explain it simply for someone outside your organisation" id="public-summary"><textarea id="public-summary" className="textarea" value={use.public_summary ?? ""} onChange={(event) => onUseChange({ public_summary: event.target.value })} /></Field>
        <Field label="What does AI do in this process?" id="system-description"><textarea id="system-description" className="textarea" value={system.description} onChange={(event) => onSystemChange({ description: event.target.value })} /></Field>
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
        <Guidance title="SAYS → SHOWS">Write what the organisation says is true. Add evidence separately. A statement with no evidence is allowed to stay a statement.</Guidance>
        {claim ? (
          <>
            <Field label="What are you saying is true?" id="claim"><textarea id="claim" className="textarea" value={claim.statement} onChange={(event) => onMutate((next) => { const target = next.claims.find((item) => item.id === claim.id); if (target) target.statement = event.target.value; })} /></Field>
            <EvidenceEditor bundle={bundle} claimId={claim.id} onBundleChange={onBundleChange} />
          </>
        ) : <div className="notice">This imported use has no directly scoped statement. CRUX will not invent one silently.</div>}
      </section>

      {use.consequential && versionId ? (
        <section className="thinking-step">
          <StepNumber number="04" title="What happened here?" />
          <Guidance title="Only for particular cases">This is not another policy statement. Record a specific consequential case so someone can see what AI contributed, who decided and what outcome followed.</Guidance>
          <ReceiptEditor bundle={bundle} systemVersionId={versionId} onBundleChange={onBundleChange} />
        </section>
      ) : null}

      <div className="guided-actions">
        <button className="btn" type="button" onClick={onAddUse}>+ Add another AI use</button>
        <button className="btn primary" type="button" onClick={onRead}>See how this reads</button>
      </div>
    </div>
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
