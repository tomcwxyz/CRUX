"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  parsePortableBundle,
  portableBundleSchema,
  redactBundle,
  validateBundleReferences,
  type CruxPortableBundle,
} from "@crux/formats";
import { appendManualEvidenceWithSource } from "../lib/manual-evidence";
import { buildReaderModel } from "../lib/reader-model";
import {
  evidenceTarget,
  makeSimpleAIUseRecord,
  needsDetailedAuthoring,
  type SimpleControl,
  type SimpleRole,
  type SimpleUseAnswers,
} from "../lib/simple-ai-use";
import { SimpleUseCard } from "./simple-use-card";
import styles from "./simple-ai-use-workbench.module.css";

type Stage = "describe" | "clarify" | "review";

const defaultAnswers: SimpleUseAnswers = {
  name: "", description: "", organisation: "", role: "unsure",
  control: "unsure", consequential: false, peopleAffected: "",
};

const roleChoices: Array<{ value: SimpleRole; label: string }> = [
  { value: "assist", label: "Help with a task" },
  { value: "recommend", label: "Make recommendations" },
  { value: "decide", label: "Make decisions" },
  { value: "act", label: "Take actions" },
  { value: "unsure", label: "I'm not sure" },
];

const controlChoices: Array<{ value: SimpleControl; label: string }> = [
  { value: "person", label: "A person" },
  { value: "ai", label: "AI" },
  { value: "rule", label: "A set rule" },
  { value: "unsure", label: "Not sure yet" },
];

