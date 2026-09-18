"use client";

import { useState } from "react";
import writingAssistant from "../../../examples/writing-assistant/crux.json";
import fundingReview from "../../../examples/funding-review/crux.json";
import boundedAction from "../../../examples/bounded-action/crux.json";

type LearningCase = {
  id: string;
  name: string;
  label: string;
  description: string;
  signals: string[];
  suggestedLens: string;
  bundle: unknown;
};

const cases: LearningCase[] = [
  {
    id: "writing-assistant",
    name: "Writing assistant",
    label: "Low consequence · productivity",
    description: "AI suggests edits; staff remain responsible for what is sent or published.",
    signals: ["SAYS: staff remain responsible", "SHOWS: nothing linked yet", "HAPPENED: not needed"],
    suggestedLens: "Start with Where is AI? and What power does it have? Notice that an ordinary assistive use can stay lightweight.",
    bundle: writingAssistant,
  },
  {
    id: "funding-review",
    name: "Funding review",
    label: "Consequential · human decision",
    description: "AI identifies eligibility evidence; a funding officer retains final authority.",
    signals: ["SAYS: AI cannot reject", "SHOWS: control evidence", "HAPPENED: one case"],
    suggestedLens: "Follow all four questions. This is the main teaching example for separating AI contribution, human authority, evidence and a specific outcome.",
    bundle: fundingReview,
  },
  {
    id: "bounded-action",
    name: "Bounded action",
    label: "Workflow · review → decision → action",
    description: "AI recommends a follow-up; staff review and approve before one bounded action executes.",
    signals: ["SAYS: action is bounded", "SHOWS: configuration evidence", "HAPPENED: runtime case"],
    suggestedLens: "Focus on What power does it have? Then compare SHOWS with HAPPENED: a control is different from evidence of one execution.",
    bundle: boundedAction,
  },
];

const loadThroughExistingFilePath = (learningCase: LearningCase) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*=".json"]');
  if (!input) throw new Error("The CRUX record loader is not available on this page.");

  const file = new File(
    [`${JSON.stringify(learningCase.bundle, null, 2)}\n`],
    `${learningCase.id}-crux.json`,
    { type: "application/json" },
  );
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const focusWorkbench = () => {
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[aria-label="CRUX pilot workbench"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
};

export function LearningCasePicker() {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (learningCase: LearningCase) => {
    try {
      loadThroughExistingFilePath(learningCase);
      setLoaded(learningCase.id);
      setError(null);
      focusWorkbench();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this learning case.");
    }
  };

  return (
    <section className="panel" aria-labelledby="learning-cases-heading" style={{ marginBottom: 18 }}>
      <div className="kicker">Learn the questions through examples</div>
      <h2 id="learning-cases-heading" style={{ marginTop: 6 }}>Three different kinds of AI use</h2>
      <p className="body-copy muted" style={{ maxWidth: 840 }}>
        Do not start by learning CRUX terminology. Open a case and ask four ordinary questions: where is AI involved, what power does it have, why should you believe what is said, and what happened in a specific case?
      </p>

      <div className="grid" style={{ marginTop: 18 }}>
        {cases.map((learningCase) => (
          <article className="card" key={learningCase.id}>
            <div className="kicker">{learningCase.label}</div>
            <h3>{learningCase.name}</h3>
            <p className="small muted">{learningCase.description}</p>
            <div className="example-signals">
              {learningCase.signals.map((signal) => {
                const [prefix, ...rest] = signal.split(":");
                return <div key={signal}><strong>{prefix}</strong><span>{rest.join(":").trim()}</span></div>;
              })}
            </div>
            <p className="small muted" style={{ marginTop: 14 }}><strong>Try:</strong> {learningCase.suggestedLens}</p>
            <button className={`btn ${loaded === learningCase.id ? "primary" : ""}`} type="button" onClick={() => load(learningCase)} style={{ marginTop: 10 }}>
              {loaded === learningCase.id ? "Loaded" : `Open ${learningCase.name}`}
            </button>
          </article>
        ))}
      </div>

      {error ? <div className="error-box" style={{ marginTop: 14 }}>{error}</div> : null}
    </section>
  );
}
