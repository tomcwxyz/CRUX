"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { CruxPortableBundle } from "@crux/formats";
import type { DisclosureLevel, EvidenceKind, EvidenceRelationship } from "@crux/schemas";
import { evidenceKindOptions, relationshipOptions } from "../lib/labels";
import { availableEvidenceDisclosures } from "../lib/evidence-disclosure";
import { appendManualEvidenceWithSource } from "../lib/manual-evidence";

const disclosureLabels: Record<DisclosureLevel, string> = {
  public: "Public explanation",
  affected_party: "Explanation for someone affected",
  trusted: "Trusted reviewers",
  internal: "Internal only",
};

const relationshipHelp: Record<EvidenceRelationship, string> = {
  supports: "It backs up the statement",
  qualifies: "It's true only with a caveat",
  contradicts: "It points to something different",
  inconclusive: "We still can't tell",
};

export function EvidenceEditor({
  bundle, claimId, onBundleChange,
}: {
  bundle: CruxPortableBundle;
  claimId: string;
  onBundleChange: (bundle: CruxPortableBundle) => void;
}) {
  const [summary, setSummary] = useState("");
  const [relationship, setRelationship] = useState<EvidenceRelationship | "">("");
  const [sourceMode, setSourceMode] = useState<"review" | "record">("review");
  const [sourceUri, setSourceUri] = useState("");
  const [kind, setKind] = useState<EvidenceKind>("human_review");
  const [disclosure, setDisclosure] = useState<DisclosureLevel>("internal");
  const [limitations, setLimitations] = useState("");
  const [error, setError] = useState<string | null>(null);

  const claim = bundle.claims.find((item) => item.id === claimId);
  const allowed = useMemo(() => availableEvidenceDisclosures(bundle, claimId), [bundle, claimId]);
  const selectedDisclosure = allowed.includes(disclosure) ? disclosure : "internal";
  const linked = useMemo(() => {
    const byId = new Map(bundle.evidence.map((item) => [item.id, item]));
    return bundle.evidence_links
      .filter((link) => link.claim_ref === claimId)
      .flatMap((link) => {
        const evidence = byId.get(link.evidence_ref);
        return evidence ? [{ link, evidence }] : [];
      });
  }, [bundle, claimId]);

  const chooseSource = (next: "review" | "record") => {
    setSourceMode(next);
    setKind(next === "review" ? "human_review" : "policy");
    if (next === "review") setSourceUri("");
    setError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!relationship || !summary.trim()) {
      setError("Describe what you found and whether it supports the statement.");
      return;
    }
    try {
      const result = appendManualEvidenceWithSource(bundle, claimId, {
        summary: summary.trim(),
        relationship,
        kind,
        disclosure: selectedDisclosure,
        ...(sourceMode === "record" && sourceUri.trim() ? { sourceUri } : {}),
        limitations: limitations.split("\n").map((item) => item.trim()).filter(Boolean),
      });
      onBundleChange(result.bundle);
      setSummary("");
      setRelationship("");
      setSourceUri("");
      setLimitations("");
      setDisclosure("internal");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record the evidence.");
    }
  };

  return (
    <div>
      <div className="receipt" style={{ padding: 16, marginBottom: 18 }}>
        <div className="kicker">SAYS · What you are checking</div>
        <p className="body-copy" style={{ margin: "8px 0 0" }}>{claim?.statement ?? "Choose a statement first."}</p>
      </div>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor={"evidence-summary-" + claimId}>What did you check or find?</label>
          <textarea
            id={"evidence-summary-" + claimId}
            className="textarea"
            rows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="For example: We checked the workflow and saw that a funding officer must approve a rejection."
          />
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: "20px 0" }}>
          <legend style={{ fontWeight: 750, marginBottom: 12 }}>Does it support what you're saying?</legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(195px,1fr))", gap: 9 }}>
            {relationshipOptions.map((choice) => (
              <label key={choice.value} style={{
                border: "1px solid var(--line)", borderRadius: 12, padding: 12,
                background: relationship === choice.value ? "rgba(64,88,74,.09)" : "rgba(255,255,255,.5)",
                display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer",
              }}>
                <input type="radio" name={"evidence-relationship-" + claimId} value={choice.value}
                  checked={relationship === choice.value}
                  onChange={() => setRelationship(choice.value)} style={{ marginTop: 4, accentColor: "var(--moss)" }} />
                <span><strong style={{ display: "block", fontSize: 14 }}>{choice.label}</strong>
                  <small style={{ display: "block", color: "var(--muted)", lineHeight: 1.4, marginTop: 4 }}>{relationshipHelp[choice.value]}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <details style={{ marginBottom: 18 }}>
          <summary style={{ cursor: "pointer", fontWeight: 750, fontSize: 14 }}>Add source, limitations or sharing details (optional)</summary>
          <div style={{ paddingTop: 14 }}>
            <div className="field">
              <label htmlFor={"evidence-source-kind-" + claimId}>Where does this come from?</label>
              <select id={"evidence-source-kind-" + claimId} className="select" value={sourceMode}
                onChange={(event) => chooseSource(event.target.value as "review" | "record")}>
                <option value="review">Something we checked or reviewed</option>
                <option value="record">A document or other record</option>
              </select>
            </div>
            {sourceMode === "record" ? <div className="field">
              <label htmlFor={"evidence-source-" + claimId}>Link to the source (optional)</label>
              <input id={"evidence-source-" + claimId} type="url" className="input"
                value={sourceUri} onChange={(event) => setSourceUri(event.target.value)}
                placeholder="https://…" />
              <small>CRUX keeps the reference; it does not upload the document.</small>
            </div> : null}
            <div className="field">
              <label htmlFor={"evidence-limitations-" + claimId}>What doesn't this show? (optional)</label>
              <textarea id={"evidence-limitations-" + claimId} className="textarea"
                value={limitations} onChange={(event) => setLimitations(event.target.value)}
                placeholder="For example: Only the current version was checked." rows={2} />
            </div>
            <div className="field">
              <label htmlFor={"evidence-kind-" + claimId}>Type of evidence</label>
              <select id={"evidence-kind-" + claimId} className="select" value={kind}
                onChange={(event) => setKind(event.target.value as EvidenceKind)}>
                {evidenceKindOptions.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={"evidence-disclosure-" + claimId}>Who may see this evidence?</label>
              <select id={"evidence-disclosure-" + claimId} className="select" value={selectedDisclosure}
                onChange={(event) => setDisclosure(event.target.value as DisclosureLevel)}>
                {allowed.map((audience) => <option key={audience} value={audience}>{disclosureLabels[audience]}</option>)}
              </select>
              <small>Internal only by default. Only audiences already allowed to see this AI use and statement are offered.</small>
            </div>
          </div>
        </details>
        <p className="small muted">This is evidence supplied by your organisation, not independently verified by CRUX. Sharing it requires a separate disclosure decision.</p>
        {error ? <div className="error-box" role="alert" style={{ margin: "14px 0" }}>{error}</div> : null}
        <button className="btn primary" type="submit" disabled={!claim || !summary.trim() || !relationship}>Add what we found</button>
      </form>

      {linked.length ? (
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", fontWeight: 750 }}>Evidence already linked ({linked.length})</summary>
          {linked.map(({ link, evidence }) => (
            <div key={link.id} className="receipt" style={{ padding: 16, marginTop: 10 }}>
              <div className="kicker">SHOWS · {link.relationship.replaceAll("_", " ")}</div>
              <p className="body-copy">{evidence.summary}</p>
              <small>{disclosureLabels[evidence.disclosure]} · {evidence.kind.replaceAll("_", " ")}</small>
              {evidence.limitations.map((item) => <p key={item} className="small muted">Limitation: {item}</p>)}
              {evidence.source.source_ref ? <p><a href={evidence.source.source_ref} target="_blank" rel="noreferrer">Open source ↗</a></p> : null}
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
}
