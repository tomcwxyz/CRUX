"use client";

import type { ReactNode } from "react";
import type { ReaderModel, ReaderCase } from "../lib/reader-model";
import type { PilotObservedBehaviour } from "../lib/observed";
import { caseVisibilityCopy, evidenceRelationshipCopy, summariseVisibleEvidence } from "../lib/explanation-summary";
import { CruxReader } from "./crux-reader";
import styles from "./simple-ai-use.module.css";

type SimpleUseCardProps = {
  model: ReaderModel;
  actions?: ReactNode;
  note?: ReactNode;
  observed?: PilotObservedBehaviour | undefined;
  /** Example route already has a process and key facts; avoid repeating them. */
  showOverview?: boolean;
};

function CaseSummary({ item }: { item: ReaderCase }) {
  return (
    <section className={styles.caseSummary} aria-label="What happened in this case">
      <div className={styles.reasonLabel}>HAPPENED <span>One particular case, not proof of every case</span></div>
      <p><strong>AI contributed:</strong> {item.aiContribution}</p>
      <p><strong>What followed:</strong> {item.effect}</p>
      <p><strong>Outcome:</strong> {item.outcome}</p>
      <p><strong>Final authority:</strong> {item.finalAuthority}</p>
      {item.challenge ? <p><strong>Questions or challenges:</strong> {item.challenge.text}</p> : <p>There is no visible way to challenge this outcome yet.</p>}
    </section>
  );
}