const download = (value: unknown, filename: string) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function SimpleAIUseWorkbench() {
  const [stage, setStage] = useState<Stage>("describe");
  const [answers, setAnswers] = useState<SimpleUseAnswers>(defaultAnswers);
  const [impactAnswered, setImpactAnswered] = useState(false);
  const [bundle, setBundle] = useState<CruxPortableBundle | null>(null);
  const [imported, setImported] = useState(false);
  const [error, setError] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [evidenceRelation, setEvidenceRelation] = useState<"supports" | "qualifies" | "contradicts" | "inconclusive">("supports");
  const [publicEvidence, setPublicEvidence] = useState(false);
  const [targetClaim, setTargetClaim] = useState("");

  const canonical = useMemo(() => {
    if (!bundle) return null;
    const parsed = portableBundleSchema.safeParse(bundle);
    if (!parsed.success || !validateBundleReferences(parsed.data).valid) return null;
    return parsed.data;
  }, [bundle]);
  const model = useMemo(() =>
    bundle ? buildReaderModel({ kind: "working", bundle }) : null, [bundle],
  );
  const publicModel = useMemo(() =>
    canonical ? buildReaderModel({ kind: "disclosure", projection: redactBundle(canonical, "public") }) : null,
    [canonical],
  );

  const change = (patch: Partial<SimpleUseAnswers>) => {
    setAnswers((old) => ({ ...old, ...patch }));
    setError("");
  };

  const openRecord = async (file: File | undefined) => {
    if (!file) return;
    try {
      const value = parsePortableBundle(JSON.parse(await file.text()) as unknown);
      const references = validateBundleReferences(value);
      if (!references.valid) throw new Error("This record has broken references and cannot be previewed safely.");
      setBundle(value);
      setTargetClaim(evidenceTarget(value) ?? "");
      setStage("review");
      setImported(true);
      setError("");
      setShowEvidence(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open that record.");
    }
  };

  const reviseDraft = () => {
    // Recreating an authored record would discard evidence and observations.
    // Once either exists, preserve the record and edit it with the full editor.
    if (bundle && (bundle.evidence.length || bundle.events.length || bundle.observations.length || bundle.runs.length)) {
      setError("This record has linked information. Download it and use the detailed editor rather than starting again.");
      return;
    }
    setBundle(null);
    setStage("clarify");
    setError("");
    setShowEvidence(false);
  };

  const finish = () => {
    if (!impactAnswered) {
      setError("Please tell us whether this could significantly affect someone.");
      return;
    }
    if (needsDetailedAuthoring(answers)) return;
    try {
      const draft = makeSimpleAIUseRecord({
        ...answers,
        name: answers.name.trim() || answers.description.trim().slice(0, 64),
      });
      const valid = portableBundleSchema.safeParse(draft);
      if (!valid.success || !validateBundleReferences(draft).valid) {
        throw new Error("This record needs a few more details before it can be shared.");
      }
      setBundle(draft);
      setImported(false);
      setTargetClaim(evidenceTarget(draft) ?? "");
      setStage("review");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the record.");
    }
  };

  const addEvidence = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bundle || !targetClaim) return;
    try {
      const { bundle: next } = appendManualEvidenceWithSource(bundle, targetClaim, {
        summary: evidenceSummary,
        sourceUri: sourceUrl,
        kind: sourceUrl.trim() ? "policy" : "human_review",
        relationship: evidenceRelation,
        disclosure: publicEvidence ? "public" : "internal",
      });
      setBundle(next);
      setEvidenceSummary("");
      setSourceUrl("");
      setEvidenceRelation("supports");
      setPublicEvidence(false);
      setShowEvidence(false);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add evidence.");
    }
  };

  return (
    <div className={styles.workbench}>
      {stage !== "review" ? (
        <section className={styles.form}>
          <div className={styles.progress}>Step {stage === "describe" ? "1" : "2"} of 2</div>
          {stage === "describe" ? (
            <>
              <h2>What do you use AI to do?</h2>
              <label className={styles.label} htmlFor="simple-ai-description">Describe one real use</label>
              <textarea id="simple-ai-description" className="textarea" rows={3}
                placeholder="For example: AI helps our team review funding applications."
                value={answers.description} onChange={(event) => change({ description: event.target.value })}/>
              <label className={styles.label} htmlFor="simple-ai-name">Give it a short name (optional)</label>
              <input id="simple-ai-name" className="input" value={answers.name}
                placeholder="Funding application review" onChange={(event) => change({ name: event.target.value })} />
              {error ? <p role="alert" className={styles.error}>{error}</p> : null}
              <div className={styles.actions}>
                <button className="btn primary" type="button" onClick={() => {
                  if (!answers.description.trim()) { setError("Start with one sentence about what AI does."); return; }
                  setError(""); setStage("clarify");
                }}>Continue →</button>
                <label className="btn file-label">Open an existing record
                  <input type="file" accept=".json,application/json" onChange={(event) => void openRecord(event.target.files?.[0])}/>
                </label>
              </div>
            </>
          ) : (
            <>
              <h2>What can AI do here?</h2>
              <fieldset className={styles.fieldset}>
                <legend>AI's role</legend>
                <div className={styles.options}>
                  {roleChoices.map((choice) => (
                    <label key={choice.value} className={styles.choice}>
                      <input type="radio" name="ai-role" checked={answers.role === choice.value}
                        onChange={() => change({ role: choice.value })}/>
                      <span>{choice.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className={styles.fieldset}>
                <legend>Who decides what happens next?</legend>
                <div className={styles.options}>
                  {controlChoices.map((choice) => (
                    <label key={choice.value} className={styles.choice}>
                      <input type="radio" name="ai-control" checked={answers.control === choice.value}
                        onChange={() => change({ control: choice.value })}/>
                      <span>{choice.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className={styles.fieldset}>
                <legend>Could this significantly affect someone?</legend>
                <div className={styles.options}>
                  <label className={styles.choice}><input type="radio" name="significant" checked={impactAnswered && answers.consequential}
                    onChange={() => { change({ consequential: true }); setImpactAnswered(true); }}/><span>Yes</span></label>
                  <label className={styles.choice}><input type="radio" name="significant" checked={impactAnswered && !answers.consequential}
                    onChange={() => { change({ consequential: false }); setImpactAnswered(true); }}/><span>No</span></label>
                </div>
              </fieldset>
              {answers.consequential && impactAnswered ? (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="people-affected">Who might be affected? (optional)</label>
                  <input id="people-affected" className="input" value={answers.peopleAffected}
                    placeholder="For example: People applying for grants" onChange={(event) => change({ peopleAffected: event.target.value })}/>
                </div>
              ) : null}
              <details className={styles.optional}>
                <summary>Organisation name (optional)</summary>
                <input className="input" aria-label="Organisation name" value={answers.organisation}
                  onChange={(event) => change({ organisation: event.target.value })} placeholder="Your organisation"/>
              </details>
              {needsDetailedAuthoring(answers) ? (
                <div className={styles.important}>
                  <strong>We need a little more detail for this use.</strong>
                  <p>If AI takes actions, or its role isn't clear yet, we shouldn't guess what it can do or what limits apply.</p>
                  <Link className="btn" href="/author/advanced">Use the detailed editor →</Link>
                  <p className={styles.small}>This editor doesn't yet carry your answers across automatically.</p>
                </div>
              ) : null}
              {error ? <p role="alert" className={styles.error}>{error}</p> : null}
              <div className={styles.actions}>
                <button className="btn ghost" type="button" onClick={() => { setStage("describe"); setError(""); }}>← Back</button>
                <button className="btn primary" type="button" disabled={needsDetailedAuthoring(answers)} onClick={finish}>See your explanation →</button>
              </div>
            </>
          )}
        </section>
      ) : model && bundle ? (
        <section className={styles.review} aria-label="Your AI use">
          <div className={styles.reviewTop}>
            <div>
              <span className={styles.progress}>Your explanation</span>
              <h2>Does this sound right?</h2>
            </div>
            {!imported ? <button className="btn ghost" type="button" onClick={reviseDraft}>Change answers</button> : null}
          </div>
          <SimpleUseCard model={model} note="This is an unpublished draft in your browser, not a live record."
            actions={
              <>
                {canonical ? <button className="btn primary" type="button" onClick={() => download(canonical, "crux-ai-use.json")}>Download a copy</button> : null}
                <button className="btn" type="button" onClick={() => setShowEvidence((old) => !old)}>+ Add evidence</button>
              </>
            } />

          {showEvidence ? (
            <form className={styles.evidence} onSubmit={addEvidence}>
              <h3>Add something that helps check this explanation</h3>
              <label className={styles.label} htmlFor="evidence-target">Which statement?</label>
              <select id="evidence-target" className="select" value={targetClaim} onChange={(event) => setTargetClaim(event.target.value)}>
                {bundle.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.statement}</option>)}
              </select>
              <label className={styles.label} htmlFor="evidence-summary">What does the evidence show?</label>
              <textarea id="evidence-summary" className="textarea" value={evidenceSummary} onChange={(event) => setEvidenceSummary(event.target.value)}
                placeholder="For example: We checked the workflow and saw that a funding officer has to approve the decision."/>
              <label className={styles.label} htmlFor="evidence-link">Link to supporting material (optional)</label>
              <input id="evidence-link" className="input" type="url" placeholder="https://…"
                value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
              <label className={styles.label} htmlFor="evidence-meaning">Does it support the statement?</label>
              <select id="evidence-meaning" className="select" value={evidenceRelation}
                onChange={(event) => setEvidenceRelation(event.target.value as typeof evidenceRelation)}>
                <option value="supports">Supports it</option>
                <option value="qualifies">Only partly / with a caveat</option>
                <option value="contradicts">Challenges it</option>
                <option value="inconclusive">Doesn't settle it</option>
              </select>
              <label className={styles.checkLine}><input type="checkbox" checked={publicEvidence}
                onChange={(event) => setPublicEvidence(event.target.checked)}/>
                This evidence can appear in a public explanation</label>
              <p className={styles.small}>This is evidence supplied by your organisation. CRUX won't treat it as independently verified.</p>
              {error ? <p role="alert" className={styles.error}>{error}</p> : null}
              <div className={styles.actions}>
                <button className="btn primary" type="submit" disabled={!targetClaim || !evidenceSummary.trim()}>Add evidence</button>
                <button className="btn ghost" type="button" onClick={() => setShowEvidence(false)}>Cancel</button>
              </div>
            </form>
          ) : error ? <p role="alert" className={styles.error}>{error}</p> : null}

          <div className={styles.next}>
            <h3>See what happens when AI runs</h3>
            <p>CRUX can compare recorded behaviour with this explanation. No live connection is set up by this form.</p>
            <div className={styles.actions}>
              <Link className="btn" href="/discover">Connect a project →</Link>
              <Link className="btn ghost" href="/live">Try the separate runtime demo</Link>
            </div>
          </div>

          {publicModel ? <details className={styles.preview}>
            <summary>Preview what someone outside your organisation could read</summary>
            <SimpleUseCard model={publicModel} />
          </details> : null}
          <p className={styles.small}>CRUX doesn't yet save these drafts to an account. Download your record before leaving this page.</p>
          <button className="btn ghost" type="button" onClick={() => { setStage("describe"); setBundle(null); setImported(false); setAnswers(defaultAnswers); setImpactAnswered(false); setShowEvidence(false); setError(""); }}>Start another use</button>
        </section>
      ) : null}
    </div>
  );
}
