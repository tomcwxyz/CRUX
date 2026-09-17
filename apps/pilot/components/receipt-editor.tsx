"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CruxPortableBundle } from "@crux/formats";
import type { AIInfluence, Decision, DisclosureLevel } from "@crux/schemas";
import { appendManualReceipt } from "../lib/receipts";
import { PilotQuestions } from "./pilot-questions";

const involvementOptions: Array<{ value: AIInfluence; label: string }> = [
  { value: "assistive", label: "Assisted" },
  { value: "informational", label: "Provided information" },
  { value: "advisory", label: "Advised or recommended" },
  { value: "conditional", label: "Influenced a conditional step" },
  { value: "decisional", label: "Directly contributed to a decision" },
];

const authorityOptions: Array<{ value: Decision["authority"]; label: string }> = [
  { value: "human", label: "A person" },
  { value: "hybrid", label: "A person and an automated rule/system together" },
  { value: "rule", label: "A fixed rule" },
  { value: "ai", label: "The AI system" },
  { value: "external", label: "Someone or something outside this system" },
];

const disclosureOptions: Array<{ value: DisclosureLevel; label: string }> = [
  { value: "affected_party", label: "People affected by the outcome" },
  { value: "trusted", label: "Trusted reviewers" },
  { value: "internal", label: "Internal only" },
];

