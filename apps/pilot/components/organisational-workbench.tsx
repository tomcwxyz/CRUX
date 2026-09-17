"use client";

import { useMemo, useState } from "react";
import {
  inspectBundle,
  parsePortableBundle,
  portableBundleSchema,
  redactBundle,
  validateBundleReferences,
  type CruxPortableBundle,
} from "@crux/formats";
import type { AIAgency, AIInfluence } from "@crux/schemas";
import { appendAIUse } from "../lib/authoring";
import { observedBehaviourForVersion } from "../lib/observed";
import { createStarterBundle } from "../lib/starter";
import { AuthorityEditor } from "./authority-editor";
import { AuthoritySummary } from "./authority-summary";
import { EvidenceEditor } from "./evidence-editor";
import { ReceiptEditor } from "./receipt-editor";

type Tab = "overview" | "evidence" | "outcomes" | "observed" | "edit";
type Lens = "working" | "public" | "affected_party";

type DisplayClaim = {
  id: string;
  statement: string;
  status: string;
  reasons: string[];
};

const lensLabel: Record<Lens, string> = {
  working: "Working record",
  public: "Public view",
  affected_party: "Affected-person view",
};

const influenceOptions: Array<{ value: AIInfluence; label: string }> = [
  { value: "assistive", label: "Assists — drafts, summarises or transforms" },
  { value: "informational", label: "Provides information" },
  { value: "advisory", label: "Recommends or advises" },
  { value: "conditional", label: "Influences what happens when conditions are met" },
  { value: "decisional", label: "Directly contributes to a decision" },
];

const agencyOptions: Array<{ value: AIAgency; label: string }> = [
  { value: "none", label: "Cannot cause an action" },
  { value: "proposes_action", label: "Can propose an action" },
  { value: "human_approval_required", label: "Can act only after human approval" },
  { value: "automatic_bounded", label: "Can act automatically within fixed limits" },
  { value: "autonomous_bounded", label: "Can choose and act within defined limits" },
];

const idsFrom = (values: unknown[]) =>
  new Set(
    values.flatMap((value) => {
      if (typeof value !== "object" || value === null || !("id" in value)) return [];
      const id = (value as { id?: unknown }).id;
      return typeof id === "string" ? [id] : [];
    }),
  );

const formatError = (error: unknown) =>
  error instanceof Error ? error.message : "That file could not be opened as a CRUX bundle.";

const slug = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "crux";

