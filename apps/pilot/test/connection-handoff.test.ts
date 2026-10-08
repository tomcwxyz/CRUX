import { describe, expect, it } from "vitest";
import { parsePendingConnection } from "../lib/connection-handoff";

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