export function ReceiptEditor({
  bundle,
  systemVersionId,
  onBundleChange,
}: {
  bundle: CruxPortableBundle;
  systemVersionId: string;
  onBundleChange: (bundle: CruxPortableBundle) => void;
}) {
  const version = bundle.system_versions.find((item) => item.id === systemVersionId);
  const system = version ? bundle.systems.find((item) => item.id === version.system_ref) : undefined;
  const defaultDecision = version?.decisions.length === 1 ? version.decisions[0] : undefined;

  const [decisionId, setDecisionId] = useState("");
  const [involvement, setInvolvement] = useState<AIInfluence>(system?.influence[0] ?? "assistive");
  const [aiSummary, setAiSummary] = useState("");
  const [effect, setEffect] = useState("");
  const [humanInvolvement, setHumanInvolvement] = useState("");
  const [finalAuthority, setFinalAuthority] = useState<Decision["authority"]>("human");
  const [outcome, setOutcome] = useState("");
  const [challenge, setChallenge] = useState("");
  const [disclosure, setDisclosure] = useState<DisclosureLevel>("affected_party");
  const [error, setError] = useState<string | null>(null);

  const receipts = useMemo(
    () => bundle.receipts.filter((item) => item.system_version_ref === systemVersionId),
    [bundle.receipts, systemVersionId],
  );

  useEffect(() => {
    setDecisionId(defaultDecision?.id ?? "");
    setInvolvement(defaultDecision?.ai_influence[0] ?? system?.influence[0] ?? "assistive");
    setAiSummary("");
    setEffect("");
    setHumanInvolvement("");
    setFinalAuthority(defaultDecision?.authority ?? "human");
    setOutcome("");
    setChallenge(
      defaultDecision?.challenge?.available && defaultDecision.challenge.description
        ? defaultDecision.challenge.description
        : "",
    );
    setDisclosure("affected_party");
    setError(null);
  }, [systemVersionId]);

  if (!version) {
    return <div className="empty">This system version is not available for outcome recording.</div>;
  }

  const chooseDecision = (value: string) => {
    setDecisionId(value);
    const decision = version.decisions.find((item) => item.id === value);
    if (!decision) {
      setFinalAuthority("human");
      setInvolvement(system?.influence[0] ?? "assistive");
      setChallenge("");
      return;
    }
    setFinalAuthority(decision.authority);
    setInvolvement(decision.ai_influence[0] ?? system?.influence[0] ?? "assistive");
    setChallenge(
      decision.challenge?.available && decision.challenge.description
        ? decision.challenge.description
        : "",
    );
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = appendManualReceipt(bundle, systemVersionId, {
        aiInvolvement: [involvement],
        aiSummary,
        effectOfAI: effect,
        ...(humanInvolvement.trim() ? { humanInvolvement } : {}),
        finalAuthority,
        outcome,
        ...(decisionId ? { decisionId } : {}),
        ...(challenge.trim() ? { challengeDescription: challenge } : {}),
        disclosure,
      });
      onBundleChange(result.bundle);
      setAiSummary("");
      setEffect("");
      setHumanInvolvement("");
      setOutcome("");
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record this outcome.");
    }
  };

  return (
    <div>
      <div className="kicker">Record an outcome</div>
      <h3 style={{ marginTop: 6 }}>What happened in this particular case?</h3>
      <p className="body-copy muted" style={{ maxWidth: 760 }}>
        Describe the real sequence in plain language. CRUX creates the underlying run, events, trace and receipt; you do not need to author those technical records yourself.
      </p>

      {receipts.length ? (
        <div className="notice" style={{ marginBottom: 18 }}>
          {receipts.length} outcome{receipts.length === 1 ? " has" : "s have"} already been recorded for this version.
        </div>
      ) : null}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor={`receipt-ai-${systemVersionId}`}>1. What did AI contribute?</label>
          <textarea
            id={`receipt-ai-${systemVersionId}`}
            className="textarea"
            value={aiSummary}
            onChange={(event) => setAiSummary(event.target.value)}
            placeholder="For example: AI highlighted evidence relevant to an eligibility criterion."
          />
        </div>

        <div className="field">
          <label htmlFor={`receipt-effect-${systemVersionId}`}>2. What happened next because of that contribution?</label>
          <textarea
            id={`receipt-effect-${systemVersionId}`}
            className="textarea"
            value={effect}
            onChange={(event) => setEffect(event.target.value)}
            placeholder="For example: the finding prompted a funding officer to review the original application."
          />
        </div>

        <div className="field">
          <label htmlFor={`receipt-human-${systemVersionId}`}>3. What did a person do?</label>
          <textarea
            id={`receipt-human-${systemVersionId}`}
            className="textarea"
            value={humanInvolvement}
            onChange={(event) => setHumanInvolvement(event.target.value)}
            placeholder="Describe real human review or judgement. Do not imply review if it did not happen."
          />
        </div>

        <div className="field">
          <label htmlFor={`receipt-authority-${systemVersionId}`}>4. Who or what had final authority?</label>
          <select
            id={`receipt-authority-${systemVersionId}`}
            className="select"
            value={finalAuthority}
            onChange={(event) => setFinalAuthority(event.target.value as Decision["authority"])}
          >
            {authorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor={`receipt-outcome-${systemVersionId}`}>5. What was the outcome?</label>
          <textarea
            id={`receipt-outcome-${systemVersionId}`}
            className="textarea"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            placeholder="Describe the result in language a person affected by it could understand."
          />
        </div>

        <div className="field">
          <label htmlFor={`receipt-challenge-${systemVersionId}`}>How could someone question or challenge this outcome? · optional</label>
          <textarea
            id={`receipt-challenge-${systemVersionId}`}
            className="textarea"
            value={challenge}
            onChange={(event) => setChallenge(event.target.value)}
            placeholder="If the process already has a challenge route, CRUX will prefill it where possible."
          />
        </div>

        <details style={{ marginBottom: 18 }}>
          <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>More details</summary>
          <div style={{ marginTop: 14 }}>
            <div className="field">
              <label htmlFor={`receipt-decision-${systemVersionId}`}>Which known decision point does this relate to? · optional</label>
              <select id={`receipt-decision-${systemVersionId}`} className="select" value={decisionId} onChange={(event) => chooseDecision(event.target.value)}>
                <option value="">Not tied to a recorded decision point</option>
                {version.decisions.map((decision) => <option key={decision.id} value={decision.id}>{decision.name}</option>)}
              </select>
            </div>
            <div className="grid">
              <div className="field" style={{ gridColumn: "span 6" }}>
                <label htmlFor={`receipt-involvement-${systemVersionId}`}>How was AI involved?</label>
                <select id={`receipt-involvement-${systemVersionId}`} className="select" value={involvement} onChange={(event) => setInvolvement(event.target.value as AIInfluence)}>
                  {involvementOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: "span 6" }}>
                <label htmlFor={`receipt-disclosure-${systemVersionId}`}>Who can see this outcome?</label>
                <select id={`receipt-disclosure-${systemVersionId}`} className="select" value={disclosure} onChange={(event) => setDisclosure(event.target.value as DisclosureLevel)}>
                  {disclosureOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </details>

        <details style={{ marginBottom: 18 }}>
          <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>What should this outcome record help someone understand?</summary>
          <div style={{ marginTop: 14 }}><PilotQuestions bundle={bundle} systemVersionId={systemVersionId} /></div>
        </details>

        <div className="notice" style={{ marginBottom: 14 }}>
          CRUX stores metadata about the role AI played and what happened next. It does not copy source material, prompts or model output into this outcome record.
        </div>
        {error ? <div className="error-box" style={{ marginBottom: 12 }}>{error}</div> : null}
        <button className="btn primary" type="submit">Record outcome</button>
      </form>
    </div>
  );
}
