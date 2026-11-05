"use client";

import { useMemo, useRef, useState } from "react";
import {
  assessPlatformExport, buildSaasDiscoveryPlan, platformSources,
  suggestAIUseCandidates, supplierEvidenceRequest,
  type PlatformAssessment, type PlatformSource,
} from "@crux/core";
import type { CruxPortableBundle } from "@crux/formats";
import { DiscoveryOnboarding } from "./discovery-onboarding";
import { saveSaasUseStarter } from "../lib/connection-handoff";
import "./platform-discovery-experience.css";

// These are starting questions, NOT findings about the selected organisation.
// Users must confirm which features are actually used.
const possibilities: Partial<Record<PlatformSource, string[]>> = {
  airtable: [
    "AI-generated or summarised field content",
    "AI steps in an automation",
    "AI-assisted categorisation or extraction",
    "An AI agent acting on records",
  ],
  "google-gemini": [
    "Drafting or summarising in Docs or Gmail",
    "Summarising meetings or conversations",
    "Analysing information in Sheets",
    "Gemini-assisted research or content creation",
  ],
};

export function PlatformDiscoveryExperience({
  onReviewConfirmedUse,
}: { onReviewConfirmedUse?: (bundle: CruxPortableBundle) => void } = {}) {
  const [platform, setPlatform] = useState<PlatformSource>("airtable");
  const [usage, setUsage] = useState<"unknown" | "reported_used" | "evaluating">("unknown");
  const [selectedUses, setSelectedUses] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<PlatformAssessment | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const current = platformSources.find((source) => source.id === platform)!;
  const plan = useMemo(
    () => buildSaasDiscoveryPlan({ platform, usage, assessment }),
    [platform, usage, assessment],
  );
  const candidates = useMemo(
    () => assessment ? suggestAIUseCandidates(assessment.report) : [],
    [assessment],
  );
  const examples = possibilities[platform] ?? [
    "Drafting or summarising information",
    "Classifying or analysing records",
    "Recommending a next step",
    "Taking an action through an AI agent",
  ];

  const selectPlatform = (next: PlatformSource) => {
    generation.current++;
    setPlatform(next);
    setSelectedUses([]);
    setUsage("unknown");
    setAssessment(null);
    setError("");
    setNotice("");
    setLoading(false);
  };

  const readExport = async (file?: File) => {
    if (!file) return;
    const task = ++generation.current;
    const selectedPlatform = platform;
    setError("");
    setAssessment(null);
    setLoading(true);
    try {
      if (file.size > 2_000_000) throw new Error("Choose a redacted JSON export under 2 MB.");
      if (!file.name.toLowerCase().endsWith(".json")) throw new Error("Only JSON exports are supported.");
      const result = assessPlatformExport({
        platform: selectedPlatform,
        data: JSON.parse(await file.text()) as unknown,
        generatedAt: new Date().toISOString(),
      });
      if (task === generation.current) setAssessment(result);
    } catch (cause) {
      if (task === generation.current) setError(cause instanceof Error ? cause.message : "Could not read the export.");
    } finally {
      if (task === generation.current) setLoading(false);
    }
  };

  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(supplierEvidenceRequest(plan));
      setNotice("Request copied. Review it before sharing with the supplier.");
    } catch {
      setNotice("Copy unavailable in this browser.");
    }
  };

  return (
    <section className="workbench saas" aria-label="Discover possible AI use in software">
      <div className="eyebrow">Explore AI use in everyday software</div>
      <h2>Find where AI might be used.</h2>
      <p className="saas-muted">
        Choose a tool, review some possible AI uses and describe the ones that matter.
        These are suggestions, not findings about your organisation. No account is connected or scanned.
      </p>

      <div className="saas-step">
        <h3>1. Choose your software</h3>
        <div className="saas-providers">
          {platformSources
            .filter((item) => item.id === "airtable" || item.id === "google-gemini")
            .map((item) => (
              <button key={item.id} type="button" aria-pressed={platform === item.id}
                className={platform === item.id ? "saas-provider selected" : "saas-provider"}
                onClick={() => selectPlatform(item.id)}>
                <strong>{item.id === "google-gemini" ? "Google Workspace" : "Airtable"}</strong>
                <span>{item.id === "google-gemini" ? "Gemini across Workspace" : "AI fields, automations and agents"}</span>
              </button>
            ))}
        </div>
        <details className="saas-secondary">
          <summary>Explore other platforms (early research)</summary>
          <div className="saas-providers">
            {platformSources.filter((item) => item.id !== "airtable" && item.id !== "google-gemini")
              .map((item) => (
                <button key={item.id} type="button" aria-pressed={platform === item.id}
                  className={platform === item.id ? "saas-provider selected" : "saas-provider"}
                  onClick={() => selectPlatform(item.id)}>{item.label}</button>
              ))}
          </div>
        </details>
      </div>

      <div className="saas-step">
        <h3>2. Which of these might be happening?</h3>
        <p className="saas-muted">Select any that you recognise. You can also describe something different.</p>
        <div className="saas-possibilities">
          {examples.map((item) => (
            <label key={item} className="saas-possibility">
              <input type="checkbox" checked={selectedUses.includes(item)}
                onChange={(event) => setSelectedUses((previous) => event.target.checked
                  ? [...previous, item] : previous.filter((value) => value !== item))}/>
              <span>{item}</span>
            </label>
          ))}
        </div>
        <div className="saas-usage" style={{ marginTop: 16 }}>
          <span className="saas-muted">Does your organisation use this software?</span>
          {([
            ["reported_used", "Yes"],
            ["evaluating", "Considering it"],
            ["unknown", "Not sure"],
          ] as const).map(([value, label]) => (
            <button type="button" key={value} aria-pressed={usage === value}
              onClick={() => setUsage(value)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="saas-step">
        <h3>3. Describe an AI use</h3>
        <p className="saas-muted">
          {selectedUses.length
            ? `You selected ${selectedUses.length} possible ${selectedUses.length === 1 ? "use" : "uses"}. They still need your confirmation and description.`
            : "You can begin with an example above or describe a different use."}
          {" "}The next questions focus on purpose, who is affected and who makes decisions.
        </p>
        <div className="saas-start-actions">{(selectedUses.length ? selectedUses : ["Another AI use"]).map((item) => (
          <a key={item} className="btn primary" href="/author" onClick={() => saveSaasUseStarter(current.label, item === "Another AI use" ? "" : item)}>
            {item === "Another AI use" ? "Describe another use" : `Describe: ${item}`}
          </a>
        ))}</div>
        <p className="saas-muted">Your choice will be carried into the description as a starting point, not as verified evidence.</p>
      </div>

      <details className="saas-step saas-secondary">
        <summary>Optional: check the evidence</summary>
        <p className="saas-muted">
          Supplier descriptions are not proof that your organisation has enabled or used a feature.
          You can inspect a suitably redacted export locally, or ask your supplier what they can verify.
        </p>
        <div className="saas-coverage">
          {plan.checks.map((check) => (
            <div className="saas-check" key={check.dimension}>
              <strong>{check.title}</strong>
              <small>{check.summary}</small>
              <details><summary>Where this comes from</summary><p>{check.provenance}</p></details>
            </div>
          ))}
        </div>
        <div className="saas-step">
          <h3>Review an existing export</h3>
          <p className="saas-muted">
            {current.import_label}. JSON only, up to 2 MB. The file stays in this browser tab.
            Do not include personal data, prompts, responses or customer records.
          </p>
          <input type="file" accept=".json,application/json" disabled={loading}
            key={platform} aria-label="Choose a redacted export"
            onChange={(event) => void readExport(event.target.files?.[0])}/>
          {loading && <p role="status">Checking the export locally…</p>}
          {error && <p role="alert">{error}</p>}
          {assessment && (
            <p role="status">
              {assessment.ai_events} recognised AI events in {assessment.events_inspected} inspected entries.
              This is an unverified sample, not a complete account of AI use.
            </p>
          )}
          {assessment && candidates.length > 0 && (
            <DiscoveryOnboarding key={platform + assessment.report.generated_at}
              reportData={assessment.report} connectionName={current.label}
              connectionMeta="User-supplied export · unverified · browser-only"
              initialStage="discover" showConnectorChoices={false}
              {...(onReviewConfirmedUse ? { onReviewConfirmedUse } : {})}/>
          )}
          {assessment && candidates.length === 0 && (
            <p className="saas-muted">No recognised AI event was found. That does not mean AI was not used.</p>
          )}
        </div>
        <button type="button" className="saas-btn" onClick={() => void copyRequest()}>
          Copy questions for the supplier
        </button>
        {notice && <p role="status" className="saas-muted">{notice}</p>}
      </details>
    </section>
  );
}