/** A concise explanation, with the complete, audience-safe reader underneath. */
export function SimpleUseCard({ model, actions, note, observed, showOverview = true }: SimpleUseCardProps) {
  const overview = summariseVisibleEvidence(model);
  const cases = model.cases;
  const caseNote = caseVisibilityCopy(model);
  const observations = model.activity?.modelComparisons ?? 0;
  const attached = model.activity?.attachedObservations ?? 0;
  const differences = model.activity?.differencesToReview ?? 0;
  const authority = model.decisions[0]?.authority ?? model.humanCheckpoint ?? "Not yet recorded";
  const fields = observed?.comparisons.flatMap((comparison) => comparison.fields) ?? [];
  const checkedFields = fields.filter((field) => field.status === "match" || field.status === "divergence");
  const changedFields = fields.filter((field) => field.status === "divergence");
  const newFields = fields.filter((field) => field.status === "declared_unknown" && field.observed);
  const runtimeMessage = !fields.length || !checkedFields.length
    ? "Observations are available, but there isn't enough declared model information to compare them."
    : changedFields.length
      ? changedFields.length + " difference(s) in model/provider metadata need reviewing."
      : "The model/provider metadata we could compare matched. Other controls are not verified.";
  const affected = model.audience === "affected_party";
  const anyGaps = overview.withoutEvidence > 0 || model.unknowns.length > 0;

  return (
    <article className={styles.record}>
      {showOverview ? (
        <>
          <div className={styles.kicker}>{model.audience === "internal" ? "Working record" : model.audience === "public" ? "Public explanation" : "Explanation for someone affected"}</div>
          <h2>{model.use?.name ?? "AI use not yet described"}</h2>
          <p className={styles.intro}>{model.use?.summary ?? "No explanation has been added."}</p>
          <div className={styles.facts}>
            <section><h3>What AI does</h3><p>{model.aiCan.length ? model.aiCan.join(" · ") : "Not yet recorded"}</p></section>
            <section><h3>Who decides</h3><p>{authority}</p></section>
          </div>
        </>
      ) : null}

      {affected && cases.length > 0 ? <CaseSummary item={cases[0]!} /> : null}

      <section className={styles.check} aria-label="Claims and evidence">
        <div className={styles.checkHeader}><h3>How do we know?</h3><span>{overview.items} visible evidence item{overview.items === 1 ? "" : "s"}</span></div>
        <div className={styles.reasoning}>
          <div className={styles.reasonRow}>
            <div className={styles.reasonLabel}>SAYS <span>What the organisation declares</span></div>
            <div>
              {overview.claims ? model.claims.slice(0, 2).map((claim) => <p key={claim.id}>{claim.statement}</p>) : <p>No statement has been recorded.</p>}
              {overview.claims > 2 ? <small>More statements appear in the full explanation.</small> : null}
            </div>
          </div>
          <div className={styles.reasonRow}>
            <div className={styles.reasonLabel}>SHOWS <span>What the visible evidence says</span></div>
            <div>
              {overview.items ? (
                <div className={styles.checkItems}>
                  {model.claims.flatMap((claim) => claim.evidence.map((item) => ({ claim, item }))).slice(0, 3).map(({ claim, item }) => (
                    <div key={claim.id + item.id}>
                      <p>{item.summary}</p>
                      <small>{evidenceRelationshipCopy(item)} · about “{claim.statement}”</small>
                      {item.limitations.length ? <small>Limitation: {item.limitations.join(" · ")}</small> : null}
                      {item.sourceUrl ? <a className={styles.source} href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Open source ↗</a> : null}
                    </div>
                  ))}
                  {overview.items > 3 ? <small>More evidence is in the full explanation.</small> : null}
                </div>
              ) : <p>{model.audience === "internal" ? "No evidence is attached to the statements above yet." : "No evidence is visible in this explanation yet."} These remain statements, not proof.</p>}
              {overview.caveats ? <p className={styles.attention}>Some evidence adds a caveat, challenges a statement or leaves the question unsettled.</p> : null}
            </div>
          </div>
          {anyGaps ? (
            <div className={styles.reasonRow}>
              <div className={styles.reasonLabel}>UNKNOWN <span>What still needs an answer</span></div>
              <div>
                {overview.withoutEvidence > 0 ? <p>{overview.withoutEvidence} statement{overview.withoutEvidence === 1 ? "" : "s"} without visible evidence in this view.</p> : null}
                {model.unknowns.slice(0, 2).map((item) => <p key={item}>{item}</p>)}
                {model.unknowns.length > 2 ? <small>More open questions are in the full explanation.</small> : null}
              </div>
            </div>
          ) : null}
        </div>
        <p className={styles.note}>Evidence can support or challenge a statement. CRUX does not independently certify that it is true.</p>
      </section>

      {!affected && cases.length > 0 && model.audience !== "public" ? <CaseSummary item={cases[0]!} /> : null}
      {caseNote && model.use?.consequential ? <div className={styles.caseNote}><strong>HAPPENED</strong> {caseNote}</div> : null}

      {model.audience === "internal" ? (
        <section className={styles.check}>
          <div className={styles.checkHeader}><h3>What's actually happening?</h3><span>{observations || attached ? "System data available" : "Not connected"}</span></div>
          {observations || attached ? (
            <>
              <p>{observations ? observations + " model observation(s) compared with this version." : attached + " runtime observation(s) attached to this version."}</p>
              <p className={differences ? styles.attention : undefined}>{runtimeMessage}</p>
              {changedFields.slice(0, 3).map((field, index) => <p className={styles.attention} key={index}>{field.field === "provider" ? "Provider" : "Model"}: expected {field.declared}; observed {field.observed}</p>)}
              {newFields.slice(0, 2).map((field, index) => <p key={index}>{field.field === "provider" ? "Provider" : "Model"} observed: {field.observed} (not yet declared)</p>)}
              <small>Only recorded provider/model metadata is compared. One run cannot prove how every decision or action works.</small>
            </>
          ) : <p>No runtime evidence is linked to this AI use yet. That doesn't mean the system has never run.</p>}
        </section>
      ) : null}

      {note ? <p className={styles.note}>{note}</p> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
      <details className={styles.more}>
        <summary>See the full explanation and evidence</summary>
        <CruxReader model={model} framed={false} />
      </details>
    </article>
  );
}
