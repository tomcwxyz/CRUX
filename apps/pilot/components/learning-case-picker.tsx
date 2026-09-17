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
  bundle: unknown;
};

const cases: LearningCase[] = [
  {
    id: "writing-assistant",
    name: "Writing assistant",
    label: "Low consequence · productivity",
    description: "AI suggests edits; staff remain responsible for what is sent or published.",
    bundle: writingAssistant,
  },
  {
    id: "funding-review",
    name: "Funding review",
    label: "Consequential · human decision",
    description: "AI identifies eligibility evidence; a funding officer retains final authority.",
    bundle: fundingReview,
  },
  {
    id: "bounded-action",
    name: "Bounded action",
    label: "Workflow · review → decision → action",
    description: "AI recommends a follow-up; staff review and approve before one bounded action executes.",
    bundle: boundedAction,
  },
];

const loadThroughExistingFilePath = (learningCase: LearningCase) => {
  const input = document.querySelector<HTMLInputElement>(
    'input[type="file"][accept*=".json"]',
  );

  if (!input) {
    throw new Error("The CRUX bundle loader is not available on this page.");
  }

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

export function LearningCasePicker() {
  const [loaded, setLoaded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (learningCase: LearningCase) => {
    try {
      loadThroughExistingFilePath(learningCase);
      setLoaded(learningCase.id);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this learning case.");
    }
  };

  return (
    <section className="panel" aria-labelledby="learning-cases-heading" style={{ marginBottom: 18 }}>
      <div className="kicker">Beta learning cases</div>
      <h2 id="learning-cases-heading" style={{ marginTop: 6 }}>Open a case in one click</h2>
      <p className="body-copy muted" style={{ maxWidth: 820 }}>
        These three fixtures are deliberately different. Use them to compare authoring, public and affected-person comprehension before changing the CRUX model.
      </p>

      <div className="grid" style={{ marginTop: 18 }}>
        {cases.map((learningCase) => (
          <article className="card" key={learningCase.id}>
            <div className="kicker">{learningCase.label}</div>
            <h3>{learningCase.name}</h3>
            <p className="small muted">{learningCase.description}</p>
            <button
              className={`btn ${loaded === learningCase.id ? "primary" : ""}`}
              type="button"
              onClick={() => load(learningCase)}
              style={{ marginTop: 10 }}
            >
              {loaded === learningCase.id ? "Loaded" : `Open ${learningCase.name}`}
            </button>
          </article>
        ))}
      </div>

      {error ? <div className="error-box" style={{ marginTop: 14 }}>{error}</div> : null}
    </section>
  );
}
