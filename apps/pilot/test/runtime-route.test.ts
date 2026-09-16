import { describe, expect, it } from "vitest";
import { POST } from "../app/api/runtime-test/route";

const callRoute = async (body: Record<string, unknown>) => {
  const response = await POST(
    new Request("http://localhost/api/runtime-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return response.json() as Promise<Record<string, any>>;
};

describe("browser runtime test route", () => {
  it("builds a metadata-only workflow and review-required receipt proposal", async () => {
    const prompt = "PRIVATE_SYNTHETIC_WORKFLOW_INPUT";
    const result = await callRoute({ mode: "demo", scenario: "workflow", prompt });

    expect(result.ok).toBe(true);
    expect(result.scenario).toBe("workflow");
    expect(result.crux.promptCaptured).toBe(false);
    expect(result.crux.responseCaptured).toBe(false);
    expect(result.crux.events.map((event: { type: string }) => event.type)).toEqual([
      "ai_invocation",
      "human_review",
      "decision",
      "action_executed",
    ]);
    expect(result.workflow.trace.summary).toBe(
      "AI invocation → human review → decision → action executed",
    );
    expect(result.workflow.proposal.source_content_included).toBe(false);
    expect(
      result.workflow.proposal.questions_to_resolve.map(
        (question: { field: string }) => question.field,
      ),
    ).toEqual(
      expect.arrayContaining(["effect_of_ai", "final_authority", "outcome", "challenge"]),
    );
    expect(JSON.stringify(result.workflow)).not.toContain(prompt);
  });

  it("surfaces an intentional declared-versus-observed model divergence", async () => {
    const prompt = "PRIVATE_SYNTHETIC_DIVERGENCE_INPUT";
    const result = await callRoute({
      mode: "demo",
      scenario: "divergence",
      prompt,
      declaredModel: "demo-model-a",
    });

    expect(result.ok).toBe(true);
    expect(result.scenario).toBe("divergence");
    expect(result.crux.promptCaptured).toBe(false);
    expect(result.crux.responseCaptured).toBe(false);

    const provider = result.comparison.fields.find(
      (field: { field: string }) => field.field === "provider",
    );
    const model = result.comparison.fields.find(
      (field: { field: string }) => field.field === "model_identifier",
    );

    expect(provider).toMatchObject({
      declared: "demo-provider",
      observed: "demo-provider",
      status: "match",
    });
    expect(model).toMatchObject({
      declared: "demo-model-a",
      observed: "demo-model-b",
      status: "divergence",
    });
    expect(JSON.stringify(result.comparison)).not.toContain(prompt);
  });
});
