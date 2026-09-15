import assert from "node:assert/strict";
import {
  compareDeclaredAndObservedModel,
  createInstrumentationSession,
  recordOpenTelemetryGenAI,
} from "../dist/index.js";

const systemVersion = {
  schema_version: "0.1",
  id: "system-version:eligibility-triage:2.3",
  system_ref: "system:eligibility-triage",
  version: "2.3",
  effective_from: "2026-09-15T00:00:00Z",
  process: {
    id: "process:eligibility-triage",
    name: "Eligibility triage",
    nodes: [
      {
        id: "node:eligibility-ai",
        type: "ai",
        name: "AI eligibility review",
        component_ref: "component:eligibility-model",
        purpose: "Identify evidence relevant to basic eligibility criteria.",
        disclosure: "public",
      },
      {
        id: "node:eligibility-review",
        type: "human",
        name: "Funding officer review",
        human_role_ref: "role:funding-officer",
        disclosure: "public",
      },
      {
        id: "node:eligibility-decision",
        type: "decision",
        name: "Eligibility decision",
        decision_ref: "decision:eligibility",
        disclosure: "public",
      },
      {
        id: "node:eligibility-action",
        type: "action",
        name: "Progress or reject application",
        action_ref: "action:eligibility-outcome",
        disclosure: "public",
      },
    ],
    edges: [
      { from: "node:eligibility-ai", to: "node:eligibility-review", carries: [] },
      { from: "node:eligibility-review", to: "node:eligibility-decision", carries: [] },
      { from: "node:eligibility-decision", to: "node:eligibility-action", carries: [] },
    ],
  },
  components: [
    {
      id: "component:eligibility-model",
      kind: "model",
      name: "Eligibility model",
      provider: { status: "known", value: "provider-a" },
      model_identifier: { status: "known", value: "model-a" },
      externally_provided: true,
      disclosure: "internal",
      external_refs: [],
    },
  ],
  data_sources: [],
  human_roles: [
    {
      id: "role:funding-officer",
      name: "Funding officer",
      responsibilities: ["Review the original application and make the eligibility decision."],
      can_override_ai: true,
      sees_original_source: true,
      disclosure: "public",
    },
  ],
  decisions: [
    {
      id: "decision:eligibility",
      name: "Eligibility decision",
      consequence: "Determines whether the application progresses to assessment.",
      authority: "human",
      ai_influence: ["advisory"],
      review_before_effect: true,
      responsible_role_refs: ["role:funding-officer"],
      challenge: {
        available: true,
        description: "The applicant can contact the grants team to query the eligibility decision.",
      },
      disclosure: "public",
    },
  ],
  actions: [
    {
      id: "action:eligibility-outcome",
      name: "Progress or reject application",
      description: "Apply the human eligibility decision to the application workflow.",
      initiated_by: "human",
      human_approval_required: true,
      reversibility: "yes",
      scope: {
        summary: "Only changes the application's eligibility status.",
        limits: {},
      },
      disclosure: "public",
    },
  ],
  risks: [],
  safeguards: [],
  disclosure: "public",
  external_refs: [],
};

const crux = createInstrumentationSession({
  runId: "run:eligibility-example-001",
  systemVersionRef: systemVersion.id,
  startedAt: "2026-09-15T15:00:00Z",
});

// Simulate the metadata emitted by an existing GenAI telemetry layer. The
// requested model was model-a, but the provider actually returned model-b.
const modelEvent = recordOpenTelemetryGenAI(
  crux,
  {
    occurredAt: "2026-09-15T15:00:01Z",
    attributes: {
      "gen_ai.operation.name": "chat",
      "gen_ai.provider.name": "provider-a",
      "gen_ai.request.model": "model-a",
      "gen_ai.response.model": "model-b",
      "gen_ai.response.id": "response-example-001",
      "gen_ai.usage.input_tokens": 180,
      "gen_ai.usage.output_tokens": 34,
      // These deliberately prove the allow-list does not copy content.
      "gen_ai.input.messages": "SENSITIVE APPLICATION CONTENT",
      "gen_ai.output.messages": "SENSITIVE MODEL OUTPUT",
    },
  },
  {
    componentRef: "component:eligibility-model",
    processNodeRef: "node:eligibility-ai",
  },
);

crux.record({
  type: "human_review",
  occurredAt: "2026-09-15T15:00:10Z",
  processNodeRef: "node:eligibility-review",
  humanRoleRef: "role:funding-officer",
  summary: "Funding officer reviewed the original application and eligibility rules.",
  disclosure: "affected_party",
});

crux.record({
  type: "decision",
  occurredAt: "2026-09-15T15:00:20Z",
  processNodeRef: "node:eligibility-decision",
  decisionRef: "decision:eligibility",
  humanRoleRef: "role:funding-officer",
  summary: "Funding officer decided that the application was eligible.",
  disclosure: "affected_party",
});

crux.record({
  type: "action_executed",
  occurredAt: "2026-09-15T15:00:21Z",
  processNodeRef: "node:eligibility-action",
  actionRef: "action:eligibility-outcome",
  humanRoleRef: "role:funding-officer",
  summary: "Application progressed to assessment.",
  disclosure: "affected_party",
});

crux.finish("completed", "2026-09-15T15:00:22Z");

const snapshot = crux.snapshot();
const comparison = compareDeclaredAndObservedModel(systemVersion, modelEvent);
const serialised = JSON.stringify(snapshot);

assert.equal(snapshot.run.capture_mode, "metadata_only");
assert.deepEqual(snapshot.events.map((event) => event.type), [
  "ai_invocation",
  "human_review",
  "decision",
  "action_executed",
]);
assert.equal(comparison.fields.find((field) => field.field === "model_identifier")?.status, "divergence");
assert.equal(serialised.includes("SENSITIVE APPLICATION CONTENT"), false);
assert.equal(serialised.includes("SENSITIVE MODEL OUTPUT"), false);

console.log("CRUX instrumentation pipeline dogfood passed.");
console.log(JSON.stringify({
  run: snapshot.run.id,
  events: snapshot.events.map((event) => event.type),
  declaredObserved: comparison,
}, null, 2));
