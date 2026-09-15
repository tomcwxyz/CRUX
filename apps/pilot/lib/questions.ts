import type { CruxPortableBundle } from "@crux/formats";

export type PilotQuestionKind = "missing" | "declared_only" | "consider";

export type PilotQuestion = {
  id: string;
  kind: PilotQuestionKind;
  title: string;
  detail: string;
};

export const getPilotQuestions = (
  bundle: CruxPortableBundle,
  systemVersionId: string,
): PilotQuestion[] => {
  const version = bundle.system_versions.find((item) => item.id === systemVersionId);
  if (!version) return [];

  const system = bundle.systems.find((item) => item.id === version.system_ref);
  const aiUse = system
    ? bundle.ai_uses.find(
        (item) => item.system_refs.includes(system.id) || system.ai_use_refs.includes(item.id),
      )
    : undefined;
  const questions: PilotQuestion[] = [];

  if (aiUse?.consequential && aiUse.people_affected.length === 0) {
    questions.push({
      id: "people-affected",
      kind: "missing",
      title: "Who is affected?",
      detail: "This use is marked consequential, but no affected people or groups are recorded.",
    });
  }

  if (aiUse?.consequential && version.decisions.length === 0) {
    questions.push({
      id: "decision-point",
      kind: "missing",
      title: "Where is the consequential decision?",
      detail: "Make the decision point and its authority explicit rather than relying on a general description of the system.",
    });
  }

  for (const decision of version.decisions) {
    if (["human", "hybrid"].includes(decision.authority) && decision.responsible_role_refs.length === 0) {
      questions.push({
        id: `decision-role:${decision.id}`,
        kind: "missing",
        title: `Who is responsible for “${decision.name}”?`,
        detail: "The decision says human or hybrid authority, but no responsible human role is linked to it.",
      });
    }

    if (decision.challenge === undefined) {
      questions.push({
        id: `decision-challenge:${decision.id}`,
        kind: "consider",
        title: `Can “${decision.name}” be questioned or challenged?`,
        detail: "Record whether a challenge route exists. An explicit ‘no’ is more transparent than leaving the question unanswered.",
      });
    }
  }

  if (
    system &&
    ["automatic_bounded", "autonomous_bounded"].includes(system.agency) &&
    version.actions.length === 0
  ) {
    questions.push({
      id: "bounded-actions",
      kind: "missing",
      title: "What can the system actually do?",
      detail: "The system has bounded automatic or autonomous agency, but no bounded actions are described.",
    });
  }

  const versionClaims = bundle.claims.filter((claim) =>
    claim.applies_to.some(
      (target) => target.kind === "system_version" && target.ref === version.id,
    ),
  );

  if (versionClaims.length === 0) {
    questions.push({
      id: "version-claim",
      kind: "missing",
      title: "What important claim are you making about this version?",
      detail: "No claim is directly scoped to the current system version.",
    });
  } else {
    for (const claim of versionClaims) {
      const hasEvidence = bundle.evidence_links.some((link) => link.claim_ref === claim.id);
      if (!hasEvidence) {
        questions.push({
          id: `claim-evidence:${claim.id}`,
          kind: "declared_only",
          title: "This claim is currently declared only",
          detail: `“${claim.statement}” has no linked evidence. That can be intentional; CRUX should keep the distinction visible.`,
        });
      }
    }
  }

  const hasReceipt = bundle.receipts.some((receipt) => receipt.system_version_ref === version.id);
  if (aiUse?.consequential && !hasReceipt) {
    questions.push({
      id: "case-receipt",
      kind: "consider",
      title: "Can you show one specific case safely?",
      detail: "A metadata-first receipt can test whether an affected person can understand AI contribution, consequence and final authority without exposing source content.",
    });
  }

  return questions;
};
