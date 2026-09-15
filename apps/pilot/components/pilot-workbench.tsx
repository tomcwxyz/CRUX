"use client";

import { useMemo, useState } from "react";
import {
  inspectBundle,
  parsePortableBundle,
  redactBundle,
  validateBundleReferences,
  type CruxPortableBundle,
} from "@crux/formats";
import type { AIAgency, AIInfluence } from "@crux/schemas";
import { createStarterBundle } from "../lib/starter";

type Tab = "overview" | "claims" | "receipts" | "edit";
type Lens = "working" | "public" | "affected_party";

type ReceiptView = {
  id: string;
  occurred_at: string;
  ai_involvement: string[];
  ai_summary: string;
  effect_of_ai: string;
  human_involvement?: string;
  final_authority: string;
  outcome: string;
  challenge?: { available: boolean; description?: string; uri?: string };
  source_content_included: boolean;
};

const lensLabel: Record<Lens, string> = {
  working: "Working record",
  public: "Public",
  affected_party: "Affected person",
};

const influenceOptions: AIInfluence[] = [
  "assistive",
  "informational",
  "advisory",
  "conditional",
  "decisional",
];

const agencyOptions: AIAgency[] = [
  "none",
  "proposes_action",
  "human_approval_required",
  "automatic_bounded",
  "autonomous_bounded",
];

const recordId = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null || !("id" in value)) return undefined;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
};

const idsFrom = (values: unknown[]) =>
  new Set(values.map(recordId).filter((id): id is string => id !== undefined));

const formatError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "That file could not be opened as a CRUX bundle.";
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "crux";

