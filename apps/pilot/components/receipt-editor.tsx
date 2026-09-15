"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CruxPortableBundle } from "@crux/formats";
import type { AIInfluence, Decision, DisclosureLevel } from "@crux/schemas";
import { appendManualReceipt } from "../lib/receipts";
import { PilotQuestions } from "./pilot-questions";

const involvementOptions: AIInfluence[] = [
  "assistive",
  "informational",
  "advisory",
  "conditional",
  "decisional",
];

const authorityOptions: Decision["authority"][] = [
  "human",
  "rule",
  "ai",
  "hybrid",
  "external",
];

const disclosureOptions: DisclosureLevel[] = ["affected_party", "trusted", "internal"];

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
    setDecisionId("");
    setInvolvement(system?.influence[0] ?? "assistive");
    setAiSummary("");
    setEffect("");
    setHumanInvolvement("");
    setFinalAuthority("human");
    setOutcome("");
    setChallenge("");
    setDisclosure("affected_party");
    setError(null);
  }, [systemVersionId]);

  if (!version) {
    return <div className="empty">This system version is not available for receipt authoring.</div>;
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
    if (decision.ai_influence[0]) setInvolvement(decision.ai_influence[0]);
    else setInvolvement(system?.influence[0] ?? "assistive");
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
      setError(caught instanceof Error ? caught.message : "Could not add receipt.");
    }
  };

  return (
    <div>
      <PilotQuestions bundle={bundle} systemVersionId={systemVersionId} />

      <div className="notice" style={{ marginBottom: 16 }}>
        Receipt authoring is metadata-first. CRUX records the role AI played and what happened next; it does not copy the source material, prompt or model output into the receipt.
      </div>

      {receipts.length ? (
        <div style={{ marginBottom: 18 }}>
          {receipts.map((receipt) => (
            <div className="receipt" key={receipt.id} style={{ padding: 16 }}>
              <div className="kicker">{receipt.id}</div>
              <div className="claim-text">{receipt.outcome}</div>
              <div className="reason">AI: {receipt.ai_summary}</div>
              <div className="reason">Effect: {receipt.effect_of_ai}</div>
              <div className="pill-row">
                <span className="pill">Final authority: {receipt.final_authority}</span>
                <span className="pill">{receipt.disclosure.replaceAll("_", " ")}</span>
                <span className="pill moss">No source content stored</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty" style={{ marginBottom: 18 }}>
          No specific-case receipt exists for this system version yet.
        </div>
      )}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor={`receipt-decision-${systemVersionId}`}>Decision point · optional</label>
          <select
            id={`receipt-decision-${systemVersionId}`}
            className="select"
            value={decisionId}
            onChange={(event) => chooseDecision(event.target.value)}
          >
            <option value="">This example is not tied to a recorded decision point</option>
            {version.decisions.map((decision) => (
              <option key={decision.id} value={decision.id}>{decision.name}</option>
            ))}
          </select>
        </div>

        <div className="grid">
          <div className="field" style={{ gridColumn: "span 4" }}>
            <label htmlFor={`receipt-involvement-${systemVersionId}`}>AI involvement</label>
            <select
              id={`receipt-involvement-${systemVersionId}`}
              className="select"
              value={involvement}
              onChange={(event) => setInvolvement(event.target.value as AIInfluence)}
            >
              {involvementOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: "span 4" }}>
            <label htmlFor={`receipt-authority-${systemVersionId}`}>Final authority</label>
            <select
              id={`receipt-authority-${systemVersionId}`}
              className="select"
              value={finalAuthority}
              onChange={(event) => setFinalAuthority(event.target.value as Decision["authority"])}
            >
              {authorityOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: "span 4" }}>
            <label htmlFor={`receipt-disclosure-${systemVersionId}`}>Who can see this receipt?</label>
            <select
              id={`receipt-disclosure-${systemVersionId}`}
              className="select"
              value={disclosure}
              onChange={(event) => setDisclosure(event.target.value as DisclosureLevel)}
            >
              {disclosureOptions.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </select>
          </div>
        </div>

        <div className="field">
          <label htmlFor={`receipt-ai-${systemVersionId}`}>What did AI contribute?</label>
          <textarea
            id={`receipt-ai-${systemVersionId}`}
            className="textarea"
            value={aiSummary}
            onChange={(event) => setAiSummary(event.target.value)}
            placeholder="For example: AI highlighted evidence relevant to an eligibility criterion."
          />
        </div>
        <div className="field">
          <label htmlFor={`receipt-effect-${systemVersionId}`}>What happened because of that contribution?</label>
          <textarea
            id={`receipt-effect-${systemVersionId}`}
            className="textarea"
            value={effect}
            onChange={(event) => setEffect(event.target.value)}
            placeholder="For example: the finding prompted a person to review the original application."
          />
        </div>
        <div className="field">
          <label htmlFor={`receipt-human-${systemVersionId}`}>What did a person do? · optional unless human/hybrid has final authority</label>
          <textarea
            id={`receipt-human-${systemVersionId}`}
            className="textarea"
            value={humanInvolvement}
            onChange={(event) => setHumanInvolvement(event.target.value)}
            placeholder="Only describe real human involvement; leave blank rather than implying review that did not happen."
          />
        </div>
        <div className="field">
          <label htmlFor={`receipt-outcome-${systemVersionId}`}>What was the outcome?</label>
          <textarea
            id={`receipt-outcome-${systemVersionId}`}
            className="textarea"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            placeholder="Describe the result in language an affected person could understand."
          />
        </div>
        <div className="field">
          <label htmlFor={`receipt-challenge-${systemVersionId}`}>How could someone question or challenge this outcome? · optional</label>
          <textarea
            id={`receipt-challenge-${systemVersionId}`}
            className="textarea"
            value={challenge}
            onChange={(event) => setChallenge(event.target.value)}
          />
        </div>
        {error ? <div className="error-box" style={{ marginBottom: 12 }}>{error}</div> : null}
        <button className="btn primary" type="submit">Add case receipt</button>
      </form>
    </div>
  );
}
