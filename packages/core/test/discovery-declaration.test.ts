import { describe, expect, it } from "vitest";
import { createDiscoveryDeclaration } from "../src/discoveryDeclaration.js";
import { suggestAIUseCandidates } from "../src/discovery.js";

const report = {
  format: "crux-discovery/0.1" as const,
  generated_at: "2026-09-18T20:30:00.000Z",
  source: {
    kind: "source_code" as const,
    provider: "ship-check",
    label: "tomcwxyz/open-recs-local#master",
    external_ref: "https://github.com/tomcwxyz/open-recs-local",
  },
  signals: [
    {
      id: "flow",
      kind: "workflow_job" as const,
      label: "source.extract",
      confidence: "high" as const,
      workflow_hint: "source.extract",
      candidate_label: "Recommendation extraction",
      scope_hint: "use" as const,
      evidence: [{ path: "src/lib/jobs/handlers/extract.ts", detail: "workflow" }],
    },
    {
      id: "call",
      kind: "model_call" as const,
      label: "Structured generation through the project LLM provider",
      confidence: "high" as const,
      technology: "llm-provider",
      workflow_hint: "source.extract",
      candidate_label: "Recommendation extraction",
      scope_hint: "use" as const,
      evidence: [{ path: "src/lib/jobs/handlers/extract.ts", detail: "call" }],
    },
  ],
  limitations: [],
};

describe("createDiscoveryDeclaration", () => {
  it("turns human confirmation into an exact internal CRUX SystemVersion", () => {
    const candidate = suggestAIUseCandidates(report)[0]!;
    const declaration = createDiscoveryDeclaration({
      report,
      candidate,
      confirmation: {
        organisation_name: "Example Organisation",
        purpose: "Extract recommendations from reports for staff to review.",
        people_affected: ["staff", "organisations described in reports"],
        consequential: false,
        power: "recommend",
      },
      now: "2026-09-18T20:45:00.000Z",
    });

    expect(declaration.ai_use.purpose).toContain("Extract recommendations");
    expect(declaration.system.influence).toEqual(["advisory"]);
    expect(declaration.system.agency).toBe("none");
    expect(declaration.system.current_version_ref).toBe(declaration.system_version.id);
    expect(declaration.system_version.disclosure).toBe("internal");
    expect(declaration.system_version.process.nodes.map((node) => node.type)).toEqual([
      "input",
      "ai",
      "output",
    ]);
  });

  it("requires and represents a human gate when confirmed AI power is act", () => {
    const candidate = suggestAIUseCandidates(report)[0]!;
    const declaration = createDiscoveryDeclaration({
      report,
      candidate,
      confirmation: {
        organisation_name: "Example Organisation",
        purpose: "Send an approved follow-up.",
        people_affected: ["service users"],
        consequential: true,
        power: "act",
        action_control: "human_approval",
      },
      now: "2026-09-18T20:45:00.000Z",
    });

    expect(declaration.system.agency).toBe("human_approval_required");
    expect(declaration.system_version.human_roles).toHaveLength(1);
    expect(declaration.system_version.process.nodes.some((node) => node.type === "human")).toBe(true);
  });
});
