# CRUX implementation status

**Updated:** 15 September 2026

CRUX is currently implementing the `0.1-alpha.4` roadmap phase.

## Complete enough to build on

### Evidence spine

- Claim
- Evidence
- EvidenceLink
- EvaluationDefinition
- EvaluationRun
- neutral EvidenceEnvelope
- provider-neutral external evidence contracts

### Organisational/process model

- Organisation
- AIUse
- System
- SystemVersion
- influence and agency as separate concepts
- process nodes and graph edges
- components and data sources
- human roles
- decision points with local authority
- bounded actions
- risks and safeguards
- explicit unknown/not-disclosed/withheld supplier states

### Evidence resolution

- declared/supported/qualified/contradicted/stale/unknown derived states
- version and organisational scope resolution
- broad/narrow evidence handling
- freshness and review windows
- conflict preservation
- unresolved/inapplicable evidence reporting
- disclosure filtering
- bounded evidence summaries without a trust score

### Provenance foundations

- Run
- Event
- Trace
- Receipt
- Observation
- metadata-first capture mode
- causal trace selection rather than raw-log-as-explanation
- trace/run/event/receipt consistency validation
- challenge-route metadata
- affected-person receipt representation

## Active work

The remaining `0.1-alpha.4` work is to connect receipts/incidents back into evaluation cases and strengthen privacy-safe public/affected-person trace projection.

After that, `0.1-alpha.5` adds portable bundle formats and the first standalone CLI (`validate`, `inspect`, `redact`).

## Product boundary

CRUX remains standalone. TOPO, RACK, Ship Check and external evaluation systems are optional evidence/context/practice producers or consumers. None is a runtime dependency of CRUX.
