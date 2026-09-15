"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { CruxPortableBundle } from "@crux/formats";
import type {
  DisclosureLevel,
  EvidenceKind,
  EvidenceRelationship,
} from "@crux/schemas";
import { appendManualEvidence } from "../lib/authoring";

const evidenceKinds: EvidenceKind[] = [
  "evaluation",
  "system_configuration",
  "production_observation",
  "human_review",
  "audit",
  "assurance",
  "incident",
  "receipt",
  "policy",
  "research",
  "other",
];

const relationships: EvidenceRelationship[] = [
  "supports",
  "qualifies",
  "contradicts",
  "inconclusive",
];

const disclosureLevels: DisclosureLevel[] = [
  "public",
  "affected_party",
  "trusted",
  "internal",
];

export function EvidenceEditor({
  bundle,
  claimId,
  onBundleChange,
}: {
  bundle: CruxPortableBundle;
  claimId: string;
  onBundleChange: (bundle: CruxPortableBundle) => void;
}) {
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = appendManualEvidence(bundle, claimId, {
        summary,
        kind,
        relationship,
        disclosure,
        limitations: limitations
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      onBundleChange(result.bundle);
      setSummary("");
      setLimitations("");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add evidence.");
    }
  };

  return (
    <div>
      {linkedEvidence.length > 0 ? (
        <div style={{ marginBottom: 18 }}>
          {linkedEvidence.map(({ link, evidence }) => (
            <div className="receipt" key={link.id} style={{ padding: 16 }}>
              <div className="kicker">{link.relationship} · {evidence.kind.replaceAll("_", " ")}</div>
              <div className="body-copy">{evidence.summary}</div>
              <div className="pill-row">
                <span className="pill">{evidence.disclosure}</span>
                <span className="pill">Observed {new Date(evidence.freshness.observed_at).toLocaleDateString("en-GB")}</span>
              </div>
              {evidence.limitations.map((limitation) => (
                <div className="reason" key={limitation}>Limitation: {limitation}</div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ marginBottom: 18 }}>
          No evidence linked yet. The claim remains a declaration until evidence is added.
        </div>
      )}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor={`evidence-summary-${claimId}`}>Evidence summary</label>
          <textarea
            id={`evidence-summary-${claimId}`}
            className="textarea"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="What did you observe, test, review or learn?"
          />
        </div>
        <div className="grid">
          <div className="field" style={{ gridColumn: "span 4" }}>
            <label htmlFor={`evidence-kind-${claimId}`}>Kind</label>
            <select id={`evidence-kind-${claimId}`} className="select" value={kind} onChange={(event) => setKind(event.target.value as EvidenceKind)}>
              {evidenceKinds.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: "span 4" }}>
            <label htmlFor={`evidence-relationship-${claimId}`}>Relationship</label>
            <select id={`evidence-relationship-${claimId}`} className="select" value={relationship} onChange={(event) => setRelationship(event.target.value as EvidenceRelationship)}>
              {relationships.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: "span 4" }}>
            <label htmlFor={`evidence-disclosure-${claimId}`}>Disclosure</label>
            <select id={`evidence-disclosure-${claimId}`} className="select" value={disclosure} onChange={(event) => setDisclosure(event.target.value as DisclosureLevel)}>
              {disclosureLevels.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor={`evidence-limitations-${claimId}`}>Limitations · one per line</label>
          <textarea
            id={`evidence-limitations-${claimId}`}
            className="textarea"
            value={limitations}
            onChange={(event) => setLimitations(event.target.value)}
            placeholder="What should someone not conclude from this evidence?"
          />
        </div>
        {error ? <div className="error-box" style={{ marginBottom: 12 }}>{error}</div> : null}
        <button className="btn primary" type="submit">Add evidence</button>
      </form>
    </div>
  );
}