const downloadJson = (value: unknown, filename: string) => {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function PilotWorkbench() {
  const [bundle, setBundle] = useState<CruxPortableBundle>(() => createStarterBundle());
  const [tab, setTab] = useState<Tab>("overview");
  const [lens, setLens] = useState<Lens>("working");
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => validateBundleReferences(bundle), [bundle]);
  const inspection = useMemo(() => inspectBundle(bundle), [bundle]);
  const projection = useMemo(
    () => (lens === "working" ? null : redactBundle(bundle, lens)),
    [bundle, lens],
  );

  const visibleOrganisationIds = projection ? idsFrom(projection.organisations) : null;
  const visibleUseIds = projection ? idsFrom(projection.ai_uses) : null;
  const visibleSystemIds = projection ? idsFrom(projection.systems) : null;
  const visibleVersionIds = projection ? idsFrom(projection.system_versions) : null;
  const visibleClaimIds = projection ? idsFrom(projection.claims) : null;
  const visibleEvidenceIds = projection ? idsFrom(projection.evidence) : null;

  const organisations = bundle.organisations.filter(
    (item) => !visibleOrganisationIds || visibleOrganisationIds.has(item.id),
  );
  const aiUses = bundle.ai_uses.filter((item) => !visibleUseIds || visibleUseIds.has(item.id));
  const systems = bundle.systems.filter(
    (item) => !visibleSystemIds || visibleSystemIds.has(item.id),
  );
  const versions = bundle.system_versions.filter(
    (item) => !visibleVersionIds || visibleVersionIds.has(item.id),
  );
  const claims = inspection.claim_statuses.filter(
    (item) => !visibleClaimIds || visibleClaimIds.has(item.id),
  );
  const evidence = bundle.evidence.filter(
    (item) => !visibleEvidenceIds || visibleEvidenceIds.has(item.id),
  );

  const receiptViews: ReceiptView[] = lens === "working"
    ? bundle.receipts.map((receipt) => ({
        id: receipt.id,
        occurred_at: receipt.occurred_at,
        ai_involvement: receipt.ai_involvement,
        ai_summary: receipt.ai_summary,
        effect_of_ai: receipt.effect_of_ai,
        ...(receipt.human_involvement ? { human_involvement: receipt.human_involvement } : {}),
        final_authority: receipt.final_authority,
        outcome: receipt.outcome,
        ...(receipt.challenge ? { challenge: receipt.challenge } : {}),
        source_content_included: receipt.source_content_included,
      }))
    : (projection?.trace_views.flatMap((view) => (view.receipt ? [view.receipt] : [])) ?? []);

  const primaryOrganisation = bundle.organisations[0];
  const primaryUse = bundle.ai_uses[0];
  const primarySystem = bundle.systems[0];
  const primaryClaim = bundle.claims[0];

  const currentVersion = versions.find((version) =>
    systems.some((system) => system.current_version_ref === version.id),
  ) ?? versions[0];
  const projectedVersion = projection?.system_versions.find(
    (version) => version.id === currentVersion?.id,
  );
  const processNodes = projectedVersion?.process.nodes ?? currentVersion?.process.nodes ?? [];

  const touch = (next: CruxPortableBundle) => ({
    ...next,
    generated_at: new Date().toISOString(),
  });

  const updateOrganisation = (name: string) => {
    if (!primaryOrganisation) return;
    setBundle((current) => {
      const next = structuredClone(current);
      if (next.organisations[0]) next.organisations[0].name = name;
      return touch(next);
    });
  };

  const updateUse = (patch: Partial<CruxPortableBundle["ai_uses"][number]>) => {
    if (!primaryUse) return;
    setBundle((current) => {
      const next = structuredClone(current);
      if (next.ai_uses[0]) Object.assign(next.ai_uses[0], patch);
      return touch(next);
    });
  };

  const updateSystem = (patch: Partial<CruxPortableBundle["systems"][number]>) => {
    if (!primarySystem) return;
    setBundle((current) => {
      const next = structuredClone(current);
      if (next.systems[0]) Object.assign(next.systems[0], patch);
      return touch(next);
    });
  };

  const updateClaim = (statement: string) => {
    if (!primaryClaim) return;
    setBundle((current) => {
      const next = structuredClone(current);
      if (next.claims[0]) next.claims[0].statement = statement;
      return touch(next);
    });
  };

  const openBundle = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parsePortableBundle(JSON.parse(await file.text()) as unknown);
      setBundle(parsed);
      setLens("working");
      setTab("overview");
      setError(null);
    } catch (caught) {
      setError(formatError(caught));
    }
  };

  const reset = () => {
    setBundle(createStarterBundle());
    setLens("working");
    setTab("edit");
    setError(null);
  };

  const exportCanonical = () => {
    const name = slug(primaryOrganisation?.name ?? "crux");
    downloadJson(bundle, `${name}-crux.json`);
  };

  const exportDisclosure = (level: "public" | "affected_party") => {
    const name = slug(primaryOrganisation?.name ?? "crux");
    downloadJson(redactBundle(bundle, level), `${name}-crux-${level}.json`);
  };

  return (
    <section className="workbench" aria-label="CRUX pilot workbench">
      <div className="toolbar">
        <div className="toolbar-group">
          <label className="btn file-label">
            Open bundle
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void openBundle(event.target.files?.[0])}
            />
          </label>
          <button className="btn ghost" type="button" onClick={reset}>New</button>
          <button className="btn primary" type="button" onClick={exportCanonical}>
            Download bundle
          </button>
          <button className="btn" type="button" onClick={() => exportDisclosure("public")}>
            Export public
          </button>
          <button className="btn" type="button" onClick={() => exportDisclosure("affected_party")}>
            Export affected
          </button>
        </div>
        <div className="toolbar-group" aria-label="Disclosure lens">
          {(["working", "public", "affected_party"] as Lens[]).map((item) => (
            <button
              className={`btn ${lens === item ? "primary" : "ghost"}`}
              type="button"
              key={item}
              onClick={() => setLens(item)}
            >
              {lensLabel[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="CRUX views">
        {([
          ["overview", "Overview"],
          ["claims", "Claims & evidence"],
          ["receipts", "Receipts"],
          ["edit", "Guided edit"],
        ] as Array<[Tab, string]>).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
            role="tab"
            aria-selected={tab === id}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="panel">
        {error ? <div className="error-box" style={{ marginBottom: 18 }}>{error}</div> : null}

        {tab === "overview" ? (
          <div className="grid">
            <article className="card wide">
              <div className="kicker">Organisation</div>
              <h2>{organisations[0]?.name ?? "Not disclosed"}</h2>
              <p className="body-copy muted">
                {organisations[0]?.description ?? "No organisation description is visible in this disclosure."}
              </p>
              <div className="pill-row">
                <span className="pill moss">{lensLabel[lens]}</span>
                <span className="pill">{validation.valid ? "Valid bundle" : `${validation.issues.length} reference issue(s)`}</span>
              </div>
            </article>

            <article className="card">
              <div className="kicker">AI uses</div>
              <div className="stat">{aiUses.length}</div>
              <div className="small muted">{aiUses.filter((use) => use.consequential).length} marked consequential</div>
            </article>

            <article className="card">
              <div className="kicker">Claims</div>
              <div className="stat">{claims.length}</div>
              <div className="small muted">{claims.filter((claim) => claim.status === "supported").length} currently supported</div>
            </article>

            <article className="card">
              <div className="kicker">Evidence</div>
              <div className="stat">{evidence.length}</div>
              <div className="small muted">Evidence is shown separately from organisational assertions.</div>
            </article>

            {aiUses.map((use) => {
              const related = systems.filter((system) => system.ai_use_refs.includes(use.id));
              return (
                <article className="card wide" key={use.id}>
                  <div className="kicker">AI use</div>
                  <h3>{use.name}</h3>
                  <p className="body-copy">{use.public_summary ?? use.purpose}</p>
                  <div className="pill-row">
                    {use.consequential ? <span className="pill rust">Consequential</span> : <span className="pill">Not marked consequential</span>}
                    {use.people_affected.map((person) => <span className="pill" key={person}>{person}</span>)}
                  </div>
                  {related.map((system) => (
                    <div key={system.id}>
                      <div className="divider" />
                      <div className="kicker">System</div>
                      <h3>{system.name}</h3>
                      <p className="small muted">{system.description}</p>
                      <div className="pill-row">
                        {system.influence.map((value) => <span className="pill" key={value}>Influence: {value}</span>)}
                        <span className="pill">Agency: {system.agency.replaceAll("_", " ")}</span>
                      </div>
                    </div>
                  ))}
                </article>
              );
            })}

            <article className="card full">
              <div className="kicker">How the current process works</div>
              <h3>{projectedVersion?.process.name ?? currentVersion?.process.name ?? "No visible process"}</h3>
              {processNodes.length > 0 ? (
                <div className="process">
                  {processNodes.map((node, index) => (
                    <div style={{ display: "contents" }} key={node.id}>
                      {index > 0 ? <div className="process-arrow" aria-hidden="true">→</div> : null}
                      <div className="process-node">
                        <div className="node-type">{node.type.replaceAll("_", " ")}</div>
                        <strong>{node.name}</strong>
                        {"description" in node && node.description ? <div className="small muted" style={{ marginTop: 7 }}>{node.description}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="empty">No process detail is visible in this disclosure.</div>}
            </article>
          </div>
        ) : null}

        {tab === "claims" ? (
          <div className="grid">
            <article className="card wide">
              <div className="kicker">Claims are not facts by default</div>
              <h2>What are we saying is true?</h2>
              <p className="body-copy muted">CRUX keeps the organisation's statement separate from the evidence that supports, qualifies or challenges it.</p>
              <div className="divider" />
              {claims.length > 0 ? claims.map((claim) => {
                const links = bundle.evidence_links.filter((link) => link.claim_ref === claim.id && (!visibleEvidenceIds || visibleEvidenceIds.has(link.evidence_ref)));
                return (
                  <div className="claim" key={claim.id}>
                    <div className={`claim-status ${claim.status}`}>{claim.status}</div>
                    <div>
                      <div className="claim-text">{claim.statement}</div>
                      {claim.reasons.map((reason) => <div className="reason" key={reason}>{reason}</div>)}
                      <div className="pill-row">
                        <span className="pill">{links.length} linked evidence record{links.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  </div>
                );
              }) : <div className="empty">No claims are visible in this disclosure.</div>}
            </article>

            <article className="card">
              <div className="kicker">Evidence ledger</div>
              <div className="stat">{evidence.length}</div>
              <p className="small muted">Current evidence visible through this disclosure lens.</p>
            </article>

            <article className="card full">
              <div className="kicker">Evidence records</div>
              {evidence.length > 0 ? evidence.map((item) => (
                <div className="claim" key={item.id}>
                  <div className="claim-status supported">{item.kind.replaceAll("_", " ")}</div>
                  <div>
                    <div className="claim-text">{item.summary}</div>
                    <div className="reason">Observed {new Date(item.freshness.observed_at).toLocaleDateString("en-GB")}</div>
                    {item.limitations.map((limitation) => <div className="reason" key={limitation}>Limitation: {limitation}</div>)}
                  </div>
                </div>
              )) : <div className="empty">Nothing here yet. A declaration can be useful, but CRUX should make it obvious when evidence is still missing.</div>}
            </article>
          </div>
        ) : null}

        {tab === "receipts" ? (
          <div>
            <div className="kicker">Specific outcomes</div>
            <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 400, margin: "0 0 8px" }}>What happened here?</h2>
            <p className="body-copy muted" style={{ maxWidth: 760 }}>Receipts explain AI contribution, subsequent effect and final authority without requiring raw sensitive content.</p>
            <div style={{ marginTop: 24 }}>
              {receiptViews.length > 0 ? receiptViews.map((receipt) => (
                <article className="receipt" key={receipt.id}>
                  <div className="kicker">{receipt.id}</div>
                  <h3 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 25, fontWeight: 400, margin: 0 }}>{receipt.outcome}</h3>
                  <dl className="receipt-grid">
                    <div><dt>AI did</dt><dd>{receipt.ai_summary}</dd></div>
                    <div><dt>Effect</dt><dd>{receipt.effect_of_ai}</dd></div>
                    <div><dt>Human involvement</dt><dd>{receipt.human_involvement ?? "None recorded"}</dd></div>
                    <div><dt>Final authority</dt><dd>{receipt.final_authority}</dd></div>
                    <div><dt>Challenge route</dt><dd>{receipt.challenge?.available ? receipt.challenge.description ?? receipt.challenge.uri ?? "Available" : "No challenge route recorded"}</dd></div>
                    <div><dt>Raw source content</dt><dd>{receipt.source_content_included ? "Included" : "Not included"}</dd></div>
                  </dl>
                </article>
              )) : <div className="empty">No receipts are visible through this disclosure lens.</div>}
            </div>
          </div>
        ) : null}

        {tab === "edit" ? (
          <div className="editor">
            <aside className="editor-nav">
              <div className="kicker">Pilot authoring</div>
              <h2 style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400, fontSize: 30, margin: "0 0 12px" }}>Start with the organisational story.</h2>
              <p className="small muted">This intentionally edits only the primary organisation, AI use, system and claim. The pilot should tell us what richer authoring genuinely needs.</p>
              <div className="notice" style={{ marginTop: 18 }}>The JSON bundle remains canonical. CRUX does not save this anywhere unless you download it.</div>
            </aside>

            <div>
              {primaryOrganisation && primaryUse && primarySystem && primaryClaim ? (
                <>
                  <div className="editor-section">
                    <div className="kicker">1 · Who is being transparent?</div>
                    <div className="field">
                      <label htmlFor="organisation-name">Organisation name</label>
                      <input id="organisation-name" className="input" value={primaryOrganisation.name} onChange={(event) => updateOrganisation(event.target.value)} />
                    </div>
                  </div>

                  <div className="editor-section">
                    <div className="kicker">2 · Where is AI used?</div>
                    <div className="field">
                      <label htmlFor="use-name">Name this use of AI</label>
                      <input id="use-name" className="input" value={primaryUse.name} onChange={(event) => updateUse({ name: event.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor="purpose">Purpose</label>
                      <textarea id="purpose" className="textarea" value={primaryUse.purpose} onChange={(event) => updateUse({ purpose: event.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor="public-summary">Plain-language public summary</label>
                      <textarea id="public-summary" className="textarea" value={primaryUse.public_summary ?? ""} onChange={(event) => updateUse({ public_summary: event.target.value || undefined })} />
                    </div>
                    <div className="field">
                      <label htmlFor="people">People affected · comma separated</label>
                      <input id="people" className="input" value={primaryUse.people_affected.join(", ")} onChange={(event) => updateUse({ people_affected: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
                    </div>
                    <label className="checkbox-line">
                      <input type="checkbox" checked={primaryUse.consequential} onChange={(event) => updateUse({ consequential: event.target.checked })} />
                      This can materially affect a person, service, opportunity or entitlement.
                    </label>
                  </div>

                  <div className="editor-section">
                    <div className="kicker">3 · What role does AI have?</div>
                    <div className="field">
                      <label htmlFor="system-name">System or workflow name</label>
                      <input id="system-name" className="input" value={primarySystem.name} onChange={(event) => updateSystem({ name: event.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor="system-description">What does the system do?</label>
                      <textarea id="system-description" className="textarea" value={primarySystem.description} onChange={(event) => updateSystem({ description: event.target.value })} />
                    </div>
                    <div className="field">
                      <label htmlFor="influence">Highest AI influence in this system</label>
                      <select id="influence" className="select" value={primarySystem.influence[0] ?? "assistive"} onChange={(event) => updateSystem({ influence: [event.target.value as AIInfluence] })}>
                        {influenceOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="agency">AI agency</label>
                      <select id="agency" className="select" value={primarySystem.agency} onChange={(event) => updateSystem({ agency: event.target.value as AIAgency })}>
                        {agencyOptions.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="editor-section">
                    <div className="kicker">4 · What are you claiming?</div>
                    <div className="field">
                      <label htmlFor="claim">A statement someone else should be able to inspect</label>
                      <textarea id="claim" className="textarea" value={primaryClaim.statement} onChange={(event) => updateClaim(event.target.value)} />
                    </div>
                    <div className="notice">This starts as <strong>declared</strong>, not supported. Add evidence in the bundle when you have something that genuinely supports, qualifies or contradicts it.</div>
                  </div>
                </>
              ) : <div className="empty">This imported bundle does not contain the primary records required by the thin pilot editor. You can still inspect and export it.</div>}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
