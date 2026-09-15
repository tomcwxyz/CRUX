# CRUX specification

**Version:** 0.1-draft  
**Status:** exploratory / alpha foundation  
**Updated:** 15 September 2026

## 1. Purpose

CRUX is an open evidence and provenance layer for organisational AI.

It helps an organisation explain:

1. where AI is used;
2. how an AI-mediated process works;
3. what AI can influence or do;
4. what claims the organisation makes about that system;
5. what evidence supports, qualifies or contradicts those claims;
6. what has been evaluated and with what limitations;
7. what actually happened when the system operated;
8. who or what had authority at consequential points;
9. how a specific outcome can be understood or challenged.

CRUX does not certify that an AI system is trustworthy, ethical, lawful or safe. It makes assertions, evidence, process and provenance inspectable.

## 2. Design principles

### Standalone first

CRUX must deliver its complete core proposition without TOPO, RACK, Ship Check or any third-party eval service.

### Process before model

The durable object is the organisational process, not the provider/model name. Models are components within versioned systems.

### Evidence over assertion

A published statement is a `Claim`. Evidence is a separate object. CRUX should make the difference visible.

### Versioned truth

Evidence and receipts must identify the system version to which they apply where that is known.

### Progressive disclosure

Public transparency must not require public disclosure of sensitive prompts, personal data, security mechanisms or protected evidence.

### Unknown is meaningful

`unknown`, `not_applicable`, `not_disclosed` and `withheld` are legitimate states. Missing supplier information should not be silently converted into apparent certainty.

### No universal trust score

Evidence may support, qualify, contradict or leave a claim unresolved. CRUX should not collapse organisational AI into a single ethics/trust number.

## 3. Core domain

```text
Organisation
    ├── AI Use
    │     └── System
    │           ├── System Version
    │           │     ├── Process Nodes / Edges
    │           │     ├── Components
    │           │     ├── Data Sources
    │           │     ├── Human Roles
    │           │     ├── Decision Points
    │           │     ├── Actions
    │           │     ├── Risks
    │           │     └── Safeguards
    │           ├── Claims
    │           │     └── Evidence Links
    │           │            └── Evidence
    │           │                   └── Evaluations
    │           └── Runs
    │                 ├── Events
    │                 ├── Observations
    │                 └── Receipts / Traces
    └── Change History
```

## 4. AI influence and agency

Influence and autonomy are separate dimensions.

### Influence

- `assistive` — helps produce work without materially influencing a later decision;
- `informational` — retrieves, extracts, classifies or summarises information;
- `advisory` — produces a recommendation, score or signal intended to influence judgement;
- `conditional` — output determines which process branch occurs;
- `decisional` — output directly determines an outcome.

### Agency

- `none`;
- `proposes_action`;
- `human_approval_required`;
- `automatic_bounded`;
- `autonomous_bounded`.

A non-agentic classifier can be decisional. An autonomous agent can operate without making a high-impact decision. The specification must not conflate these.

## 5. Claims

A Claim is an explicit statement made about an AI use, process, system, system version, decision point, safeguard or other target.

Claim types in v0.1:

- `descriptive`;
- `behavioural`;
- `control`;
- `performance`;
- `safety`;
- `impact`.

Example:

```yaml
id: claim:no-autonomous-rejection
statement: AI cannot independently reject a funding application.
type: control
applies_to:
  kind: system_version
  ref: system-version:funding-assistant:2.3
```

A claim is not evidence of itself.

## 6. Evidence

Evidence is a bounded record that can support, contradict, qualify or leave a claim unresolved.

Evidence kinds include:

- evaluation;
- system configuration;
- production observation;
- human review;
- audit;
- assurance;
- incident;
- receipt;
- policy/configuration record;
- research;
- other.

Evidence keeps provenance: producer, time, scope, stable references and disclosure.

The relationship between a claim and evidence is explicit:

- `supports`;
- `contradicts`;
- `qualifies`;
- `inconclusive`.

Derived public statuses may include `declared`, `supported`, `qualified`, `contradicted`, `stale` and `unknown`, but these are views over evidence rather than manually asserted truth.

## 7. Evaluations

Evaluation is first-class but CRUX is not required to execute every eval itself.

