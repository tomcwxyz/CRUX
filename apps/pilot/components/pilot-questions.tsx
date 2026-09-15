import type { CruxPortableBundle } from "@crux/formats";
import { getPilotQuestions } from "../lib/questions";

const kindLabel = {
  missing: "Missing",
  declared_only: "Declared only",
  consider: "Consider",
} as const;

export function PilotQuestions({
  bundle,
  systemVersionId,
}: {
  bundle: CruxPortableBundle;
  systemVersionId: string;
}) {
  const questions = getPilotQuestions(bundle, systemVersionId);

  if (questions.length === 0) {
    return (
      <div className="notice" style={{ marginBottom: 18 }}>
        No obvious transparency gaps are flagged by the pilot prompts. This is not a score or assurance result; the record still needs human review and comprehension testing.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="kicker">Questions to resolve</div>
      <p className="small muted">
        These prompts point to missing or deliberately unevidenced information. They do not rate the system or organisation.
      </p>
      {questions.map((question) => (
        <div className="claim" key={question.id}>
          <div className={`claim-status ${question.kind === "missing" ? "contradicted" : "declared"}`}>
            {kindLabel[question.kind]}
          </div>
          <div>
            <div className="claim-text">{question.title}</div>
            <div className="reason">{question.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
