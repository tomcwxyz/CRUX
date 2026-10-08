import { describe, expect, it, vi } from "vitest";
import { redactBundle, validateBundleReferences } from "@crux/formats";
import { buildReaderModel } from "../lib/reader-model";
import {
  prepareBrowserDemo,
  reviewBrowserDemo,
  runBrowserDemo,
} from "../lib/browser-runtime-demo";
import { allowBrowserOnlyDemo, GET } from "../app/api/live-runtime/route";

const review = {
  aiSummary: "AI found information in a fictional application.",
  effectOfAi: "An officer considered the suggested passages.",
  humanInvolvement: "The officer checked the original document.",
  finalAuthority: "human" as const,
  outcome: "The officer made the fictional decision.",
  challengeDescription: "Contact the organisation to question this example.",
};

describe("database-free preview runtime example", () => {
  it("uses browser-only mode exclusively when a preview/dev deployment lacks the database", () => {
    expect(allowBrowserOnlyDemo(false, "preview")).toBe(true);
    expect(allowBrowserOnlyDemo(false, "development")).toBe(true);
    expect(allowBrowserOnlyDemo(false, "production")).toBe(false);
    expect(allowBrowserOnlyDemo(true, "preview")).toBe(false);
  });

  it("returns an explicit browser-only capability on preview without DATABASE_URL", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("DATABASE_URL", "");
    try {
      const response = await GET();
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, browser_demo_only: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("records real canonical metadata, not content, entirely in the bundle", () => {
    const initial = prepareBrowserDemo();
    expect(initial.runtime.run_count).toBe(0);
    expect(initial.bundle.receipts).toHaveLength(0);
    const state = runBrowserDemo(initial, "run:preview-test-a");
    expect(state.browser_only).toBe(true);
    expect(state.runtime.run_count).toBe(1);
    expect(state.runtime.latest_run_ref).toBe("run:preview-test-a");
    expect(state.bundle.events.map((event) => event.type)).toEqual([
      "ai_invocation", "human_review", "decision",
    ]);
    expect(state.bundle.runs[0]?.capture_mode).toBe("metadata_only");
    expect(state.bundle.events.every((event) => !("summary" in event))).toBe(true);
    expect(state.runtime.pending_case?.run_ref).toBe("run:preview-test-a");
    expect(state.runtime.comparisons[0]?.fields.some((field) =>
      field.status === "declared_unknown" && field.observed === "demo-model-b",
    )).toBe(true);
    expect(validateBundleReferences(state.bundle).valid).toBe(true);
  });

  it("requires the latest run and an explicit review before disclosure", () => {
    const first = runBrowserDemo(prepareBrowserDemo(), "run:preview-test-b");
    const before = buildReaderModel({
      kind: "disclosure", projection: redactBundle(first.bundle, "affected_party"),
    });
    expect(before.cases).toHaveLength(0);
    expect(() => reviewBrowserDemo(first, "run:unrelated", review)).toThrow(/no longer awaiting review/);
    const reviewed = reviewBrowserDemo(first, "run:preview-test-b", review);
    expect(reviewed.runtime.pending_case).toBeNull();
    expect(reviewed.runtime.reviewed_case?.run_ref).toBe("run:preview-test-b");
    expect(validateBundleReferences(reviewed.bundle).valid).toBe(true);
    const affected = buildReaderModel({
      kind: "disclosure", projection: redactBundle(reviewed.bundle, "affected_party"),
    });
    const publicly = buildReaderModel({
      kind: "disclosure", projection: redactBundle(reviewed.bundle, "public"),
    });
    expect(affected.cases.some((item) => item.outcome === review.outcome)).toBe(true);
    expect(publicly.cases).toHaveLength(0);
    const next = runBrowserDemo(reviewed, "run:preview-test-c");
    expect(next.runtime.reviewed_case).toBeNull();
    expect(next.runtime.pending_case?.run_ref).toBe("run:preview-test-c");
  });

  it("rejects empty confirmed outcomes rather than silently inventing them", () => {
    const state = runBrowserDemo(prepareBrowserDemo(), "run:preview-test-d");
    expect(() => reviewBrowserDemo(state, "run:preview-test-d", { ...review, outcome: " " }))
      .toThrow(/confirm the outcome/i);
  });
});
