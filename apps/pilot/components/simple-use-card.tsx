"use client";

import type { ReactNode } from "react";
import type { ReaderModel } from "../lib/reader-model";
import type { PilotObservedBehaviour } from "../lib/observed";
import { CruxReader } from "./crux-reader";
import styles from "./simple-ai-use.module.css";

type SimpleUseCardProps = {
  model: ReaderModel;
  actions?: ReactNode;
  note?: ReactNode;
  observed?: PilotObservedBehaviour;
};

/** A short explanation first. Full CRUX reasoning is always available on demand. */
export function SimpleUseCard({ model, actions, note, observed }: SimpleUseCardProps) {
  const evidence = model.claims.flatMap((claim) => claim.evidence.map((item) => ({ claim, item })));
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
      ? `${changedFields.length} difference${changedFields.length === 1 ? "" : "s"} in model/provider metadata need reviewing.`
      : "The model/provider metadata we could compare matched. Other controls are not verified.";

  return (
    <article className={styles.record}>
      <div className={styles.kicker}>{model.audience === "internal" ? "Working record" : model.audience === "public" ? "Public explanation" : "Explanation for someone affected"}</div>
      <h2>{model.use?.name ?? "AI use not yet described"}</h2>
      <p className={styles.intro}>{model.use?.summary ?? "No explanation has been added."}</p>
      <div className={styles.facts}>
        <section>
          <h3>What AI does</h3>
          <p>{model.aiCan.length ? model.aiCan.join(" · ") : "Not yet recorded"}</p>
        </section>
        <section>
          <h3>Who decides</h3>
          <p>{authority}</p>
        </section>
      </div>

      <section className={styles.check}>
        <div className={styles.checkHeader}>
          <h3>How do we know?</h3>
          <span>{evidence.length ? `${evidence.length} item${evidence.length === 1 ? "" : "s"} of evidence` : "Not evidenced yet"}</span>
        </div>
        {evidence.length ? (
          <div className={styles.checkItems}>
            {evidence.slice(0, 2).map(({ claim, item }) => (
              <div key={item.id}>
                <p>{item.summary}</p>
                <small>{item.relationship} — about “{claim.statement}”</small>
                {item.sourceUrl ? <a className={styles.source} href={item.sourceUrl} target="_blank" rel="noopener noreferrer">View source ↗</a> : null}
              </div>
            ))}
          </div>
        ) : <p>There's no supporting evidence linked to this explanation yet. It is still what the organisation says.</p>}
      </section>

      {model.audience === "internal" ? (
        <section className={styles.check}>
          <div className={styles.checkHeader}>
            <h3>What's actually happening?</h3>
            <span>{observations || attached ? "System data available" : "Not connected"}</span>
          </div>
          {observations || attached ? (
            <>
              <p>{observations ? `${observations} model observation${observations === 1 ? "" : "s"} compared with this version.` : `${attached} runtime observation${attached === 1 ? "" : "s"} attached to this version.`}</p>
              <p className={differences ? styles.attention : undefined}>{runtimeMessage}</p>
              {changedFields.slice(0, 3).map((field, index) => (
                <p className={styles.attention} key={index}>
                  {field.field === "provider" ? "Provider" : "Model"}: expected {field.declared}; observed {field.observed}
                </p>
              ))}
              {newFields.slice(0, 2).map((field, index) => (
                <p key={index}>{field.field === "provider" ? "Provider" : "Model"} observed: {field.observed} (not yet declared)</p>
              ))}
              <small>Only recorded provider/model metadata is compared here. One run cannot prove how every decision or action works.</small>
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
