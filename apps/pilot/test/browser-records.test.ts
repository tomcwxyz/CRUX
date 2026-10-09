import { describe, expect, it } from "vitest";
import { createStarterBundle } from "../lib/starter";
import { appendManualEvidence } from "../lib/authoring";
import {
  browserRecordLabel, deleteBrowserRecord, parseBrowserRecords, putBrowserRecord,
  readBrowserRecords, reviewSignals,
} from "../lib/browser-records";
import { parsePendingBrowserRecord } from "../lib/connection-handoff";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("opt-in browser saved records", () => {
  it("starts empty, saves only on request, and can reopen exact evidence and version", () => {
    const store = storage();
    const draft = createStarterBundle();
    expect(readBrowserRecords(store)).toEqual([]);
    const first = putBrowserRecord(store, draft, undefined, "2026-10-09T09:00:00.000Z", () => "record-a");
    expect(first.id).toBe("record-a");
    expect(readBrowserRecords(store)).toHaveLength(1);
    expect(browserRecordLabel(first)).toBe(draft.ai_uses[0]!.name);
    const loaded = readBrowserRecords(store)[0]!.bundle;
    expect(loaded.system_versions[0]?.id).toBe(draft.system_versions[0]?.id);
    expect(loaded.claims).toEqual(draft.claims);
    expect(loaded.events).toEqual(draft.events);
  });

  it("updates one saved record without overwriting another starter record with the same canonical IDs", () => {
    const store = storage();
    const first = createStarterBundle();
    const second = createStarterBundle();
    second.ai_uses[0]!.name = "Different AI use";
    putBrowserRecord(store, first, undefined, "2026-10-09T09:00:00.000Z", () => "one");
    putBrowserRecord(store, second, undefined, "2026-10-09T09:01:00.000Z", () => "two");
    const altered = appendManualEvidence(first, first.claims[0]!.id, {
      kind: "human_review", summary: "We checked one case",
      relationship: "qualifies", disclosure: "internal",
    }).bundle;
    const changed = putBrowserRecord(store, altered, "one", "2026-10-09T09:02:00.000Z");
    expect(changed.changesSinceLastSave).toContain("Evidence was added or removed");
    expect(readBrowserRecords(store)).toHaveLength(2);
    expect(readBrowserRecords(store).find((record) => record.id === "two")?.bundle.ai_uses[0]?.name).toBe("Different AI use");
    expect(readBrowserRecords(store).find((record) => record.id === "one")?.bundle.evidence).toHaveLength(1);
  });

  it("never silently creates an alternative when the saved identity was removed", () => {
    const store = storage();
    const draft = createStarterBundle();
    putBrowserRecord(store, draft, undefined, "2026-10-09T09:00:00.000Z", () => "one");
    deleteBrowserRecord(store, "one");
    expect(readBrowserRecords(store)).toEqual([]);
    expect(() => putBrowserRecord(store, draft, "one")).toThrow("no longer in this browser");
  });

  it("does not overwrite damaged, oversized or invalid saved data", () => {
    const store = storage();
    store.setItem("crux:browser-records:v1", "{broken");
    expect(() => putBrowserRecord(store, createStarterBundle())).toThrow("damaged");
    expect(store.getItem("crux:browser-records:v1")).toBe("{broken");
    expect(() => parseBrowserRecords("x".repeat(2_000_100))).toThrow("limit");
    const invalid = createStarterBundle();
    invalid.systems[0]!.current_version_ref = "system-version:missing";
    expect(() => putBrowserRecord(storage(), invalid)).toThrow("broken references");
  });

  it("surfaces only grounded review prompts, without pretending to check live systems", () => {
    const starter = createStarterBundle();
    const signals = reviewSignals(starter);
    expect(signals.actions.some((action) => action.includes("no evidence"))).toBe(true);
    expect(signals.actions).toContain("No linked runtime observations in this record");
    expect(signals).not.toHaveProperty("trustScore");
    const evidence = appendManualEvidence(starter, starter.claims[0]!.id, {
      kind: "human_review", summary: "Our team reviewed the workflow",
      relationship: "supports", disclosure: "internal",
    }).bundle;
    expect(reviewSignals(evidence).actions.some((action) => action.includes("no evidence"))).toBe(false);
  });

  it("only reopens validated one-time record handoffs", () => {
    const bundle = createStarterBundle();
    const raw = JSON.stringify({ createdAt: 1_000, id: "local-1", bundle });
    expect(parsePendingBrowserRecord(raw, 2_000)?.bundle.system_versions).toEqual(bundle.system_versions);
    expect(parsePendingBrowserRecord(raw, 2_000_000)).toBeNull();
    expect(parsePendingBrowserRecord("{broken")).toBeNull();
    expect(parsePendingBrowserRecord(JSON.stringify({ createdAt: 1_000, id: "local-1", bundle: {} }), 2_000)).toBeNull();
  });
});