const downloadJson = (value: unknown, filename: string) => {
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function OrganisationalWorkbench() {
  const [bundle, setBundle] = useState<CruxPortableBundle>(() => createStarterBundle());
  const [selectedUseId, setSelectedUseId] = useState("ai-use:primary");
  const [tab, setTab] = useState<Tab>("overview");
  const [lens, setLens] = useState<Lens>("working");
  const [error, setError] = useState<string | null>(null);

  const structural = useMemo(() => portableBundleSchema.safeParse(bundle), [bundle]);
  const referenceValidation = useMemo(
    () => (structural.success ? validateBundleReferences(structural.data) : null),
    [structural],
  );
  const canonical = structural.success && referenceValidation?.valid ? structural.data : null;
  const inspection = useMemo(
    () => (structural.success ? inspectBundle(structural.data) : null),
    [structural],
  );
  const effectiveLens: Lens = canonical ? lens : "working";
  const projection = useMemo(
    () => (canonical && effectiveLens !== "working" ? redactBundle(canonical, effectiveLens) : null),
    [canonical, effectiveLens],
  );

  const visibleUseIds = projection ? idsFrom(projection.ai_uses) : null;
  const visibleSystemIds = projection ? idsFrom(projection.systems) : null;
  const visibleVersionIds = projection ? idsFrom(projection.system_versions) : null;
  const visibleClaimIds = projection ? idsFrom(projection.claims) : null;
  const visibleEvidenceIds = projection ? idsFrom(projection.evidence) : null;

  const organisations = projection
    ? bundle.organisations.filter((item) => idsFrom(projection.organisations).has(item.id))
    : bundle.organisations;
  const aiUses = bundle.ai_uses.filter((item) => !visibleUseIds || visibleUseIds.has(item.id));
  const systems = bundle.systems.filter((item) => !visibleSystemIds || visibleSystemIds.has(item.id));
  const versions = bundle.system_versions.filter(
    (item) => !visibleVersionIds || visibleVersionIds.has(item.id),
  );
  const evidence = bundle.evidence.filter(
    (item) => !visibleEvidenceIds || visibleEvidenceIds.has(item.id),
  );

  const draftClaims: DisplayClaim[] = bundle.claims.map((claim) => ({
    id: claim.id,
    statement: claim.statement,
    status: "draft",
    reasons: ["The working record is not currently a valid canonical CRUX bundle."],
  }));
  const claims: DisplayClaim[] = (inspection?.claim_statuses ?? draftClaims).filter(
    (item) => !visibleClaimIds || visibleClaimIds.has(item.id),
  );

  const receiptViews = effectiveLens === "working"
    ? bundle.receipts
    : (projection?.trace_views.flatMap((view) => (view.receipt ? [view.receipt] : [])) ?? []);

  const primaryOrganisation = bundle.organisations[0];
  const selectedUse = bundle.ai_uses.find((item) => item.id === selectedUseId) ?? bundle.ai_uses[0];
  const selectedSystem = selectedUse
    ? bundle.systems.find(
        (system) => selectedUse.system_refs.includes(system.id) || system.ai_use_refs.includes(selectedUse.id),
      )
    : undefined;
  const selectedVersionRef = selectedSystem?.current_version_ref;
  const selectedClaim = selectedVersionRef
    ? bundle.claims.find((claim) =>
        claim.applies_to.some(
          (target) => target.kind === "system_version" && target.ref === selectedVersionRef,
        ),
      )
    : undefined;

  const selectedVisibleUse = aiUses.find((item) => item.id === selectedUse?.id) ?? aiUses[0];
  const selectedVisibleSystem = selectedVisibleUse
    ? systems.find(
        (system) =>
          selectedVisibleUse.system_refs.includes(system.id) ||
          system.ai_use_refs.includes(selectedVisibleUse.id),
      )
    : undefined;
  const currentVersion = selectedVisibleSystem?.current_version_ref
    ? versions.find((version) => version.id === selectedVisibleSystem.current_version_ref)
    : versions[0];
  const projectedVersion = projection?.system_versions.find((version) => version.id === currentVersion?.id);
  const processNodes = projectedVersion?.process.nodes ?? currentVersion?.process.nodes ?? [];
  const observedBehaviour = useMemo(
    () => observedBehaviourForVersion(bundle, currentVersion?.id),
    [bundle, currentVersion?.id],
  );

  const schemaIssues = structural.success
    ? []
    : structural.error.issues.slice(0, 4).map((issue) => ({
        path: issue.path.join(".") || "bundle",
        message: issue.message,
      }));
  const referenceIssues = referenceValidation?.issues.slice(0, 4) ?? [];
  const canPublish = canonical !== null;

  const mutate = (change: (next: CruxPortableBundle) => void) => {
    setBundle((current) => {
      const next = structuredClone(current);
      change(next);
      next.generated_at = new Date().toISOString();
      return next;
    });
  };

  const updateUse = (patch: Partial<CruxPortableBundle["ai_uses"][number]>) => {
    if (!selectedUse) return;
    mutate((next) => {
      const use = next.ai_uses.find((item) => item.id === selectedUse.id);
      if (use) Object.assign(use, patch);
    });
  };

  const updateSystem = (patch: Partial<CruxPortableBundle["systems"][number]>) => {
    if (!selectedSystem) return;
    mutate((next) => {
      const system = next.systems.find((item) => item.id === selectedSystem.id);
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

  const openBundle = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parsePortableBundle(JSON.parse(await file.text()) as unknown);
      setBundle(parsed);
      setSelectedUseId(parsed.ai_uses[0]?.id ?? "");
      setLens("working");
      setTab("overview");
      setError(null);
    } catch (caught) {
      setError(formatError(caught));
    }
  };

  const reset = () => {
    const starter = createStarterBundle();
    setBundle(starter);
    setSelectedUseId(starter.ai_uses[0]?.id ?? "");
    setLens("working");
    setTab("edit");
    setError(null);
  };

  const addUse = () => {
    try {
      const result = appendAIUse(bundle);
      setBundle(result.bundle);
      setSelectedUseId(result.aiUseId);
      setLens("working");
      setTab("edit");
      setError(null);
    } catch (caught) {
      setError(formatError(caught));
    }
  };

  const goTo = (nextTab: Tab, useId?: string) => {
    if (useId) setSelectedUseId(useId);
    setLens("working");
    setTab(nextTab);
  };

  const baseName = slug(primaryOrganisation?.name ?? "crux");
  const exportCanonical = () => {
    if (canonical) downloadJson(canonical, `${baseName}-crux.json`);
  };
  const exportDisclosure = (level: "public" | "affected_party") => {
    if (canonical) downloadJson(redactBundle(canonical, level), `${baseName}-crux-${level}.json`);
  };

  return (
    <section className="workbench" aria-label="CRUX pilot workbench">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="btn file-label">
            Open record
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void openBundle(event.target.files?.[0])}
            />
          </label>
          <button className="btn ghost" type="button" onClick={reset}>New record</button>
          <button className="btn primary" type="button" disabled={!canPublish} onClick={exportCanonical}>
            Download record
          </button>
        </div>
        <div className="toolbar-group" aria-label="Disclosure lens">
          {(["working", "public", "affected_party"] as Lens[]).map((item) => (
            <button
              className={`btn ${effectiveLens === item ? "primary" : "ghost"}`}
              type="button"
              key={item}
              disabled={item !== "working" && !canPublish}
              onClick={() => setLens(item)}
            >
              {lensLabel[item]}
            </button>
          ))}
          <details style={{ position: "relative" }}>
            <summary className="btn ghost" style={{ listStyle: "none", cursor: "pointer" }}>Export</summary>
            <div className="card" style={{ position: "absolute", right: 0, top: 42, zIndex: 5, minWidth: 210, padding: 12 }}>
              <button className="btn" style={{ width: "100%", marginBottom: 8 }} type="button" disabled={!canPublish} onClick={() => exportDisclosure("public")}>Export public view</button>
              <button className="btn" style={{ width: "100%" }} type="button" disabled={!canPublish} onClick={() => exportDisclosure("affected_party")}>Export affected-person view</button>
            </div>
          </details>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="CRUX views">
        {([
          ["overview", "Overview"],
          ["evidence", "Evidence"],
          ["outcomes", "Outcomes"],
          ["observed", "System activity"],
          ["edit", "Edit details"],
        ] as Array<[Tab, string]>).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? "active" : ""}`}
            onClick={() => {
              setTab(id);
              if (id === "edit" || id === "observed") setLens("working");
            }}
            role="tab"
            aria-selected={tab === id}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="panel">
        {error ? <div className="error-box" style={{ marginBottom: 18 }}>{error}</div> : null}
        {!canPublish ? (
          <details className="notice" style={{ marginBottom: 18 }}>
            <summary style={{ cursor: "pointer" }}><strong>This working record still needs attention.</strong></summary>
            <div style={{ marginTop: 10 }}>
              {schemaIssues.map((issue) => <div key={`${issue.path}-${issue.message}`}>{issue.path}: {issue.message}</div>)}
              {referenceIssues.map((issue) => <div key={`${issue.path}-${issue.message}`}>{issue.path}: {issue.message}</div>)}
            </div>
          </details>
        ) : null}

        {tab === "overview" ? (
          <div className="grid">
            <article className="card full">
              <div className="kicker">{lensLabel[effectiveLens]}</div>
              <h2>{organisations[0]?.name ?? "Your organisation"}</h2>
              <p className="body-copy muted">{organisations[0]?.description ?? "A record of where AI is used and what role it plays."}</p>
              <div className="pill-row">
                <span className={`pill ${canPublish ? "moss" : "rust"}`}>{canPublish ? "Record complete enough to share" : "Working draft"}</span>
                <span className="pill">{aiUses.length} AI use{aiUses.length === 1 ? "" : "s"}</span>
                <span className="pill">{evidence.length} evidence record{evidence.length === 1 ? "" : "s"}</span>
                <span className="pill">{receiptViews.length} outcome{receiptViews.length === 1 ? "" : "s"}</span>
              </div>
            </article>

            {aiUses.map((use) => {
              const relatedSystems = systems.filter((system) => system.ai_use_refs.includes(use.id));
              return (
                <article className="card wide" key={use.id}>
                  <div className="kicker">AI use</div>
                  <h3>{use.name || "Untitled AI use"}</h3>
                  <p className="body-copy">{use.public_summary || use.purpose || "Purpose not yet described."}</p>
                  <div className="pill-row">
                    {use.consequential ? <span className="pill rust">Can materially affect people</span> : <span className="pill">Assistive / low consequence</span>}
                    {use.people_affected.map((person) => <span className="pill" key={person}>{person}</span>)}
                  </div>
                  {relatedSystems.map((system) => (
                    <div key={system.id}>
                      <div className="divider" />
                      <strong>{system.name}</strong>
                      <div className="small muted" style={{ marginTop: 5 }}>{system.description}</div>
                    </div>
                  ))}
                  {effectiveLens === "working" ? (
                    <div className="pill-row" style={{ marginTop: 18 }}>
                      <button className="btn" type="button" onClick={() => goTo("edit", use.id)}>Edit details</button>
                      <button className="btn" type="button" onClick={() => goTo("evidence", use.id)}>Add evidence</button>
                      {use.consequential ? <button className="btn" type="button" onClick={() => goTo("outcomes", use.id)}>Record an outcome</button> : null}
                    </div>
                  ) : null}
                </article>
              );
            })}

            <article className="card full">
              <div className="kicker">How this use works · {selectedVisibleUse?.name ?? "No visible AI use"}</div>
              <h3>{projectedVersion?.process.name ?? currentVersion?.process.name ?? "No visible process"}</h3>
              {processNodes.length ? (
                <div className="process">
                  {processNodes.map((node, index) => (
                    <div style={{ display: "contents" }} key={node.id}>
                      {index ? <div className="process-arrow" aria-hidden="true">→</div> : null}
                      <div className="process-node">
                        <div className="node-type">{node.type.replaceAll("_", " ")}</div>
                        <strong>{node.name}</strong>
                        {"description" in node && node.description ? <div className="small muted" style={{ marginTop: 7 }}>{node.description}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="empty">No process detail is visible in this view.</div>}
              <AuthoritySummary version={projectedVersion ?? currentVersion} />
            </article>
          </div>
        ) : null}

        {tab === "evidence" ? (
          <div>
            <div className="kicker">Show your workings</div>
            <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 400, margin: "0 0 8px" }}>How do you know?</h2>
            <p className="body-copy muted" style={{ maxWidth: 820 }}>
              CRUX keeps what the organisation says separate from why someone should believe it. Recording evidence does not turn a statement into proof; the source, relationship and limitations remain visible.
            </p>

            {effectiveLens === "working" ? <UsePicker bundle={bundle} selectedUseId={selectedUse?.id ?? ""} onSelect={setSelectedUseId} /> : null}

            <div className="grid" style={{ marginTop: 20 }}>
              <article className="card wide">
                <div className="kicker">What is being claimed?</div>
                {claims.length ? claims.map((claim) => {
                  const linked = bundle.evidence_links.filter(
                    (link) => link.claim_ref === claim.id && (!visibleEvidenceIds || visibleEvidenceIds.has(link.evidence_ref)),
                  );
                  return (
                    <div className="claim" key={claim.id}>
                      <div className={`claim-status ${claim.status}`}>{claim.status}</div>
                      <div>
                        <div className="claim-text">{claim.statement || "Claim not yet complete."}</div>
                        <div className="pill-row"><span className="pill">{linked.length} evidence record{linked.length === 1 ? "" : "s"}</span></div>
                        {claim.reasons.map((reason) => <div className="reason" key={reason}>{reason}</div>)}
                      </div>
                    </div>
                  );
                }) : <div className="empty">No claims are visible in this view.</div>}
              </article>
              <StatCard label="Evidence records" value={evidence.length} note="Visible through this view" />

              <article className="card full">
                <div className="kicker">Evidence already recorded</div>
                {evidence.length ? evidence.map((item) => (
                  <div className="claim" key={item.id}>
                    <div className="claim-status supported">{item.kind.replaceAll("_", " ")}</div>
                    <div>
                      <div className="claim-text">{item.summary}</div>
                      <div className="reason">Recorded from {item.source.kind.replaceAll("_", " ")} · observed {new Date(item.freshness.observed_at).toLocaleDateString("en-GB")}</div>
                      {item.limitations.map((limitation) => <div className="reason" key={limitation}>Limitation: {limitation}</div>)}
                    </div>
                  </div>
                )) : <div className="empty">No evidence has been recorded yet. That is allowed: the statement remains a declaration.</div>}
              </article>

              {effectiveLens === "working" && selectedClaim ? (
                <article className="card full">
                  <div className="kicker">Record evidence</div>
                  <h3>What helps you know whether this statement is true?</h3>
                  <p className="small muted">For: “{selectedClaim.statement}”</p>
                  <div style={{ marginTop: 18 }}>
                    <EvidenceEditor bundle={bundle} claimId={selectedClaim.id} onBundleChange={setBundle} />
                  </div>
                </article>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "outcomes" ? (
          <div>
            <div className="kicker">Specific cases</div>
            <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 400, margin: "0 0 8px" }}>What happened?</h2>
            <p className="body-copy muted" style={{ maxWidth: 820 }}>
              Outcomes record the role AI actually played in a particular case, what happened next and who had final authority. CRUX builds the underlying receipt and trace for you.
            </p>

            {effectiveLens === "working" ? <UsePicker bundle={bundle} selectedUseId={selectedUse?.id ?? ""} onSelect={setSelectedUseId} /> : null}

            <div style={{ marginTop: 22 }}>
              {receiptViews.length ? receiptViews.map((receipt) => (
                <article className="receipt" key={receipt.id}>
                  <div className="kicker">Recorded outcome</div>
                  <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 25, fontWeight: 400, margin: 0 }}>{receipt.outcome}</h3>
                  <dl className="receipt-grid">
                    <div><dt>AI contributed</dt><dd>{receipt.ai_summary}</dd></div>
                    <div><dt>What changed next</dt><dd>{receipt.effect_of_ai}</dd></div>
                    <div><dt>Person involved</dt><dd>{receipt.human_involvement ?? "None recorded"}</dd></div>
                    <div><dt>Final authority</dt><dd>{receipt.final_authority}</dd></div>
                    <div><dt>Challenge route</dt><dd>{receipt.challenge?.available ? receipt.challenge.description ?? receipt.challenge.uri ?? "Available" : "No challenge route recorded"}</dd></div>
                    <div><dt>Source content stored</dt><dd>{receipt.source_content_included ? "Yes" : "No"}</dd></div>
                  </dl>
                </article>
              )) : <div className="empty">No specific outcomes are visible in this view yet.</div>}
            </div>

            {effectiveLens === "working" && selectedVersionRef ? (
              <article className="card full" style={{ marginTop: 22 }}>
                <ReceiptEditor bundle={bundle} systemVersionId={selectedVersionRef} onBundleChange={setBundle} />
              </article>
            ) : null}
          </div>
        ) : null}

        {tab === "observed" ? (
          <div className="grid">
            <article className="card wide">
              <div className="kicker">System-reported activity · working record only</div>
              <h2>What did the system report?</h2>
              <p className="body-copy muted">CRUX can compare bounded runtime metadata with the exact version the organisation described. A difference is something to review, not a trust or safety score.</p>
              <div className="pill-row">
                <span className="pill">Version: {currentVersion?.version ?? "none selected"}</span>
                {observedBehaviour.divergenceCount > 0
                  ? <span className="pill rust">{observedBehaviour.divergenceCount} difference{observedBehaviour.divergenceCount === 1 ? "" : "s"} to review</span>
                  : observedBehaviour.observationCount > 0
                    ? <span className="pill moss">No model/provider difference observed</span>
                    : <span className="pill">No runtime observations</span>}
              </div>
            </article>
            <StatCard label="AI observations" value={observedBehaviour.observationCount} note="For this exact system version" />
            <StatCard label="Comparable" value={observedBehaviour.comparableCount} note="Mapped to a described AI component" />
            <StatCard label="Differences" value={observedBehaviour.divergenceCount} note="Descriptive, not a score" />

            <article className="card full">
              <div className="kicker">Observed model/provider metadata</div>
              {observedBehaviour.comparisons.length ? observedBehaviour.comparisons.map((comparison) => {
                const divergent = comparison.fields.some((field) => field.status === "divergence");
                const incomplete = comparison.fields.some((field) => field.status === "declared_unknown" || field.status === "observed_missing");
                const label = !comparison.comparable ? "not comparable" : divergent ? "difference" : incomplete ? "incomplete" : "match";
                return (
                  <div className="claim" key={comparison.eventRef ?? `${comparison.runRef}-${comparison.occurredAt}`}>
                    <div>
                      <div className="pill-row" style={{ marginTop: 0 }}>
                        <span className={`pill ${divergent ? "rust" : label === "match" ? "moss" : ""}`}>{label}</span>
                        <span className="pill">{comparison.componentName ?? comparison.componentRef ?? "Unmapped model component"}</span>
                      </div>
                      {comparison.fields.map((field) => (
                        <div className="reason" key={field.field}>
                          {field.field === "model_identifier" ? "Model" : "Provider"}: described <strong>{field.declared ?? "unknown"}</strong> · observed <strong>{field.observed ?? "not reported"}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }) : <div className="empty">No bounded runtime observations are recorded for this exact version yet.</div>}
              <div className="notice" style={{ marginTop: 16 }}>System activity does not rewrite the organisation’s description. Differences stay visible until someone reviews them.</div>
            </article>
          </div>
        ) : null}

        {tab === "edit" ? (
          <div className="editor">
            <aside className="editor-nav">
              <div className="kicker">Edit details</div>
              <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400, fontSize: 30, margin: "0 0 12px" }}>Describe the real-world use, not the CRUX model.</h2>
              <p className="small muted">Start with what people need to understand. More technical detail stays optional unless the use can affect people or cause actions.</p>
              <UsePicker bundle={bundle} selectedUseId={selectedUse?.id ?? ""} onSelect={setSelectedUseId} />
              <button className="btn" style={{ marginTop: 10 }} type="button" onClick={addUse}>+ Add another AI use</button>
            </aside>

            <div>
              {primaryOrganisation && selectedUse && selectedSystem ? (
                <>
                  <EditorSection label="Organisation">
                    <Field label="Organisation name" id="organisation-name">
                      <input id="organisation-name" className="input" value={primaryOrganisation.name} onChange={(event) => mutate((next) => { if (next.organisations[0]) next.organisations[0].name = event.target.value; })} />
                    </Field>
                  </EditorSection>

                  <EditorSection label="1 · Where are you using AI?">
                    <Field label="Name this use" id="use-name">
                      <input id="use-name" className="input" value={selectedUse.name} onChange={(event) => updateUse({ name: event.target.value })} />
                    </Field>
                    <Field label="Why do you use AI here?" id="purpose">
                      <textarea id="purpose" className="textarea" value={selectedUse.purpose} onChange={(event) => updateUse({ purpose: event.target.value })} />
                    </Field>
                    <Field label="Explain it simply for someone outside your organisation" id="public-summary">
                      <textarea id="public-summary" className="textarea" value={selectedUse.public_summary ?? ""} onChange={(event) => updateUse({ public_summary: event.target.value })} />
                    </Field>
                    <Field label="Who might be affected? · comma separated" id="people">
                      <input id="people" className="input" value={selectedUse.people_affected.join(", ")} onChange={(event) => updateUse({ people_affected: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
                    </Field>
                  </EditorSection>

                  <EditorSection label="2 · What does it actually do?">
                    <Field label="System or workflow name" id="system-name">
                      <input id="system-name" className="input" value={selectedSystem.name} onChange={(event) => updateSystem({ name: event.target.value })} />
                    </Field>
                    <Field label="What does AI do in the workflow?" id="system-description">
                      <textarea id="system-description" className="textarea" value={selectedSystem.description} onChange={(event) => updateSystem({ description: event.target.value })} />
                    </Field>
                    <label className="checkbox-line">
                      <input type="checkbox" checked={selectedUse.consequential} onChange={(event) => updateUse({ consequential: event.target.checked })} />
                      This use can materially affect a person, service, opportunity or entitlement.
                    </label>
                    <details style={{ marginTop: 16 }}>
                      <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>More about AI influence and ability to act</summary>
                      <div style={{ marginTop: 14 }}>
                        <Field label="How strongly does AI influence the process?" id="influence">
                          <select id="influence" className="select" value={selectedSystem.influence[0] ?? "assistive"} onChange={(event) => updateSystem({ influence: [event.target.value as AIInfluence] })}>
                            {influenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </Field>
                        <Field label="Can AI cause an action?" id="agency">
                          <select id="agency" className="select" value={selectedSystem.agency} onChange={(event) => updateSystem({ agency: event.target.value as AIAgency })}>
                            {agencyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </Field>
                      </div>
                    </details>
                  </EditorSection>

                  {selectedVersionRef && (selectedUse.consequential || selectedSystem.agency !== "none") ? (
                    <EditorSection label="3 · Who decides, and what can happen?">
                      <p className="small muted">Because this use can affect people or cause actions, describe the human authority, decision points, boundaries and challenge route.</p>
                      <AuthorityEditor bundle={bundle} systemVersionId={selectedVersionRef} onBundleChange={setBundle} />
                    </EditorSection>
                  ) : (
                    <div className="notice" style={{ marginBottom: 20 }}>
                      If this is straightforward assistive use with no consequential decision or action, you can keep the record proportionate and stop adding workflow detail here.
                    </div>
                  )}

                  <EditorSection label="4 · What are you saying is true?">
                    {selectedClaim ? (
                      <Field label="Write one statement someone else should be able to inspect" id="claim">
                        <textarea id="claim" className="textarea" value={selectedClaim.statement} onChange={(event) => updateClaim(event.target.value)} />
                      </Field>
                    ) : <div className="notice">This imported use has no directly version-scoped statement. CRUX will not invent one silently.</div>}
                    <div className="notice" style={{ marginTop: 10 }}>This starts as a declaration. Recording evidence is a separate step.</div>
                    <div className="pill-row" style={{ marginTop: 16 }}>
                      {selectedClaim ? <button className="btn primary" type="button" onClick={() => setTab("evidence")}>Record evidence</button> : null}
                      {selectedUse.consequential ? <button className="btn" type="button" onClick={() => setTab("outcomes")}>Record what happened</button> : null}
                    </div>
                  </EditorSection>
                </>
              ) : <div className="empty">This imported record can be inspected, but it does not contain the records required by the simple editor.</div>}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function UsePicker({
  bundle,
  selectedUseId,
  onSelect,
}: {
  bundle: CruxPortableBundle;
  selectedUseId: string;
  onSelect: (id: string) => void;
}) {
  if (bundle.ai_uses.length <= 1) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div className="kicker">AI use</div>
      <div className="pill-row" style={{ alignItems: "stretch" }}>
        {bundle.ai_uses.map((use) => (
          <button key={use.id} type="button" className={`btn ${selectedUseId === use.id ? "primary" : "ghost"}`} onClick={() => onSelect(use.id)}>
            {use.name || "Untitled use"}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <article className="card">
      <div className="kicker">{label}</div>
      <div className="stat">{value}</div>
      <div className="small muted">{note}</div>
    </article>
  );
}

function EditorSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="editor-section">
      <div className="kicker">{label}</div>
      {children}
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
