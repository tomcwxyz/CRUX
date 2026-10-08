import type { CruxPortableBundle } from "@crux/formats";
import type { ProcessNode } from "@crux/schemas";
import { createStarterBundle } from "./starter";

export type SimpleRole = "assist" | "recommend" | "decide" | "act" | "unsure";
export type SimpleControl = "person" | "ai" | "rule" | "unsure";

export type SimpleUseAnswers = {
  name: string;
  description: string;
  organisation: string;
  role: SimpleRole;
  control: SimpleControl;
  consequential: boolean;
  peopleAffected: string;
};

/** Real agency/authority is never inferred from a name or a text description. */
export function needsDetailedAuthoring(answers: SimpleUseAnswers): boolean {
  return answers.role === "decide"
    || answers.role === "act"
    || answers.role === "unsure"
    || answers.control !== "person";
}

export function makeSimpleAIUseRecord(
  answers: SimpleUseAnswers,
  now = new Date().toISOString(),
): CruxPortableBundle {
  const name = answers.name.trim();
  const description = answers.description.trim();
  if (!name || !description) throw new Error("Name and description are required.");
  if (needsDetailedAuthoring(answers)) {
    throw new Error("Before creating this record, confirm the AI's powers and any action limits in the detailed editor.");
  }

  const bundle = createStarterBundle(now);
  const organisation = bundle.organisations[0]!;
  const use = bundle.ai_uses[0]!;
  const system = bundle.systems[0]!;
  const version = bundle.system_versions[0]!;
  const primaryClaim = bundle.claims[0]!;
  const humanRole = version.human_roles[0]!;

  organisation.name = answers.organisation.trim() || "Organisation not named";
  organisation.description = "";
  use.name = name;
  use.purpose = description;
  use.public_summary = description;
  use.people_affected = answers.peopleAffected.trim() ? [answers.peopleAffected.trim()] : [];
  use.consequential = answers.consequential;
  system.name = name;
  system.description = description;
  system.influence = answers.role === "assist"
    ? ["assistive"]
    : answers.role === "recommend" ? ["advisory"] : ["decisional"];
  // This short path covers help, recommendations and decisions. Autonomous actions
  // require a fuller description of action boundaries and are never guessed.
  system.agency = "none";
  version.process.name = name;
  version.process.description = description;
  version.components[0]!.purpose = description;

  const nodes: ProcessNode[] = [
    { id: "node:input", type: "input", name: "Information enters the process", disclosure: "public" },
    {
      id: "node:ai",
      type: "ai",
      name: answers.role === "assist" ? "AI helps with the work" : answers.role === "recommend" ? "AI makes a recommendation" : "AI makes a decision",
      component_ref: version.components[0]!.id,
      purpose: description,
      disclosure: "public",
    },
  ];

  if (answers.control === "person") {
    humanRole.name = "Person responsible";
    humanRole.responsibilities = ["Reviews or decides how the AI contribution is used."];
    nodes.push({
      id: "node:human", type: "human", name: "A person reviews the AI's contribution",
      human_role_ref: humanRole.id, disclosure: "public",
    });
  } else {
    // Do not invent a human reviewer when none was reported.
    version.human_roles = [];
  }

  if (answers.consequential || answers.role === "decide") {
    if (answers.control !== "unsure") {
      const authority = answers.control === "person" ? "human" : answers.control === "ai" ? "ai" : "rule";
      version.decisions = [{
        id: "decision:primary",
        name: "Decision affecting what happens next",
        consequence: answers.peopleAffected.trim() || "The effect of this decision needs to be recorded.",
        authority,
        ai_influence: [...system.influence],
        review_before_effect: answers.control === "person",
        responsible_role_refs: answers.control === "person" ? [humanRole.id] : [],
        disclosure: "public",
      }];
      nodes.push({
        id: "node:decision", type: "decision", name: "A decision is made",
        decision_ref: "decision:primary", disclosure: "public",
      });
    }
    // Unknown authority remains unknown, not converted into a made-up human decision.
  } else {
    version.decisions = [];
  }

  nodes.push({ id: "node:output", type: "output", name: "Work continues", disclosure: "public" });
  version.process.nodes = nodes;
  version.process.edges = nodes.slice(1).map((node, index) => ({
    from: nodes[index]!.id, to: node.id, carries: [],
  }));
  version.actions = [];
  version.published_at = undefined;

  primaryClaim.statement = description;
  primaryClaim.applies_to = [{ kind: "system_version", ref: version.id }];
  bundle.claims = [primaryClaim];

  if (answers.control !== "unsure" && (answers.consequential || answers.role === "decide")) {
    const controlStatement = answers.control === "person"
      ? "A person makes the final decision."
      : answers.control === "ai"
        ? "AI makes the decision."
        : "A defined rule determines the decision.";
    bundle.claims.push({
      ...primaryClaim,
      id: "claim:control",
      statement: controlStatement,
      applies_to: [{ kind: "system_version", ref: version.id }],
    });
  }
  return bundle;
}

export function evidenceTarget(bundle: CruxPortableBundle): string | undefined {
  return bundle.claims.find((claim) => claim.id === "claim:control")?.id
    ?? bundle.claims[0]?.id;
}
