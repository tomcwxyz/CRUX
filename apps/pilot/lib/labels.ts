import type { AIInfluence, Decision, EvidenceKind } from "@crux/schemas";

// One source of plain-language wording for canonical enum values, so readers
// never see raw schema values such as "human" or "system_configuration".

type Option<Value extends string> = { value: Value; label: string };

export const authorityOptions: Array<Option<Decision["authority"]>> = [
  { value: "human", label: "A person" },
  { value: "hybrid", label: "A person and an automated rule/system together" },
  { value: "rule", label: "A fixed rule" },
  { value: "ai", label: "The AI system" },
  { value: "external", label: "Someone or something outside this system" },
];

export const influenceOptions: Array<Option<AIInfluence>> = [
  { value: "assistive", label: "Draft or transform" },
  { value: "informational", label: "Find or surface information" },
  { value: "advisory", label: "Recommend" },
  { value: "conditional", label: "Influence what happens next" },
  { value: "decisional", label: "Contribute directly to a decision" },
];

export const evidenceKindOptions: Array<Option<EvidenceKind>> = [
  { value: "human_review", label: "Human review" },
  { value: "evaluation", label: "Evaluation or test" },
  { value: "system_configuration", label: "System configuration" },
  { value: "production_observation", label: "Production observation" },
  { value: "audit", label: "Audit" },
  { value: "assurance", label: "Assurance" },
  { value: "incident", label: "Incident" },
  { value: "receipt", label: "Outcome / receipt" },
  { value: "policy", label: "Policy or organisational record" },
  { value: "research", label: "Research" },
  { value: "other", label: "Other" },
];

export type ActionControl = "human_approval" | "rule_bounded" | "automatic_bounded";

export const actionControlOptions: Array<Option<ActionControl>> = [
  { value: "human_approval", label: "A person must approve it" },
  { value: "rule_bounded", label: "A rule bounds when it can happen" },
  { value: "automatic_bounded", label: "It can happen automatically within defined limits" },
];

// Imported or projected records are typed as plain strings in some view models,
// so fall back to readable text rather than failing on an unexpected value.
const labelFrom = (options: Array<Option<string>>, value: string) =>
  options.find((option) => option.value === value)?.label ?? value.replaceAll("_", " ");

export const authorityLabel = (value: string) => labelFrom(authorityOptions, value);
export const influenceLabel = (value: string) => labelFrom(influenceOptions, value);
export const evidenceKindLabel =(value: string) => labelFrom(evidenceKindOptions, value);
export const actionControlLabel = (value: string) => labelFrom(actionControlOptions, value);
