"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  parsePortableBundle,
  portableBundleSchema,
  validateBundleReferences,
  type CruxPortableBundle,
} from "@crux/formats";
import { buildReaderModel } from "../lib/reader-model";
import { putBrowserRecord } from "../lib/browser-records";
import { observedBehaviourForVersion } from "../lib/observed";
import { acceptDiscoveredUse, clearPendingConnection, saveOauthReturnDraft, savePendingAdvancedAnswers, savePendingConnection, takeOauthReturnDraft, takePendingReviewRecord, takePendingBrowserRecord } from "../lib/connection-handoff";
import {
  evidenceTarget,
  makeSimpleAIUseRecord,
  needsDetailedAuthoring,
  type SimpleControl,
  type SimpleRole,
  type SimpleUseAnswers,
} from "../lib/simple-ai-use";
import { SimpleUseCard } from "./simple-use-card";
import { EvidenceEditor } from "./evidence-editor";
import { DisclosurePreview } from "./disclosure-preview";
import { GithubDiscoveryExperience } from "./github-discovery-experience";
import { MentalModelWorkbench } from "./mental-model-workbench";
import styles from "./simple-ai-use-workbench.module.css";

type Stage = "describe" | "clarify" | "review" | "connect" | "detailed";

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
  const [previousDraft, setPreviousDraft] = useState<CruxPortableBundle | null>(null);
  const [previousImported, setPreviousImported] = useState(false);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [previousSavedRecordId, setPreviousSavedRecordId] = useState<string | null>(null);
  const [previousSavedFingerprint, setPreviousSavedFingerprint] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState("");
  const [error, setError] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const [targetClaim, setTargetClaim] = useState("");

  useEffect(() => {
    const saved = takePendingBrowserRecord();
    if (saved) {
      setBundle(saved.bundle);
      setImported(true);
      setTargetClaim(evidenceTarget(saved.bundle) ?? "");
      setSavedRecordId(saved.id);
      setSavedFingerprint(JSON.stringify(saved.bundle));
      setStage("review");
      return;
    }
    const confirmed = takePendingReviewRecord();
    if (!confirmed) {
      const returning = takeOauthReturnDraft();
      if (returning) {
        setBundle(returning.bundle);
        setImported(returning.imported);
        setTargetClaim(evidenceTarget(returning.bundle) ?? "");
        if (returning.savedId) {
          setSavedRecordId(returning.savedId);
          setSavedFingerprint(JSON.stringify(returning.bundle));
        }
      }
      if (window.location.hash === "#connect") setStage("connect");
      return;
    }
    setBundle(confirmed);
    setTargetClaim(evidenceTarget(confirmed) ?? "");
    setStage("review");
    setImported(true);
    setError("");
  }, []);

  const canonical = useMemo(() => {
    if (!bundle) return null;
    const parsed = portableBundleSchema.safeParse(bundle);
    if (!parsed.success || !validateBundleReferences(parsed.data).valid) return null;
    return parsed.data;
  }, [bundle]);
  const model = useMemo(() =>
    bundle ? buildReaderModel({ kind: "working", bundle }) : null, [bundle],
  );
  const runtime = useMemo(() => {
    if (!bundle) return undefined;
    const use = bundle.ai_uses[0];
    const system = bundle.systems.find((item) => use?.system_refs.includes(item.id) || item.ai_use_refs.includes(use?.id ?? ""));
    return observedBehaviourForVersion(bundle, system?.current_version_ref);
  }, [bundle]);
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
      setSavedRecordId(null);
      setSavedFingerprint(null);
      setSavedMessage("");
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
      setSavedRecordId(null);
      setSavedFingerprint(null);
      setSavedMessage("");
      setTargetClaim(evidenceTarget(draft) ?? "");
      setStage("review");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the record.");
    }
  };

  const saveInBrowser = () => {
    if (!canonical) {
      setError("This record is not valid yet. Check the details before saving.");
      return;
    }
    try {
      const stored = putBrowserRecord(window.localStorage, canonical, savedRecordId ?? undefined);
      setSavedRecordId(stored.id);
      setSavedFingerprint(JSON.stringify(canonical));
      setSavedMessage("Saved on this device. It is not synced to an account.");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save in this browser. Download a JSON backup instead.");
    }
  };

  const continueDetailed = () => {
    try {
      savePendingAdvancedAnswers(answers);
      setStage("detailed");
    } catch {
      setError("Could not carry your answers into the detailed questions in this browser.");
    }
  };

  const connectProject = () => {
    try {
      // Discovery creates a different exact-version record only after confirmation.
      // Evidence must never silently move to that version.
      if (canonical && (canonical.evidence.length || canonical.events.length || canonical.runs.length || canonical.observations.length)) {
        download(canonical, "crux-ai-use-before-connection.json");
      }
      if (bundle && !imported) savePendingConnection(answers);
      else clearPendingConnection();
      setStage("connect");
      setError("");
      window.history.replaceState(null, "", "/author#connect");
    } catch {
      setError("Your browser could not prepare the connection. Download a copy of the record first.");
    }
  };

  const beforeGithubConnect = () => {
    if (!canonical) return true;
    try {
      saveOauthReturnDraft(canonical, imported, Date.now(),
        savedRecordId && savedFingerprint === JSON.stringify(canonical) ? savedRecordId : undefined);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Download your draft before continuing.");
      return false;
    }
  };

  const reviewDiscoveredUse = (confirmed: CruxPortableBundle) => {
    try {
      const selection = acceptDiscoveredUse(bundle, confirmed);
      setPreviousDraft(selection.previous);
      setPreviousImported(imported);
      setPreviousSavedRecordId(savedRecordId);
      setPreviousSavedFingerprint(savedFingerprint);
      setSavedRecordId(null);
      setSavedFingerprint(null);
      setSavedMessage("");
      setBundle(selection.active);
      setTargetClaim(evidenceTarget(selection.active) ?? "");
      setStage("review");
      setImported(true);
      setShowEvidence(false);
      setError("");
      window.history.replaceState(null, "", "/author");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review this discovered AI use.");
    }
  };

  const returnToPreviousDraft = () => {
    if (!previousDraft) return;
    setBundle(previousDraft);
    setTargetClaim(evidenceTarget(previousDraft) ?? "");
    setPreviousDraft(null);
    setImported(previousImported);
    setSavedRecordId(previousSavedRecordId);
    setSavedFingerprint(previousSavedFingerprint);
    setPreviousSavedRecordId(null);
    setPreviousSavedFingerprint(null);
    setSavedMessage("");
    setStage("review");
    setShowEvidence(false);
    setError("");
  };

  if (stage === "detailed") {
    return (
      <div className={styles.workbench}>
        <div className={styles.journeyIntro}>
          <span className={styles.progress}>Describe · a few more questions</span>
          <h2>Who decides, and what can AI do?</h2>
          <p>Your description has been carried into the extra questions needed for this AI use.</p>
        </div>
        <MentalModelWorkbench />
      </div>
    );
  }

  return (
    <div className={styles.workbench}>
      <nav className={styles.journey} aria-label="AI use journey">
        <span className={stage === "describe" || stage === "clarify" ? styles.current : ""}>1 · Describe</span>
        <span className={stage === "connect" ? styles.current : ""}>2 · Check (optional)</span>
        <span className={stage === "review" ? styles.current : ""}>3 · Explain</span>
      </nav>
      {stage === "connect" ? (
        <>
          <div className={styles.journeyIntro}>
            <div>
              <span className={styles.progress}>Check your AI use</span>
              <h2>Find where AI is running.</h2>
              <p>Confirm the right workflow before connecting it to your description. Earlier evidence is never automatically attached to a different system version.</p>
            </div>
            <button className="btn ghost" type="button" onClick={() => { setStage(bundle ? "review" : "describe"); window.history.replaceState(null, "", "/author"); }}>
              ← {bundle ? "Back to your explanation" : "Describe it instead"}
            </button>
          </div>
          {error ? <p role="alert" className={styles.error}>{error}</p> : null}
          <GithubDiscoveryExperience onReviewConfirmedUse={reviewDiscoveredUse} onBeforeGithubConnect={beforeGithubConnect} />
        </>
      ) : stage !== "review" ? (
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
                <button className="btn ghost" type="button" onClick={connectProject}>Or connect a project</button>
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
                  <p>AI may decide or act without a person, or we're not sure who controls it. We need to clarify this before producing an explanation.</p>
                  <button className="btn" type="button" onClick={continueDetailed}>Continue with these answers →</button>
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
            <div className={styles.actions}>
              {previousDraft ? <button className="btn ghost" type="button" onClick={returnToPreviousDraft}>Return to earlier draft</button> : null}
              {!imported ? <button className="btn ghost" type="button" onClick={reviseDraft}>Change answers</button> : null}
            </div>
          </div>
          <SimpleUseCard model={model} observed={runtime} note={
            savedRecordId
              ? (savedFingerprint === JSON.stringify(canonical)
                ? savedMessage || "Saved locally. No account or cloud sync."
                : "You have unsaved changes in this browser. Save again to keep them.")
              : "Not saved to an account. Save in this browser or download a JSON copy to return later."
          }
            actions={
              <>
                <button className="btn primary" type="button" onClick={connectProject}>Check a project →</button>
                <button className="btn" type="button" onClick={() => setShowEvidence((old) => !old)}>+ Add evidence</button>
                <button className="btn" type="button" onClick={saveInBrowser} disabled={!canonical}>Save in this browser</button>
                {canonical ? <button className="btn ghost" type="button" onClick={() => download(canonical, "crux-ai-use.json")}>Download JSON backup</button> : null}
              </>
            } />

          {showEvidence ? (
            <section className={styles.evidence} aria-label="Add evidence">
              <h3>What backs up your explanation?</h3>
              {bundle.claims.length > 1 ? (
                <>
                  <label className={styles.label} htmlFor="evidence-target">Which statement are you checking?</label>
                  <select id="evidence-target" className="select" value={targetClaim}
                    onChange={(event) => setTargetClaim(event.target.value)}>
                    {bundle.claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.statement}</option>)}
                  </select>
                </>
              ) : null}
              {targetClaim ? <EvidenceEditor key={targetClaim} bundle={bundle} claimId={targetClaim}
                onBundleChange={(next) => { setBundle(next); setShowEvidence(false); setError(""); }} />
                : <p>No statement has been recorded for this use yet. Add one using the detailed editor.</p>}
              <button className="btn ghost" type="button" onClick={() => setShowEvidence(false)}>Close</button>
            </section>
          ) : error ? <p role="alert" className={styles.error}>{error}</p> : null}

          <div className={styles.next}>
            <h3>What happens next?</h3>
            <p>Check a project for real AI activity, or add evidence to support your description. What you say remains separate from what CRUX observes.</p>
            <div className={styles.actions}>
              <Link className="btn ghost" href="/live">See an interactive observation example</Link>
            </div>
          </div>

          {canonical ? <details className={styles.preview}>
            <summary>Preview public and affected-person explanations</summary>
            <DisclosurePreview bundle={canonical} />
          </details> : <p className={styles.small}>This draft is not ready for an external explanation.</p>}
          <p className={styles.small}>Browser saves are optional and stay on this device. CRUX does not automatically refresh observations. <Link href="/records">See your saved records →</Link></p>
          <button className="btn ghost" type="button" onClick={() => { setStage("describe"); setBundle(null); setImported(false); setAnswers(defaultAnswers); setImpactAnswered(false); setShowEvidence(false); setPreviousDraft(null); setPreviousImported(false); setSavedRecordId(null); setSavedFingerprint(null); setPreviousSavedRecordId(null); setPreviousSavedFingerprint(null); setSavedMessage(""); setError(""); }}>Start another use</button>
        </section>
      ) : null}
    </div>
  );
}
