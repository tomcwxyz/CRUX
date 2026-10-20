"use client";

import { useMemo, useRef, useState } from "react";
import {
  assessPlatformExport, buildSaasDiscoveryPlan, platformSources,
  plinthAIPatterns, suggestAIUseCandidates, supplierEvidenceRequest,
  type PlatformAssessment, type PlatformSource, type SaasCoverageState,
} from "@crux/core";
import type { CruxPortableBundle } from "@crux/formats";
import { DiscoveryOnboarding } from "./discovery-onboarding";
import "./platform-discovery-experience.css";

const labels: Record<SaasCoverageState, { label: string; className?: string }> = {
  not_checked: { label: "Not checked" },
  supplier_described: { label: "Supplier says", className: "saas-says" },
  organisation_reported: { label: "You reported" },
  observed_in_export: { label: "Found in export", className: "saas-evidence" },
  no_match_in_export: { label: "No match in sample" },
  access_required: { label: "Access needed" },
};

/** Browser-only discovery: the raw export never leaves this tab. */
export function PlatformDiscoveryExperience({
  onReviewConfirmedUse,
}: { onReviewConfirmedUse?: (bundle: CruxPortableBundle) => void } = {}) {
  const [platform, setPlatform] = useState<PlatformSource>("microsoft-copilot");
  const [usage, setUsage] = useState<"unknown" | "reported_used" | "evaluating">("unknown");
  const [plinthPatternId, setPlinthPatternId] = useState<string>("grant-assessment");
  const [assessment, setAssessment] = useState<PlatformAssessment | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const generation = useRef(0);
  const current = platformSources.find((item) => item.id === platform)!;
  const selectedPlinthPattern = plinthAIPatterns.find((item) => item.id === plinthPatternId) ?? plinthAIPatterns[0];
  const plan = useMemo(() => buildSaasDiscoveryPlan({ platform, usage, assessment }), [platform, usage, assessment]);
  const candidates = useMemo(
    () => assessment ? suggestAIUseCandidates(assessment.report) : [],
    [assessment],
  );
  const evidenceRequest = useMemo(
    () => supplierEvidenceRequest(plan, platform === "plinth" ? selectedPlinthPattern : undefined),
    [plan, platform, selectedPlinthPattern],
  );

  const selectPlatform = (next: PlatformSource) => {
    generation.current++;
    setPlatform(next);
    setUsage("unknown");
    setAssessment(null);
    setError("");
    setNotice("");
    setLoading(false);
    setShowImport(false);
  };

  const readExport = async (file?: File) => {
    if (!file) return;
    const selectedPlatform = platform;
    const task = ++generation.current;
    setError("");
    setNotice("");
    setAssessment(null);
    setLoading(true);
    try {
      if (file.size > 2_000_000) throw new Error("Choose a JSON export under 2 MB; filter or redact sensitive data first.");
      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Only JSON exports are supported in this browser-side prototype.");
      }
      const data: unknown = JSON.parse(await file.text());
      const result = assessPlatformExport({
        platform: selectedPlatform, data, generatedAt: new Date().toISOString(),
      });
      if (task !== generation.current) return;
      setAssessment(result);
    } catch (cause) {
      if (task === generation.current) setError(cause instanceof Error ? cause.message : "Could not read the file.");
    } finally {
      if (task === generation.current) setLoading(false);
    }
  };

  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(evidenceRequest);
      setNotice("Evidence request copied. Review it before sending to the supplier.");
    } catch {
      setNotice("Copy unavailable. Open the text below to select and copy it.");
    }
  };

  const documented = plan.checks.filter((check) => check.state === "supplier_described").length;
  const observed = plan.checks.filter((check) => check.state === "observed_in_export").length;
  const unresolved = plan.checks.filter((check) =>
    ["not_checked", "access_required", "no_match_in_export"].includes(check.state)).length;

  return (
    <section className="workbench saas" aria-label="SaaS AI discovery">
      <div className="eyebrow">Another route · Discover AI in your tools</div>
      <h2>Where does your organisation use AI?</h2>
      <p className="saas-muted" style={{ maxWidth: 790 }}>
        Start with the platform, not a JSON file. CRUX can help identify what a
        supplier offers, what evidence can establish use and what still needs
        checking. Live SaaS connections are not enabled yet; the steps below
        are an evidence-gathering plan, not a claim that we have scanned your account.
      </p>

      <div className="saas-step">
        <div className="saas-step-title">
          <h3>1. Choose a platform</h3>
          <small>Where to investigate</small>
        </div>
        <div className="saas-providers">
          {platformSources.map((source) => (
            <button type="button"
              className={source.id === platform ? "saas-provider selected" : "saas-provider"}
              key={source.id} onClick={() => selectPlatform(source.id)}
              aria-pressed={source.id === platform}>
              <strong>{source.label}</strong>
              <span>{source.id === "plinth" ? "Funders & charities" :
                source.id === "power-automate" ? "Workflows & agents" :
                source.id === "airtable" ? "Bases, automations & AI" : "AI features & audit events"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="saas-step">
        <div className="saas-step-title">
          <h3>2. Does your organisation use {plan.name}?</h3>
          <small>Your answer, not an automatic finding</small>
        </div>
        <div className="saas-usage">
          {([
            ["reported_used", "Yes, we use it"],
            ["evaluating", "We're considering it"],
            ["unknown", "Not sure"],
          ] as const).map(([value, label]) => (
            <button key={value} aria-pressed={usage === value} type="button"
              onClick={() => setUsage(value)}>{label}</button>
          ))}
        </div>
      </div>

      {platform === "plinth" && selectedPlinthPattern && (
        <div className="saas-plinth">
          <strong>Separate applicant-side and funder-side AI workflows</strong>
          <p className="saas-muted">Selecting a workflow explores supplier-described AI features. It does not establish that your organisation has enabled or used them.</p>
          <label htmlFor="saas-plinth-workflow" style={{ fontSize: 12, fontWeight: 700 }}>Workflow to investigate</label>
          <select id="saas-plinth-workflow" value={plinthPatternId} onChange={(event) => setPlinthPatternId(event.target.value)}>
            <optgroup label="Funders">
              {plinthAIPatterns.filter((item) => item.audience === "funder")
                .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </optgroup>
            <optgroup label="Charities and applicants">
              {plinthAIPatterns.filter((item) => item.audience === "charity")
                .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </optgroup>
          </select>
          <p className="saas-muted"><strong>Supplier describes:</strong> {selectedPlinthPattern.vendor_claim}</p>
          <p className="saas-muted"><strong>What CRUX needs to ask:</strong> {selectedPlinthPattern.check}</p>
          <p className="saas-muted"><strong>Evidence to request:</strong> {selectedPlinthPattern.request}</p>
        </div>
      )}

      <div className="saas-step">
        <div className="saas-step-title">
          <h3>3. What do we actually know?</h3>
          <small>SAYS · SHOWS · HAPPENED · UNKNOWN</small>
        </div>
        <div className="saas-ribbon" role="status">
          {plan.evidence_summary}
          {usage === "reported_used" ? " Your indication of use is not independently verified." : ""}
        </div>
        <div className="saas-score">
          <div className="saas-kpi">
            <strong>{documented} / 6</strong>
            <small>Dimensions with supplier-described capabilities, not proof of enablement</small>
          </div>
          <div className="saas-kpi">
            <strong>{observed} / 6</strong>
            <small>Dimensions with matching activity in a local export</small>
          </div>
          <div className="saas-kpi">
            <strong>{unresolved} / 6</strong>
            <small>Not checked, access needed, or no matching event</small>
          </div>
        </div>
        <div className="saas-coverage">
          {plan.checks.map((check) => (
            <div className="saas-check" key={check.dimension}>
              <div className="saas-check-head">
                <strong>{check.title}</strong>
                <span className={"saas-tag " + (labels[check.state].className ?? "")}>
                  {labels[check.state].label}
                </span>
              </div>
              <small>{check.summary}</small>
              <details>
                <summary>Evidence and scope</summary>
                <p>{check.provenance}</p>
                {check.checked_at && <p>Export reviewed: {new Date(check.checked_at).toLocaleString("en-GB")}</p>}
              </details>
            </div>
          ))}
        </div>
        <p className="saas-muted" style={{ marginTop: 12 }}>
          These are evidence states, not scores of AI safety or organisational readiness.
          A missing event never means AI was not used.
        </p>
      </div>

      <div className="saas-step">
        <div className="saas-step-title">
          <h3>4. How could we find out more?</h3>
          <small>Read-only routes and permissions</small>
        </div>
        <p className="saas-muted">
          These are evidence routes, <strong>not active connections</strong>.
          A customer administrator would need to authorise provider access
          when live connectors become available. The local export route already works.
        </p>
        <div className="saas-routes">
          {plan.routes.map((route) => (
            <div className="saas-route" key={route.id}>
              <div className="saas-check-head">
                <strong>{route.label}</strong>
                <span className={"saas-tag " + (route.availability === "available_now" ? "saas-evidence" : "")}>
                  {route.availability === "available_now" ? "Available" :
                    route.availability === "external" ? "Ask / review" : "Not connected"}
                </span>
              </div>
              <p>{route.purpose}</p>
              <details>
                <summary style={{ fontSize: 11, cursor: "pointer" }}>Access and data boundary</summary>
                <small>{route.requested_access}</small>
              </details>
              {route.documentation && (
                <p><a href={route.documentation} target="_blank" rel="noreferrer">Supplier documentation ↗</a></p>
              )}
              {route.id === "export" && (
                <button className="saas-btn" type="button" onClick={() => setShowImport((value) => !value)}
                  aria-expanded={showImport}>{showImport ? "Close local import" : "Review an existing export"}</button>
              )}
              {route.id === "supplier" && (
                <button className="saas-btn" type="button" onClick={() => void copyRequest()}>Copy evidence request</button>
              )}
            </div>
          ))}
        </div>
        {notice && <p className="saas-status" role="status">{notice}</p>}
        <div className="saas-actions" style={{ marginTop: 15 }}>
          <strong style={{ fontSize: 13 }}>Suggested next steps</strong>
          <ol>{plan.next_actions.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12, cursor: "pointer" }}>View or manually copy supplier request</summary>
          <textarea readOnly aria-label="Supplier AI evidence request" rows={12} value={evidenceRequest}
            style={{ display: "block", marginTop: 10, border: "1px solid var(--line)", borderRadius: 10,
              padding: 12, width: "100%", fontSize: 12, background: "var(--chalk)" }}/>
        </details>
      </div>

      {showImport && (
        <div className="saas-file">
          <h3>Optional: inspect an existing {current.import_label}</h3>
          <p className="saas-muted">{current.coverage}. JSON only, up to 2 MB.
            The file is inspected in your browser: prompts, responses,
            source records and personal data are not uploaded to CRUX.</p>
          <label htmlFor="saas-export-file" style={{ display: "block", fontSize: 12, fontWeight: 700 }}>
            Choose a suitably redacted JSON export
          </label>
          <input id="saas-export-file" key={platform + String(assessment?.report.generated_at ?? "")}
            type="file" accept=".json,application/json" disabled={loading}
            onChange={(event) => void readExport(event.target.files?.[0])}/>
          {loading && <p role="status">Checking recognised event categories locally…</p>}
          {error && <p role="alert" className="saas-status">{error}</p>}
          {assessment && (
            <div>
              <p role="status" className="saas-muted">
                <strong>{assessment.ai_events} matching AI events</strong>
                {" · "}{assessment.events_inspected} entries inspected, completeness unverified.
              </p>
              <p className="saas-muted">{assessment.explanation}</p>
              {candidates.length === 0 && (
                <p className="saas-muted">No automatic AI-use candidate created.
                  You can <a href="/author" style={{ textDecoration: "underline" }}>describe a known use yourself</a>.
                  This is not evidence that AI was absent.</p>
              )}
            </div>
          )}
        </div>
      )}
      {assessment && candidates.length > 0 && (
        <div className="saas-step">
          <h3>5. Review the possible AI use</h3>
          <p className="saas-muted">
            These signals came from an unverified local export, not a live SaaS connection.
            Confirm what they mean before CRUX creates an AI-use description.
          </p>
          <DiscoveryOnboarding key={platform + assessment.report.generated_at}
            reportData={assessment.report}
            connectionName={current.label}
            connectionMeta="Local unverified export · aggregate metadata only · not connected to supplier"
            initialStage="discover" showConnectorChoices={false}
            {...(onReviewConfirmedUse ? { onReviewConfirmedUse } : {})}/>
        </div>
      )}
    </section>
  );
}
