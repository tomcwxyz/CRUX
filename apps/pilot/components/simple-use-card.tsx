"use client";

import type { ReactNode } from "react";
import type { ReaderModel } from "../lib/reader-model";
import { CruxReader } from "./crux-reader";
import styles from "./simple-ai-use.module.css";

type SimpleUseCardProps = {
  model: ReaderModel;
  actions?: ReactNode;
  note?: ReactNode;
};

/** A short explanation first. Full CRUX reasoning is always available on demand. */
export function SimpleUseCard({ model, actions, note }: SimpleUseCardProps) {
  const evidence = model.claims.flatMap((claim) => claim.evidence.map((item) => ({ claim, item })));
  const observations = model.activity?.modelComparisons ?? 0;
  const attached = model.activity?.attachedObservations ?? 0;
  const differences = model.activity?.differencesToReview ?? 0;
  const authority = model.decisions[0]?.authority ?? model.humanCheckpoint ?? "Not yet recorded";

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
              <p className={differences ? styles.attention : undefined}>{differences ? `${differences} difference${differences === 1 ? "" : "s"} need reviewing.` : "No differences identified in the metadata compared so far."}</p>
              <small>Observations describe recorded behaviour, not proof of every possible outcome.</small>
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
