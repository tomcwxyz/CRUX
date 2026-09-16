import { describe, expect, it } from "vitest";
import { POST } from "../app/api/transport-test/route";

describe("browser transport boundary route", () => {
  it("demonstrates direct ingestion, replay, conflict rejection and OTLP content exclusion", async () => {
    const response = await POST();
    expect(response.status).toBe(200);

    const result = (await response.json()) as Record<string, any>;
    expect(result.ok).toBe(true);
    expect(result.format).toBe("crux-transport-browser-test/0.1");

    expect(result.direct.first.map((item: { status: string }) => item.status)).toEqual([
      "accepted",
      "accepted",
    ]);
    expect(result.direct.replay.map((item: { status: string }) => item.status)).toEqual([
      "already_present",
      "already_present",
    ]);
    expect(result.direct.conflict_rejected).toBe(true);
    expect(result.direct.content_policy_rejected).toBe(true);

    expect(result.otlp.producer.kind).toBe("otel_bridge");
    expect(result.otlp.event_count).toBe(1);
    expect(result.otlp.prompt_captured).toBe(false);
    expect(result.otlp.response_captured).toBe(false);
    expect(result.otlp.event_attributes).toMatchObject({
      provider: "browser-otel",
      request_model: "demo-model",
      response_model: "demo-model",
      input_tokens: 17,
      output_tokens: 5,
    });
    expect(result.otlp.acceptances.every((item: { status: string }) => item.status === "accepted")).toBe(true);
  });
});
