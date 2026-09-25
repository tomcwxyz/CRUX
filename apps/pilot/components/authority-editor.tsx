"use client";

import type { CruxPortableBundle } from "@crux/formats";
import type { Action, AIInfluence, Decision, SystemVersion } from "@crux/schemas";
import {
  appendActionPoint,
  appendDecisionPoint,
  appendHumanRole,
  renameActionPoint,
  renameDecisionPoint,
} from "../lib/authoring";
import { authorityOptions } from "../lib/labels";

const influenceOptions: AIInfluence[] = [
  "assistive",
  "informational",
  "advisory",
  "conditional",
  "decisional",
];

const initiatorOptions: Action["initiated_by"][] = [
  "human",
  "rule",
  "ai",
  "hybrid",
  "external",
];

const reversibilityOptions: Action["reversibility"][] = [
  "yes",
  "partly",
  "no",
  "unknown",
];

export function AuthorityEditor({
  bundle,
  systemVersionId,
  onBundleChange,
}: {
  bundle: CruxPortableBundle;
  systemVersionId: string;
  onBundleChange: (bundle: CruxPortableBundle) => void;
}) {
  const version = bundle.system_versions.find((item) => item.id === systemVersionId);

  const mutate = (change: (version: SystemVersion) => void) => {
    const next = structuredClone(bundle);
    const nextVersion = next.system_versions.find((item) => item.id === systemVersionId);
    if (!nextVersion) return;
    change(nextVersion);
    next.generated_at = new Date().toISOString();
    onBundleChange(next);
  };

  if (!version) {
    return <div className="empty">This system version is not available for authority authoring.</div>;
  }

  const addRole = () => {
    const result = appendHumanRole(bundle, systemVersionId);
    onBundleChange(result.bundle);
  };

  const addDecision = () => {
    const result = appendDecisionPoint(bundle, systemVersionId);
    onBundleChange(result.bundle);
  };

  const addAction = () => {
    const result = appendActionPoint(bundle, systemVersionId);
    onBundleChange(result.bundle);
  };

  return (
    <div>
      <div className="kicker">Human responsibility</div>
      <p className="small muted">
        Record the real roles that remain accountable. Different decision points can point to different roles.
      </p>
      {version.human_roles.length ? (
        version.human_roles.map((role) => (
          <div className="receipt" key={role.id} style={{ padding: 16, marginBottom: 14 }}>
            <div className="field">
              <label htmlFor={`role-name-${role.id}`}>Role</label>
              <input
                id={`role-name-${role.id}`}
                className="input"
                value={role.name}
                onChange={(event) => mutate((nextVersion) => {
                  const nextRole = nextVersion.human_roles.find((item) => item.id === role.id);
                  if (nextRole) nextRole.name = event.target.value;
                })}
              />
            </div>
            <div className="field">
              <label htmlFor={`role-responsibilities-${role.id}`}>What is this person responsible for? · one point per line</label>
              <textarea
                id={`role-responsibilities-${role.id}`}
                className="textarea"
                value={role.responsibilities.join("\n")}
                onChange={(event) => mutate((nextVersion) => {
                  const nextRole = nextVersion.human_roles.find((item) => item.id === role.id);
                  if (nextRole) {
                    nextRole.responsibilities = event.target.value
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean);
                  }
                })}
              />
            </div>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={role.can_override_ai ?? false}
                onChange={(event) => mutate((nextVersion) => {
                  const nextRole = nextVersion.human_roles.find((item) => item.id === role.id);
                  if (nextRole) nextRole.can_override_ai = event.target.checked;
                })}
              />
              This role can disagree with or override the AI contribution.
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={role.sees_original_source ?? false}
                onChange={(event) => mutate((nextVersion) => {
                  const nextRole = nextVersion.human_roles.find((item) => item.id === role.id);
                  if (nextRole) nextRole.sees_original_source = event.target.checked;
                })}
              />
              This role can see the original source information rather than only the AI output.
            </label>
          </div>
        ))
      ) : (
        <div className="empty" style={{ marginBottom: 16 }}>
          No human role is recorded for this version. Do not describe a decision as human-authorised unless a real responsible role exists.
        </div>
      )}
      <button className="btn" type="button" onClick={addRole}>+ Add responsible role</button>

      <div className="divider" />
      <div className="kicker">Decision points</div>
      <p className="small muted">
        A decision is where an outcome is determined. Record authority here rather than relying on a system-wide “human in the loop” claim.
      </p>
      {version.decisions.length ? (
        version.decisions.map((decision) => (
          <div className="receipt" key={decision.id} style={{ padding: 16, marginTop: 14 }}>
            <div className="field">
              <label htmlFor={`decision-name-${decision.id}`}>What decision is being made?</label>
              <input
                id={`decision-name-${decision.id}`}
                className="input"
                value={decision.name}
                onChange={(event) => onBundleChange(
                  renameDecisionPoint(bundle, systemVersionId, decision.id, event.target.value),
                )}
              />
            </div>
            <div className="field">
              <label htmlFor={`decision-consequence-${decision.id}`}>What can change because of it?</label>
              <textarea
                id={`decision-consequence-${decision.id}`}
                className="textarea"
                value={decision.consequence}
                onChange={(event) => mutate((nextVersion) => {
                  const nextDecision = nextVersion.decisions.find((item) => item.id === decision.id);
                  if (nextDecision) nextDecision.consequence = event.target.value;
                })}
              />
            </div>
            <div className="grid">
              <div className="field" style={{ gridColumn: "span 4" }}>
                <label htmlFor={`decision-authority-${decision.id}`}>Who has final authority?</label>
                <select
                  id={`decision-authority-${decision.id}`}
                  className="select"
                  value={decision.authority}
                  onChange={(event) => mutate((nextVersion) => {
                    const nextDecision = nextVersion.decisions.find((item) => item.id === decision.id);
                    if (nextDecision) nextDecision.authority = event.target.value as Decision["authority"];
                  })}
                >
                  {authorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: "span 4" }}>
                <label htmlFor={`decision-influence-${decision.id}`}>How does AI influence this decision?</label>
                <select
                  id={`decision-influence-${decision.id}`}
                  className="select"
                  value={decision.ai_influence[0] ?? "none"}
                  onChange={(event) => mutate((nextVersion) => {
                    const nextDecision = nextVersion.decisions.find((item) => item.id === decision.id);
                    if (!nextDecision) return;
                    nextDecision.ai_influence = event.target.value === "none"
                      ? []
                      : [event.target.value as AIInfluence];
                  })}
                >
                  <option value="none">No direct AI influence recorded</option>
                  {influenceOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: "span 4" }}>
                <label htmlFor={`decision-role-${decision.id}`}>Responsible human role</label>
                <select
                  id={`decision-role-${decision.id}`}
                  className="select"
                  value={decision.responsible_role_refs[0] ?? ""}
                  onChange={(event) => mutate((nextVersion) => {
                    const nextDecision = nextVersion.decisions.find((item) => item.id === decision.id);
                    if (nextDecision) nextDecision.responsible_role_refs = event.target.value ? [event.target.value] : [];
                  })}
                >
                  <option value="">No responsible human role recorded</option>
                  {version.human_roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </div>
            </div>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={decision.review_before_effect}
                onChange={(event) => mutate((nextVersion) => {
                  const nextDecision = nextVersion.decisions.find((item) => item.id === decision.id);
                  if (nextDecision) nextDecision.review_before_effect = event.target.checked;
                })}
              />
              A review must happen before this decision takes effect.
            </label>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={decision.challenge?.available ?? false}
                onChange={(event) => mutate((nextVersion) => {
                  const nextDecision = nextVersion.decisions.find((item) => item.id === decision.id);
                  if (!nextDecision) return;
                  nextDecision.challenge = event.target.checked
                    ? { available: true, description: "Describe how someone can question or challenge this decision." }
                    : { available: false };
                })}
              />
              Someone affected can question or challenge this decision.
            </label>
            {decision.challenge?.available ? (
              <div className="field">
                <label htmlFor={`decision-challenge-${decision.id}`}>Challenge route</label>
                <textarea
                  id={`decision-challenge-${decision.id}`}
                  className="textarea"
                  value={decision.challenge.description ?? ""}
                  onChange={(event) => mutate((nextVersion) => {
                    const nextDecision = nextVersion.decisions.find((item) => item.id === decision.id);
                    if (!nextDecision?.challenge) return;
                    nextDecision.challenge.description = event.target.value;
                  })}
                />
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <div className="empty" style={{ marginTop: 12 }}>
          No explicit decision point is recorded yet. That may be correct for assistive uses; consequential uses should make decision authority visible.
        </div>
      )}
      <button className="btn" style={{ marginTop: 12 }} type="button" onClick={addDecision}>+ Add decision point</button>

      <div className="divider" />
      <div className="kicker">Actions</div>
      <p className="small muted">
        An action is something the workflow can cause to happen. Keep this separate from the decision that may justify it.
      </p>
      {version.actions.length ? (
        version.actions.map((action) => (
          <div className="receipt" key={action.id} style={{ padding: 16, marginTop: 14 }}>
            <div className="field">
              <label htmlFor={`action-name-${action.id}`}>What can happen?</label>
              <input
                id={`action-name-${action.id}`}
                className="input"
                value={action.name}
                onChange={(event) => onBundleChange(
                  renameActionPoint(bundle, systemVersionId, action.id, event.target.value),
                )}
              />
            </div>
            <div className="field">
              <label htmlFor={`action-description-${action.id}`}>Describe the action</label>
              <textarea
                id={`action-description-${action.id}`}
                className="textarea"
                value={action.description ?? ""}
                onChange={(event) => mutate((nextVersion) => {
                  const nextAction = nextVersion.actions.find((item) => item.id === action.id);
                  if (!nextAction) return;
                  if (event.target.value) nextAction.description = event.target.value;
                  else delete nextAction.description;
                })}
              />
            </div>
            <div className="grid">
              <div className="field" style={{ gridColumn: "span 4" }}>
                <label htmlFor={`action-initiator-${action.id}`}>Who or what can initiate it?</label>
                <select
                  id={`action-initiator-${action.id}`}
                  className="select"
                  value={action.initiated_by}
                  onChange={(event) => mutate((nextVersion) => {
                    const nextAction = nextVersion.actions.find((item) => item.id === action.id);
                    if (nextAction) nextAction.initiated_by = event.target.value as Action["initiated_by"];
                  })}
                >
                  {initiatorOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: "span 4" }}>
                <label htmlFor={`action-reversibility-${action.id}`}>Can it be reversed?</label>
                <select
                  id={`action-reversibility-${action.id}`}
                  className="select"
                  value={action.reversibility}
                  onChange={(event) => mutate((nextVersion) => {
                    const nextAction = nextVersion.actions.find((item) => item.id === action.id);
                    if (nextAction) nextAction.reversibility = event.target.value as Action["reversibility"];
                  })}
                >
                  {reversibilityOptions.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: "span 4" }}>
                <label htmlFor={`action-scope-${action.id}`}>Boundaries / scope</label>
                <input
                  id={`action-scope-${action.id}`}
                  className="input"
                  value={action.scope.summary}
                  onChange={(event) => mutate((nextVersion) => {
                    const nextAction = nextVersion.actions.find((item) => item.id === action.id);
                    if (nextAction) nextAction.scope.summary = event.target.value;
                  })}
                />
              </div>
            </div>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={action.human_approval_required}
                onChange={(event) => mutate((nextVersion) => {
                  const nextAction = nextVersion.actions.find((item) => item.id === action.id);
                  if (nextAction) nextAction.human_approval_required = event.target.checked;
                })}
              />
              Human approval is required before this action happens.
            </label>
            <div className="field">
              <label htmlFor={`action-escalation-${action.id}`}>Escalation or fallback · optional</label>
              <textarea
                id={`action-escalation-${action.id}`}
                className="textarea"
                value={action.escalation ?? ""}
                onChange={(event) => mutate((nextVersion) => {
                  const nextAction = nextVersion.actions.find((item) => item.id === action.id);
                  if (!nextAction) return;
                  if (event.target.value) nextAction.escalation = event.target.value;
                  else delete nextAction.escalation;
                })}
              />
            </div>
          </div>
        ))
      ) : (
        <div className="empty" style={{ marginTop: 12 }}>
          No action is recorded. This is expected where AI only produces information for a person to use elsewhere.
        </div>
      )}
      <button className="btn" style={{ marginTop: 12 }} type="button" onClick={addAction}>+ Add action</button>
    </div>
  );
}
