import type { CSSProperties } from "react";
import type { ReaderStep } from "../lib/reader-model";
import styles from "./process-flow.module.css";

type ProcessFlowProps = {
  steps: ReaderStep[];
  /** Larger hero presentation; both variants share the same safe flow rules. */
  prominent?: boolean;
};

/** A process is a series of steps. A human checkpoint is shown only if the
 * canonical reader model has a person directly following an AI step. */
export function ProcessFlow({ steps, prominent = false }: ProcessFlowProps) {
  return (
    <div className={styles.container}>
      <ol
        className={`${styles.flow} ${prominent ? styles.prominent : ""}`}
        style={{ "--step-count": steps.length } as CSSProperties}
        aria-label="How the work happens"
      >
        {steps.map((step, index) => {
          const aiHandsOff = steps[index + 1]?.aiStopsBefore === true && step.role === "ai";
          return (
            <li key={step.id} className={styles.item}>
              <article className={`${styles.step} ${styles[step.role]}`}>
                <span className={styles.role}>{step.roleLabel}</span>
                <strong className={styles.name}>{step.name}</strong>
                {step.description ? <p className={styles.description}>{step.description}</p> : null}
                {aiHandsOff ? <span className={styles.handoff}>AI stops here</span> : null}
              </article>
              {index > 0 ? (
                <span className={`${styles.connector} ${step.aiStopsBefore ? styles.humanHandoff : ""}`} aria-hidden="true">
                  <span>→</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
