import type { EvaluationCase, Receipt } from "@crux/schemas";

export const proposeEvaluationCaseFromReceipt = ({
  id,
  receipt,
  title,
  scenarioSummary,
  learningQuestion,
  expectedBehaviour,
  fixtureRef,
  evaluationDefinitionRefs = [],
  createdAt,
}: {
  id: string;
  receipt: Receipt;
  title: string;
  scenarioSummary: string;
  learningQuestion: string;
  expectedBehaviour?: string;
  fixtureRef?: string;
  evaluationDefinitionRefs?: string[];
  createdAt: string;
}): EvaluationCase => ({
  schema_version: "0.1",
  id,
  source: {
    kind: "receipt",
    ref: receipt.id,
  },
  system_version_ref: receipt.system_version_ref,
  title,
  scenario_summary: scenarioSummary,
  learning_question: learningQuestion,
  ...(expectedBehaviour ? { expected_behaviour: expectedBehaviour } : {}),
  ...(fixtureRef ? { fixture_ref: fixtureRef } : {}),
  evaluation_definition_refs: evaluationDefinitionRefs,
  status: "proposed",
  disclosure: "internal",
  created_at: createdAt,
});
