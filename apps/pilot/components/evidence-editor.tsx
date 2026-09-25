"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { CruxPortableBundle } from "@crux/formats";
import type {
  DisclosureLevel,
  EvidenceKind,
  EvidenceRelationship,
} from "@crux/schemas";
import { evidenceKindOptions } from "../lib/labels";
import { appendManualEvidenceWithSource } from "../lib/manual-evidence";

const relationshipOptions: Array<{ value: EvidenceRelationship; label: string }> = [
  { value: "supports", label: "Supports the statement" },
  { value: "qualifies", label: "Adds an important caveat" },
  { value: "contradicts", label: "Challenges the statement" },
  { value: "inconclusive", label: "Does not settle it" },
];

const disclosureOptions: Array<{ value: DisclosureLevel; label: string }> = [
  { value: "public", label: "Public" },
  { value: "affected_party", label: "People affected by this use" },
  { value: "trusted", label: "Trusted reviewers" },
  { value: "internal", label: "Internal only" },
];

type ManualSource = "review" | "record";

export function EvidenceEditor({
  bundle,
  claimId,
  onBundleChange,
}: {
  bundle: CruxPortableBundle;
  claimId: string;
  onBundleChange: (bundle: CruxPortableBundle) => void;
}) {
  const [sourceMode, setSourceMode] = useState<ManualSource>("review");
  const [sourceUri, setSourceUri] = useState("");
  const [summary, setSummary] = useState("");
  const [kind, setKind] = useState<EvidenceKind>("human_review");
  const [relationship, setRelationship] = useState<EvidenceRelationship>("supports");
  const [disclosure, setDisclosure] = useState<DisclosureLevel>("public");
  const [limitations, setLimitations] = useState("");
  const [error, setError] = useState<string | null>(null);

  const linkedEvidence = useMemo(() => {
    const evidenceById = new Map(bundle.evidence.map((item) => [item.id, item]));
    return bundle.evidence_links
      .filter((link) => link.claim_ref === claimId)
      .flatMap((link) => {
        const evidence = evidenceById.get(link.evidence_ref);
        return evidence ? [{ link, evidence }] : [];
      });
  }, [bundle, claimId]);

  const chooseSourceMode = (mode: ManualSource) => {
    setSourceMode(mode);
    setKind(mode === "review" ? "human_review" : "policy");
    if (mode === "review") setSourceUri("");
    setError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = appendManualEvidenceWithSource(bundle, claimId, {
        summary,
        kind,
        relationship,
        disclosure,
        ...(sourceMode === "record" && sourceUri.trim() ? { sourceUri } : {}),
        limitations: limitations
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      onBundleChange(result.bundle);
      setSummary("");
      setSourceUri("");
      setLimitations("");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record evidence.");
    }
  };

  return (
    <div>
      {linkedEvidence.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          {linkedEvidence.map(({ link, evidence }) => (
            <div className="receipt" key={link.id} style={{ padding: 16 }}>
              <div className="kicker">{link.relationship.replaceAll("_", " ")} · {evidence.kind.replaceAll("_", " ")}</div>
              <div className="body-copy">{evidence.summary}</div>
              <div className="pill-row">
                <span className="pill">{evidence.source.kind.replaceAll("_", " ")}</span>
                <span className="pill">{evidence.disclosure.replaceAll("_", " ")}</span>
                <span className="pill">Observed {new Date(evidence.freshness.observed_at).toLocaleDateString("en-GB")}</span>
              </div>
              {evidence.source.source_ref ? (
                <div className="reason">Source: <a href={evidence.source.source_ref} target="_blank" rel="noreferrer">{evidence.source.source_ref}</a></div>
              ) : null}
              {evidence.limitations.map((limitation) => (
                <div className="reason" key={limitation}>Limitation: {limitation}</div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ marginBottom: 20 }}>
          Nothing has been recorded for this statement yet. It remains an organisational declaration.
        </div>
      )}

      <div className="kicker">Where does this evidence come from?</div>
      <div className="grid" style={{ marginTop: 10, marginBottom: 18 }}>
        <button
          type="button"
          className={`card ${sourceMode === "review" ? "selected" : ""}`}
          style={{ textAlign: "left", cursor: "pointer", gridColumn: "span 6" }}
          onClick={() => chooseSourceMode("review")}
        >
          <strong>Something we checked or reviewed</strong>
          <div className="small muted" style={{ marginTop: 6 }}>For example: staff reviewed a process, configuration, sample or decision.</div>
        </button>
        <button
          type="button"
          className={`card ${sourceMode === "record" ? "selected" : ""}`}
          style={{ textAlign: "left", cursor: "pointer", gridColumn: "span 6" }}
          onClick={() => chooseSourceMode("record")}
        >
          <strong>A document or organisational record</strong>
          <div className="small muted" style={{ marginTop: 6 }}>For example: an audit, policy, evaluation, test result or research record.</div>
        </button>
      </div>

      <form onSubmit={submit}>
        {sourceMode === "record" ? (
          <div className="field">
            <label htmlFor={`evidence-source-${claimId}`}>Link to the source · optional</label>
            <input
              id={`evidence-source-${claimId}`}
              className="input"
              type="url"
              value={sourceUri}
              onChange={(event) => setSourceUri(event.target.value)}
              placeholder="https://…"
            />
            <div className="small muted" style={{ marginTop: 6 }}>CRUX stores the reference, not a copy of the document.</div>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor={`evidence-summary-${claimId}`}>
            {sourceMode === "review" ? "What did you check, and what did you find?" : "What does the record show?"}
          </label>
          <textarea
            id={`evidence-summary-${claimId}`}
            className="textarea"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={sourceMode === "review"
              ? "For example: We reviewed the live workflow and confirmed a person must approve every rejection."
              : "For example: The September assurance review found no automated rejection action in the deployed configuration."}
          />
        </div>

        <div className="field">
          <label htmlFor={`evidence-relationship-${claimId}`}>What does this evidence do to the statement?</label>
          <select
            id={`evidence-relationship-${claimId}`}
            className="select"
            value={relationship}
            onChange={(event) => setRelationship(event.target.value as EvidenceRelationship)}
          >
            {relationshipOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`evidence-limitations-${claimId}`}>What should someone not conclude from this? · optional</label>
          <textarea
            id={`evidence-limitations-${claimId}`}
            className="textarea"
            value={limitations}
            onChange={(event) => setLimitations(event.target.value)}
            placeholder="One limitation per line. For example: This review covered the current configuration only."
          />
        </div>

        <details style={{ marginBottom: 18 }}>
          <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>More options</summary>
          <div className="grid" style={{ marginTop: 14 }}>
            <div className="field" style={{ gridColumn: "span 6" }}>
              <label htmlFor={`evidence-kind-${claimId}`}>Evidence type</label>
              <select id={`evidence-kind-${claimId}`} className="select" value={kind} onChange={(event) => setKind(event.target.value as EvidenceKind)}>
                {evidenceKindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ gridColumn: "span 6" }}>
              <label htmlFor={`evidence-disclosure-${claimId}`}>Who can see it?</label>
              <select id={`evidence-disclosure-${claimId}`} className="select" value={disclosure} onChange={(event) => setDisclosure(event.target.value as DisclosureLevel)}>
                {disclosureOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
        </details>

        <div className="notice" style={{ marginBottom: 14 }}>
          Manual evidence is recorded as organisation-provided evidence. Runtime observations, evaluations and other integrations should be ingested directly when available rather than retyped here.
        </div>
        {error ? <div className="error-box" style={{ marginBottom: 12 }}>{error}</div> : null}
        <button className="btn primary" type="submit">Record evidence</button>
      </form>
    </div>
  );
}
