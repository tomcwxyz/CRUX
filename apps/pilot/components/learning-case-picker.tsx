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
    signals: ["Declared claim", "No linked evidence", "No receipt"],
    suggestedLens: "Start with the public view: can a reader understand assistance without over-interpreting the unevidenced claim?",
    bundle: writingAssistant,
  },
  {
    id: "funding-review",
    name: "Funding review",
    label: "Consequential · human decision",
    description: "AI identifies eligibility evidence; a funding officer retains final authority.",
    signals: ["Evidence-backed control", "Human authority", "Affected-person receipt"],
    suggestedLens: "Use the affected-person view: can a reader see what AI contributed, who decided, and how to challenge the outcome?",
    bundle: fundingReview,
  },
  {
    id: "bounded-action",
    name: "Bounded action",
    label: "Workflow · review → decision → action",
    description: "AI recommends a follow-up; staff review and approve before one bounded action executes.",
    signals: ["Evidence-backed control", "Bounded action", "Runtime receipt"],
    suggestedLens: "Compare working and affected-person views: can a reader separate observed behaviour from organisational authority?",
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

const focusWorkbench = () => {
  window.requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>('[aria-label="CRUX pilot workbench"]')
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      <div className="kicker">Beta learning cases</div>
      <h2 id="learning-cases-heading" style={{ marginTop: 6 }}>Open a case in one click</h2>
      <p className="body-copy muted" style={{ maxWidth: 820 }}>
        These cases are deliberately different. The contrast matters: one exposes an organisational declaration without linked evidence, one tests evidence-backed human decision authority, and one tests a bounded action with runtime provenance.
      </p>

      <div className="grid" style={{ marginTop: 18 }}>
        {cases.map((learningCase) => (
          <article className="card" key={learningCase.id}>
            <div className="kicker">{learningCase.label}</div>
            <h3>{learningCase.name}</h3>
            <p className="small muted">{learningCase.description}</p>
            <div className="pill-row">
              {learningCase.signals.map((signal) => (
                <span className="pill" key={signal}>{signal}</span>
              ))}
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              <strong>Try:</strong> {learningCase.suggestedLens}
            </p>
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
