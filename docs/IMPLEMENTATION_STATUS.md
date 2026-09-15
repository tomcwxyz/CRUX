# CRUX implementation status

**Updated:** 15 September 2026

`0.1-alpha.5` is complete. CRUX now has a standalone, account-free contract/tooling layer suitable for real-world schema piloting.

## Implemented

### Evidence spine

- Claim / Evidence / EvidenceLink
- EvaluationDefinition / EvaluationRun
- neutral EvidenceEnvelope
- provider-neutral external evidence contracts

### Organisational/process model

- Organisation / AIUse / System / SystemVersion
- influence and agency as separate concepts
- process graphs, components and data sources
- human roles and local decision authority
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
- metadata-first capture
- causal traces rather than raw-log-as-explanation
- trace/run/event/receipt consistency validation
- affected-person receipt representation
- privacy-safe trace projections with hidden-context signals
- proposal-first EvaluationCase promotion from receipts/incidents

### Portable tooling

- canonical `crux-bundle/0.1`
- cross-record reference validation
- derived `crux-disclosure/0.1`
- JSON Schema export
- `crux validate`
- `crux inspect`
- `crux redact`
- `crux schema`
- explicit version/migration policy
- worked portable examples
- CI dogfooding of the standalone CLI

## Current phase

`0.1-beta` pilot preparation.

The next useful evidence comes from real organisations and non-author comprehension tests rather than more speculative schema. See `docs/PILOT.md`.

Before a guided application is built, the pilot should establish whether people can correctly understand AI purpose, influence, agency, authority, evidence quality, version scope and consequential receipts from CRUX records.

## Product boundary

CRUX remains standalone. TOPO, RACK, Ship Check and external evaluation systems are optional context, practice or evidence producers/consumers. None is a CRUX runtime dependency.
