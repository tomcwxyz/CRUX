# CRUX implementation status

**Updated:** 15 September 2026

CRUX is currently in `0.1-alpha.5`: the standalone specification/tooling layer is implemented and being hardened before a guided application surface is introduced.

## Implemented

### Evidence spine

- Claim / Evidence / EvidenceLink
- EvaluationDefinition / EvaluationRun
- neutral EvidenceEnvelope
- provider-neutral external evidence contracts

### Organisational/process model

- Organisation / AIUse / System / SystemVersion
- influence and agency as separate concepts
- process nodes and graph edges
- components and data sources
- human roles
- local decision authority
- bounded actions
- risks and safeguards
- explicit unknown/not-disclosed/withheld supplier states

### Evidence resolution

- declared/supported/qualified/contradicted/stale/unknown
- version and organisational scope resolution
- broad/narrow evidence handling
- freshness and review windows
- conflict preservation
- unresolved/inapplicable evidence reporting
- disclosure filtering
- evidence summaries without a trust score

### Provenance and learning

- Run / Event / Trace / Receipt / Observation
- metadata-first capture mode
- causal traces rather than raw-log-as-explanation
- run/event/trace/receipt consistency validation
- affected-person receipt representation
- privacy-safe trace projections with hidden-context signals
- proposal-first EvaluationCase promotion from receipts/incidents

### Portable tooling

- canonical `crux-bundle/0.1`
- cross-record reference validation
- `crux-disclosure/0.1` derived disclosure exports
- JSON Schema export
- `crux validate`
- `crux inspect`
- `crux redact`
- `crux schema`
- explicit version/migration policy
- worked portable examples

## Current work

- dogfood the CLI against repository examples in CI;
- harden disclosure and cross-reference semantics through real examples;
- prepare a small real-world schema pilot before building the guided authoring application;
- resist adding database/application concepts until the portable model demonstrates a genuine need.

## Product boundary

CRUX remains standalone. TOPO, RACK, Ship Check and external evaluation systems are optional context, practice or evidence producers/consumers. None is a CRUX runtime dependency.
