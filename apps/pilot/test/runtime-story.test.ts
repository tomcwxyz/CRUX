import { describe, expect, it } from "vitest";
import { explainModelCheck, latestRunModelCheck, reviewStage } from "../lib/runtime-story";

const exampleChecks = [
  { runRef: "run:old", comparable: true, fields: [{ field: "model_identifier", status: "divergence" as const, declared: "old", observed: "new" }] },
  { runRef: "run:new", comparable: true, fields: [{ field: "model_identifier", status: "declared_unknown" as const, observed: "demo-model-b" }] },
];

describe("plain-language runtime story", () => {
  it("always compares the latest specific run, never an unrelated old run", () => {
    expect(latestRunModelCheck(exampleChecks, "run:new")?.runRef).toBe("run:new");
    expect(latestRunModelCheck(exampleChecks, "run:missing")).toBeNull();
  });

  it("treats unknown declarations as useful information, not a contradiction", () => {
    const check = explainModelCheck(exampleChecks[1]!);
    expect(check.kind).toBe("incomplete");
    expect(check.heading).toContain("something new");
    expect(check.rows[0]?.expected).toBe("Not recorded");
    expect(check.rows[0]?.seen).toBe("demo-model-b");
  });

  it("does not confuse matching model metadata with verified controls", () => {
    const check = explainModelCheck({
      comparable: true,
      fields: [{ field: "provider", status: "match", declared: "provider", observed: "provider" }],
    });
    expect(check.kind).toBe("match");
    expect(check.explanation).toContain("doesn't establish");
  });

  it("explains differences separately from missing comparisons", () => {
    const check = explainModelCheck(exampleChecks[0]!);
    expect(check.kind).toBe("attention");
    expect(check.rows[0]?.meaning).toContain("Different");
    expect(explainModelCheck(null).kind).toBe("missing");
  });

  it("requires a review linked to the exact latest run before showing its case", () => {
    expect(reviewStage(null, null, null)).toBe("no_run");
    expect(reviewStage("run:1", "run:1", null)).toBe("needs_review");
    expect(reviewStage("run:2", null, "run:1")).toBe("observed_without_case");
    expect(reviewStage("run:2", "run:2", "run:2")).toBe("reviewed");
  });
});
