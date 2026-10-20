"use client";

import { useState } from "react";
import {
  assessPlatformExport, platformSources, plinthAIPatterns, suggestAIUseCandidates,
  type PlatformAssessment, type PlatformSource,
} from "@crux/core";
import type { CruxPortableBundle } from "@crux/formats";
import { DiscoveryOnboarding } from "./discovery-onboarding";

/**
 * Browser-only inspection: the selected export is never POSTed to CRUX.
 * Only aggregate signal categories and counts are passed to onboarding.
 */
export function PlatformDiscoveryExperience({
  onReviewConfirmedUse,
}: { onReviewConfirmedUse?: (bundle: CruxPortableBundle) => void } = {}) {
  const [platform, setPlatform] = useState<PlatformSource>("microsoft-copilot");
  const [plinthPatternId, setPlinthPatternId] = useState<string>("grant-assessment");
  const [assessment, setAssessment] = useState<PlatformAssessment | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const current = platformSources.find((item) => item.id === platform)!;
  const candidates = assessment ? suggestAIUseCandidates(assessment.report) : [];
  const selectedPlinthPattern = plinthAIPatterns.find((item) => item.id === plinthPatternId) ?? plinthAIPatterns[0];

  const load = async (file?: File) => {
    if (!file) return;
    setError("");
    setAssessment(null);
    if (file.size > 2_000_000) {
      setError("Choose a JSON export under 2 MB. Large or sensitive exports should be filtered and redacted locally first.");
      return;
    }
    setLoading(true);
    try {
      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("This first import supports JSON exports only. Convert a CSV to JSON locally after removing personal data.");
      }
      const data: unknown = JSON.parse(await file.text());
      const result = assessPlatformExport({
        platform, data, generatedAt: new Date().toISOString(),
      });
      setAssessment(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this export.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="workbench" style={{ marginTop: 22, marginBottom: 28, padding: "clamp(20px, 4vw, 36px)" }}>
      <div className="eyebrow">Another route · SaaS evidence</div>
      <h2 style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: "clamp(26px, 4vw, 40px)",
        fontWeight: 400,
        margin: "8px 0 12px",
      }}>What if your AI lives in another tool?</h2>
      <p style={{ maxWidth: 760, lineHeight: 1.6, color: "var(--muted)" }}>
        Start with an audit export from a platform you already use. CRUX looks only for
        documented AI activity. A CRM record, spreadsheet or completed automation
        does not, by itself, prove an AI system was involved.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 20 }}>
        <label style={{ display: "grid", gap: 7, fontSize: 12 }}>
          <strong>Choose your platform</strong>
          <select className="input" value={platform} onChange={(event) => {
            setPlatform(event.target.value as PlatformSource);
            setAssessment(null);
            setError("");
          }}>
            {platformSources.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 7, fontSize: 12 }}>
          <strong>Review a local JSON export (up to 2 MB)</strong>
          <input key={platform} className="input" type="file" accept=".json,application/json"
            disabled={loading} onChange={(event) => void load(event.target.files?.[0])}/>
        </label>
      </div>
      {platform === "plinth" && (
        <div style={{
          background: "rgba(64,88,74,.05)", border: "1px solid var(--line)",
          borderRadius: 14, padding: 16, marginTop: 18,
        }}>
          <strong>Plinth serves both grant applicants and funders</strong>
          <p style={{ fontSize: 13, marginTop: 7, marginBottom: 12, color: "var(--muted)" }}>
            These are supplier-described AI features, not evidence that your organisation
            has enabled or used them. Choose a workflow to see what CRUX would need to establish.
          </p>
          <label style={{ display: "grid", gap: 6, fontSize: 12 }}>
            <strong>Which AI workflow are you interested in?</strong>
            <select className="input" value={plinthPatternId} onChange={(event) => setPlinthPatternId(event.target.value)}>
              <optgroup label="Funder-side uses">
                {plinthAIPatterns.filter((item) => item.audience === "funder")
                  .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </optgroup>
              <optgroup label="Charity/applicant-side uses">
                {plinthAIPatterns.filter((item) => item.audience === "charity")
                  .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </optgroup>
            </select>
          </label>
          {selectedPlinthPattern && (
            <div style={{ fontSize: 13, marginTop: 14, lineHeight: 1.6 }}>
              <p><strong>What Plinth describes:</strong> {selectedPlinthPattern.vendor_claim}</p>
              <p><strong>What CRUX should ask:</strong> {selectedPlinthPattern.check}</p>
              <p><strong>Evidence to request:</strong> {selectedPlinthPattern.request}</p>
            </div>
          )}
          <p style={{ fontSize: 12, marginTop: 12, color: "var(--muted)" }}>
            <a href="https://docs.plinth.org.uk/docs/grant-applications" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
              Plinth's grant application API
            </a> includes statuses and funding outcomes, not documented AI execution markers.
            Do not import identifiable applicant data to discover AI usage.
          </p>
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
        <strong>{current.import_label}.</strong> {current.coverage}. The selected file is
        parsed in your browser. CRUX does not upload or retain its raw contents.
        Avoid importing case notes, personal data or unredacted interaction transcripts.
      </p>
      {loading && <p role="status">Inspecting event categories locally…</p>}
      {error && <p role="alert" style={{ color: "var(--rust)" }}>{error}</p>}
      {assessment && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 16 }}>
          <p role="status"><strong>{assessment.ai_events} matching AI activity records</strong>
            {" · "}{assessment.events_inspected} entries inspected
            {" · "}{assessment.evidence_level === "ai_activity"
              ? "AI audit evidence found"
              : "No verified AI-activity pattern found"}
          </p>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>{assessment.explanation} {assessment.next_step}</p>
          <details>
            <summary style={{ cursor: "pointer", fontSize: 12 }}>What CRUX cannot establish from this file</summary>
            <ul style={{ paddingLeft: 20, fontSize: 12, color: "var(--muted)" }}>
              {assessment.report.limitations.map((limitation) =>
                <li key={limitation}>{limitation}</li>)}
            </ul>
          </details>
          {candidates.length > 0 ? (
            <div style={{ marginTop: 18 }}>
              <DiscoveryOnboarding key={platform + assessment.report.generated_at}
                reportData={assessment.report}
                connectionName={current.label}
                connectionMeta="User-supplied export · locally summarised · not a live platform connection"
                initialStage="discover"
                showConnectorChoices={false}
                {...(onReviewConfirmedUse ? { onReviewConfirmedUse } : {})}
              />
            </div>
          ) : (
            <p style={{ borderLeft: "3px solid var(--line)", paddingLeft: 12, marginTop: 16, fontSize: 13 }}>
              No automatic AI-use candidate has been created. You can still
              <a href="/author" style={{ marginLeft: 4, textDecoration: "underline" }}>describe the AI use yourself</a>.
              Unknown is better than presenting ordinary operational records as AI evidence.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