Two objects are required:

### Evaluation Definition

Defines what is tested, why, how, against which claims/risks and with what intended metrics or acceptance conditions.

Evaluation types:

- `capability`;
- `safety_failure`;
- `workflow`;
- `impact`;
- `production`;
- `governance_control`.

Methods may include deterministic tests, labelled datasets, model judgement, human review, simulation, production monitoring or mixed methods.

### Evaluation Run

Records one execution of a definition against a particular target/system version.

Categorical outcomes use a deliberately small vocabulary:

- `pass`;
- `fail`;
- `uncertain`;
- `incomplete`.

Raw metrics, findings and limitations remain available. A pass means the defined acceptance condition was met; it is not proof that the system is safe.

## 8. Evidence envelope

External products should not need CRUX internals to contribute evidence.

The neutral `EvidenceEnvelope` carries:

- schema version;
- producer identity/version;
- generated timestamp;
- one bounded evidence record;
- optional external references.

Producers may include RACK, Ship Check, CI, specialist eval platforms, custom scripts, auditors or human researchers.

Importing evidence does not automatically publish it or make it authoritative. CRUX reviews and links it to organisational claims separately.

## 9. Evidence freshness

Evidence is temporal. It may declare `observed_at` and `review_after`.

A system version change may invalidate or narrow the applicability of earlier evidence. CRUX must preserve the old evidence rather than overwrite it.

## 10. Change and deployment record

A significant system change should be able to connect:

```text
change
  → affected claims
  → affected risks
  → required evaluations
  → evaluation results
  → deployment decision
```

This creates an inspectable deployment history without pretending every organisation uses the same release process.

## 11. Runs, traces and receipts

A Run is an instance of a system operating. It may contain events such as input received, retrieval, AI invocation, rule evaluation, human review, override, decision, action, escalation or error.

A **Trace** is the provenance chain through a run/process: what happened, in what order, and which system/version/components were involved.

A **Receipt** is the human-facing explanation derived from that provenance for a particular case or outcome.

A receipt should answer:

1. what process occurred;
2. whether AI was involved;
3. what AI did;
4. what information categories it used;
5. what it produced;
6. what happened because of that output;
7. who or what had final authority;
8. what system version was operating;
9. whether/how the outcome can be challenged.

Receipts should not require raw prompts or sensitive source content.

## 12. Learning loop

CRUX should support the full learning loop:

```text
claim
  ↓
evaluation
  ↓
deployment
  ↓
production
  ↓
observation / receipt / challenge / incident
  ↓
new evaluation case
  ↓
system change
  ↓
new version
  ↺
```

A real production failure can therefore become a regression fixture and visible evidence of subsequent improvement.

## 13. Disclosure

Initial levels:

- `public`;
- `affected_party`;
- `trusted`;
- `internal`.

Disclosure applies independently of storage. CRUX should be able to derive a public representation while keeping protected evidence internal.

## 14. Interoperability

CRUX may optionally interoperate with sibling products, but integrations are never required.

### TOPO

Can provide purpose-bound authoring context. TOPO context is not automatically organisational truth or public CRUX content.

### RACK

Can provide bounded verification/evaluation evidence about working practice. CRUX does not ingest an entire Rack or private context.

### Ship Check

Can provide bounded, independent implementation assurance evidence. Absence of findings does not imply broad proof.

### Third-party eval systems

Can emit or be adapted into the neutral evidence envelope. CRUX remains provider-neutral.

## 15. v0.1 schema focus

The first implemented contracts are:

1. `Claim`;
2. `Evidence`;
3. `EvidenceLink`;
4. `EvaluationDefinition`;
5. `EvaluationRun`;
6. `EvidenceEnvelope`.

Later 0.1 work extends outward to organisation/use/system/process/version/run/trace/receipt contracts.

## 16. Conformance direction

Future conformance levels should distinguish:

- **transparency-conformant** — organisation/use/system/version and meaningful process disclosure;
- **evidence-conformant** — claims and evidence with provenance;
- **provenance-conformant** — runs/traces/receipts linked to immutable versions;
- **instrumented-conformant** — observed runtime events produced automatically.

Adoption should be progressive; a small organisation should not need production instrumentation to begin publishing useful transparency.
