# CRUX implementation status

**Updated:** 15 September 2026

CRUX is now at `0.1-beta.0`. The standalone contract/tooling layer remains the foundation, and a deliberately thin pilot authoring/viewer surface now sits directly on top of the portable bundle.

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

### Beta pilot surface

- `apps/pilot` Next.js application
- open/import a local canonical CRUX JSON bundle
- working/public/affected-person disclosure lenses
- organisation, AI-use, system/process, claim/evidence and receipt views
- intentionally narrow guided editing for the primary organisational story
- canonical/public/affected-person JSON export
- no account, database or hidden application-only canonical state
- structural and cross-reference validation before canonical/disclosure export
- invalid in-progress edits remain visibly a working draft
- starter bundle deliberately includes a declared but unevidenced claim

## Current phase

`0.1-beta` real-world piloting.

The next useful evidence should come from organisations and non-author comprehension tests rather than speculative schema expansion. See `docs/PILOT.md`.

The pilot surface is intentionally incomplete as an authoring product. Its job is to reveal which interactions and concepts are genuinely needed while keeping the portable bundle as the source of truth.

The main questions now are whether people can correctly understand AI purpose, influence, agency, authority, evidence quality, version scope and consequential receipts, and whether small organisations can author meaningful records without specialist help.

## Product boundary

CRUX remains standalone. TOPO, RACK, Ship Check and external evaluation systems are optional context, practice or evidence producers/consumers. None is a CRUX runtime dependency.
