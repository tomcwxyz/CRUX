type ProjectedAuthorityVersion = {
  human_roles: unknown[];
  decisions: unknown[];
  actions: unknown[];
};

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;

const stringValue = (value: unknown) => typeof value === "string" ? value : undefined;
const booleanValue = (value: unknown) => typeof value === "boolean" ? value : undefined;
const stringArray = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string")
  : [];

export function AuthoritySummary({ version }: { version: ProjectedAuthorityVersion | undefined }) {
  if (!version) return null;

  const roles = version.human_roles.flatMap((item) => {
    const value = record(item);
    const id = value ? stringValue(value.id) : undefined;
    const name = value ? stringValue(value.name) : undefined;
    return id && name ? [{ id, name }] : [];
  });
  const roleNames = new Map(roles.map((role) => [role.id, role.name]));

  const decisions = version.decisions.flatMap((item) => {
    const value = record(item);
    if (!value) return [];
    const id = stringValue(value.id);
    const name = stringValue(value.name);
    const consequence = stringValue(value.consequence);
    const authority = stringValue(value.authority);
    if (!id || !name || !consequence || !authority) return [];
    const challenge = record(value.challenge);
    return [{
      id,
      name,
      consequence,
      authority,
      aiInfluence: stringArray(value.ai_influence),
      responsibleRoles: stringArray(value.responsible_role_refs),
      reviewBeforeEffect: booleanValue(value.review_before_effect) ?? false,
      challengeAvailable: challenge ? booleanValue(challenge.available) ?? false : false,
      challengeDescription: challenge ? stringValue(challenge.description) : undefined,
    }];
  });

  const actions = version.actions.flatMap((item) => {
    const value = record(item);
    if (!value) return [];
    const id = stringValue(value.id);
    const name = stringValue(value.name);
    const initiatedBy = stringValue(value.initiated_by);
    const reversibility = stringValue(value.reversibility);
    if (!id || !name || !initiatedBy || !reversibility) return [];
    const scope = record(value.scope);
    return [{
      id,
      name,
      initiatedBy,
      reversibility,
      humanApprovalRequired: booleanValue(value.human_approval_required) ?? false,
      scope: scope ? stringValue(scope.summary) : undefined,
    }];
  });

  return (
    <div style={{ marginTop: 24 }}>
      <div className="divider" />
      <div className="kicker">Authority and action</div>
      {decisions.length ? decisions.map((decision) => (
        <div className="receipt" key={decision.id} style={{ padding: 16, marginTop: 12 }}>
          <div className="kicker">Decision</div>
          <h3 style={{ marginTop: 0 }}>{decision.name}</h3>
          <p className="body-copy">{decision.consequence}</p>
          <div className="pill-row">
            <span className="pill rust">Final authority: {decision.authority}</span>
            {decision.aiInfluence.map((influence) => (
              <span className="pill" key={influence}>AI influence: {influence}</span>
            ))}
            <span className="pill">Review before effect: {decision.reviewBeforeEffect ? "yes" : "no"}</span>
          </div>
          {decision.responsibleRoles.length ? (
            <div className="small muted" style={{ marginTop: 10 }}>
              Responsible: {decision.responsibleRoles.map((id) => roleNames.get(id) ?? id).join(", ")}
            </div>
          ) : null}
          <div className="small muted" style={{ marginTop: 6 }}>
            Challenge route: {decision.challengeAvailable
              ? decision.challengeDescription ?? "available"
              : "none recorded"}
          </div>
        </div>
      )) : (
        <div className="empty" style={{ marginTop: 12 }}>
          No decision point is visible in this disclosure.
        </div>
      )}

      {actions.length ? actions.map((action) => (
        <div className="receipt" key={action.id} style={{ padding: 16, marginTop: 12 }}>
          <div className="kicker">Action</div>
          <h3 style={{ marginTop: 0 }}>{action.name}</h3>
          {action.scope ? <p className="body-copy">{action.scope}</p> : null}
          <div className="pill-row">
            <span className="pill">Initiated by: {action.initiatedBy}</span>
            <span className="pill">Human approval: {action.humanApprovalRequired ? "required" : "not required"}</span>
            <span className="pill">Reversible: {action.reversibility}</span>
          </div>
        </div>
      )) : (
        <div className="small muted" style={{ marginTop: 12 }}>
          No bounded action is visible in this disclosure.
        </div>
      )}
    </div>
  );
}
