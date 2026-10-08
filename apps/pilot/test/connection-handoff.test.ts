import { describe, expect, it } from "vitest";
import { createDiscoveryDeclaration, suggestAIUseCandidates } from "@crux/core";
import { portableBundleFromDiscoveryDeclaration } from "@crux/formats";
import { DiscoveryReportSchema } from "@crux/schemas";
import openRecsJson from "../../../examples/discovery/open-recs.json";
import { parsePendingConnection, prepareDiscoveryForReview, parsePendingReviewRecord } from "../lib/connection-handoff";

const answers = {
  name: "Funding review", description: "AI helps check grant applications",
  organisation: "A foundation", peopleAffected: "Applicants",
  role: "recommend", control: "person", consequential: true,
} as const;

describe("temporary, explicit AI use handoff", () => {
  it("accepts a bounded recent description without evidence or credentials", () => {
    expect(parsePendingConnection(JSON.stringify({ createdAt: 1_000, answers }), 2_000)).toEqual(answers);
  });
  it("rejects expired, malformed and oversize information", () => {
    expect(parsePendingConnection(JSON.stringify({ createdAt: 1_000, answers }), 2_000_000)).toBeNull();
    expect(parsePendingConnection("{bad")).toBeNull();
    expect(parsePendingConnection("x".repeat(20_000))).toBeNull();
  });
  it("never accepts an unrecognised AI authority category", () => {
    expect(parsePendingConnection(JSON.stringify({ createdAt: 1_000, answers: { ...answers, control: "admin" } }), 2_000)).toBeNull();
  });
});

describe("discovery review continuity", () => {
  it("preserves the exact discovered version and adds only an internal declaration for evidence", () => {
    const report = DiscoveryReportSchema.parse(openRecsJson);
    const candidate = suggestAIUseCandidates(report)[0]!;
    const confirmed = createDiscoveryDeclaration({
      report, candidate, now: "2026-10-08T12:00:00.000Z",
      confirmation: {
        organisation_name: "Example",
        purpose: "Help staff review documents.",
        people_affected: ["staff"],
        consequential: false,
        power: "recommend",
        decision_authority: "human",
      },
    });
    const bundle = portableBundleFromDiscoveryDeclaration(confirmed);
    expect(bundle.claims).toHaveLength(0);
    const prepared = prepareDiscoveryForReview(bundle);
    expect(prepared.system_versions[0]?.id).toBe(confirmed.system_version_ref);
    expect(prepared.claims).toHaveLength(1);
    expect(prepared.claims[0]?.statement).toBe("Help staff review documents.");
    expect(prepared.claims[0]?.disclosure).toBe("internal");
    expect(prepared.events).toHaveLength(0);
    expect(prepared.evidence).toHaveLength(0);
    const raw = JSON.stringify({ createdAt: 1_000, bundle: prepared });
    expect(parsePendingReviewRecord(raw, 2_000)?.system_versions[0]?.id).toBe(confirmed.system_version_ref);
    expect(parsePendingReviewRecord(raw, 2_000_000)).toBeNull();
  });
});
