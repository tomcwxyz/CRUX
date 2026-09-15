import type { CruxPortableBundle } from "@crux/formats";
import type { AIInfluence, Decision, DisclosureLevel } from "@crux/schemas";

export type ManualReceiptInput = {
  aiInvolvement: AIInfluence[];
  aiSummary: string;
  effectOfAI: string;
  humanInvolvement?: string;
  finalAuthority: Decision["authority"];
  outcome: string;
  decisionId?: string;
  challengeDescription?: string;
  disclosure?: DisclosureLevel;
};

const nextReceiptNumber = (bundle: CruxPortableBundle) => {
  let number = bundle.receipts.length + 1;
  const runIds = new Set(bundle.runs.map((item) => item.id));
  const traceIds = new Set(bundle.traces.map((item) => item.id));
  const receiptIds = new Set(bundle.receipts.map((item) => item.id));
  const eventIds = new Set(bundle.events.map((item) => item.id));

  while (
    runIds.has(`run:manual-${number}`) ||
    traceIds.has(`trace:manual-${number}`) ||
    receiptIds.has(`receipt:manual-${number}`) ||
    eventIds.has(`event:manual-${number}-ai`)
  ) {
    number += 1;
  }
  return number;
};

const requiredText = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  return trimmed;
};

export const appendManualReceipt = (
  bundle: CruxPortableBundle,
  systemVersionId: string,
  input: ManualReceiptInput,
  now = new Date().toISOString(),
): { bundle: CruxPortableBundle; receiptId: string } => {
  const next = structuredClone(bundle);
  const version = next.system_versions.find((item) => item.id === systemVersionId);
  if (!version) throw new Error(`Cannot add receipt: system version ${systemVersionId} was not found.`);
  if (input.aiInvolvement.length === 0) throw new Error("Record at least one kind of AI involvement.");

  const decision = input.decisionId
    ? version.decisions.find((item) => item.id === input.decisionId)
    : undefined;
  if (input.decisionId && !decision) {
    throw new Error(`Cannot add receipt: decision ${input.decisionId} was not found in this system version.`);
  }

  const aiSummary = requiredText(input.aiSummary, "AI contribution");
  const effectOfAI = requiredText(input.effectOfAI, "Effect of AI");
  const outcome = requiredText(input.outcome, "Outcome");
  const humanInvolvement = input.humanInvolvement?.trim() || undefined;
  if (["human", "hybrid"].includes(input.finalAuthority) && !humanInvolvement) {
    throw new Error("Describe the human involvement when final authority is human or hybrid.");
  }

  const challengeDescription = input.challengeDescription?.trim() || undefined;
  const disclosure = input.disclosure ?? "affected_party";
  const number = nextReceiptNumber(next);
  const runId = `run:manual-${number}`;
  const traceId = `trace:manual-${number}`;
  const receiptId = `receipt:manual-${number}`;
  const aiEventId = `event:manual-${number}-ai`;
  const reviewEventId = `event:manual-${number}-review`;
  const decisionEventId = `event:manual-${number}-decision`;
  const aiNode = version.process.nodes.find((node) => node.type === "ai");
  const humanRoleRef = decision?.responsible_role_refs[0] ?? version.human_roles[0]?.id;
  const decisionNode = decision
    ? version.process.nodes.find(
        (node) => node.type === "decision" && node.decision_ref === decision.id,
      )
    : undefined;

  next.runs.push({
    schema_version: "0.1",
    id: runId,
    system_version_ref: version.id,
    started_at: now,
    completed_at: now,
    status: "completed",
    capture_mode: "metadata_only",
    disclosure: "internal",
    external_refs: [],
  });

  next.events.push({
    schema_version: "0.1",
    id: aiEventId,
    run_ref: runId,
    sequence: 1,
    occurred_at: now,
    type: "ai_invocation",
    ...(aiNode ? { process_node_ref: aiNode.id, component_ref: aiNode.component_ref } : {}),
    summary: aiSummary,
    attributes: {},
    disclosure,
  });

  const steps: CruxPortableBundle["traces"][number]["steps"] = [
    { event_ref: aiEventId, relationship_to_previous: "starts" },
  ];
  let sequence = 2;

  if (humanInvolvement) {
    next.events.push({
      schema_version: "0.1",
      id: reviewEventId,
      run_ref: runId,
      sequence,
      occurred_at: now,
      type: "human_review",
      ...(humanRoleRef ? { human_role_ref: humanRoleRef } : {}),
      summary: humanInvolvement,
      attributes: {},
      disclosure,
    });
    steps.push({ event_ref: reviewEventId, relationship_to_previous: "reviews" });
    sequence += 1;
  }

  next.events.push({
    schema_version: "0.1",
    id: decisionEventId,
    run_ref: runId,
    sequence,
    occurred_at: now,
    type: "decision",
    ...(decision ? { decision_ref: decision.id } : {}),
    ...(decisionNode ? { process_node_ref: decisionNode.id } : {}),
    ...(humanRoleRef && ["human", "hybrid"].includes(input.finalAuthority)
      ? { human_role_ref: humanRoleRef }
      : {}),
    summary: outcome,
    attributes: {},
    disclosure,
  });
  steps.push({ event_ref: decisionEventId, relationship_to_previous: "decides" });

  next.traces.push({
    schema_version: "0.1",
    id: traceId,
    run_ref: runId,
    system_version_ref: version.id,
    generated_at: now,
    steps,
    summary: `${aiSummary} ${effectOfAI}`,
    disclosure,
  });

  const inheritedChallenge = decision?.challenge?.available ? decision.challenge : undefined;
  const challenge = challengeDescription
    ? { available: true as const, description: challengeDescription }
    : inheritedChallenge
      ? structuredClone(inheritedChallenge)
      : undefined;

  next.receipts.push({
    schema_version: "0.1",
    id: receiptId,
    run_ref: runId,
    trace_ref: traceId,
    system_version_ref: version.id,
    occurred_at: now,
    ai_involvement: [...input.aiInvolvement],
    ai_summary: aiSummary,
    effect_of_ai: effectOfAI,
    ...(humanInvolvement ? { human_involvement: humanInvolvement } : {}),
    final_authority: input.finalAuthority,
    outcome,
    ...(challenge ? { challenge } : {}),
    source_content_included: false,
    disclosure,
    external_refs: [],
  });

  next.generated_at = now;
  return { bundle: next, receiptId };
};
