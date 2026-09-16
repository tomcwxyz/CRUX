# CRUX

**Open evidence and provenance for organisational AI.**

CRUX helps organisations show where AI is used, how AI-mediated processes work, what evidence supports claims about those systems, and what actually happened in consequential cases.

CRUX is not a trust score, compliance badge or all-purpose eval platform. Its job is to make organisational AI **inspectable, evidenced and traceable**.

```text
Where do we use AI?
        ↓
How does the process work?
        ↓
What claims do we make about it?
        ↓
What evidence supports, qualifies or contradicts those claims?
        ↓
What actually happened when the system ran?
```

## Product boundary

CRUX is a standalone product. It must remain useful with no other Good Ship product installed or connected.

- **TOPO** — what may AI know? Portable, user-controlled context and memory.
- **RACK** — how should AI work? Portable working practice, boundaries and verification.
- **CRUX** — where is AI used, what evidence supports its claims, and what actually happened?
- **Ship Check** — what implementation evidence can be independently observed in software?

Integrations are optional, explicit and replaceable. CRUX owns its canonical transparency, claim/evidence and provenance records. It does not read another product's database or require another Good Ship runtime.

## What exists now

CRUX currently has six implementation layers:

- `packages/schemas` — strict canonical contracts for organisations, AI uses, systems, versions, claims, evidence, evaluations, runs, events, traces and receipts;
- `packages/core` — evidence scope/freshness resolution, disclosure projection, trace consistency, declared-versus-observed reconciliation and proposal-first learning;
- `packages/formats` — the portable `crux-bundle/0.1` format, cross-reference validation, disclosure exports, JSON Schema and EvidenceEnvelope import;
- `packages/cli` — standalone validation, inspection, disclosure projection, evidence ingestion and schema export;
- `packages/instrumentation` — beta metadata-first runtime collection, AI SDK/OpenTelemetry mapping and receipt proposals;
- `apps/pilot` — a deliberately thin, file-first authoring and viewing surface for the `0.1-beta` organisational pilot.

The contracts are provider-neutral. RACK, Ship Check, external eval tools, custom test suites, research, audits, observability systems and human evaluations can contribute evidence or observations without becoming CRUX dependencies.

## Core model

```text
Organisation
    │
    ├── AI Use
    │      └── System
    │             ├── System Version
    │             │      ├── Process
    │             │      ├── Components / Data Sources
    │             │      ├── Human Roles / Decisions / Actions
    │             │      └── Risks / Safeguards
    │             ├── Claims
    │             │      └── Evidence
    │             │              └── Evaluations
    │             └── Runs
    │                    ├── Events
    │                    ├── Traces
    │                    └── Receipts
    └── Change History
```

A **Trace** is the selected causal path that matters for explanation. It is deliberately not the same thing as a complete raw execution log.

## Humans declare meaning; systems report behaviour

CRUX should not become a manually maintained AI register that drifts away from production reality.

Manual authoring remains appropriate for organisational purpose, people affected, consequence, accountability, challenge routes, public claims and disclosure decisions. Runtime systems can automatically report facts they can actually observe: deployed SystemVersion, model/provider used, fallback behaviour, event sequence, errors and deliberately annotated reviews/decisions/actions.

`packages/instrumentation` is the beta runtime boundary. It produces canonical CRUX Run/Event records and maps bounded metadata from AI SDK callbacks and OpenTelemetry GenAI spans. Content-bearing telemetry is ignored by default. `@crux/core` then compares observed provider/model metadata with the exact declared SystemVersion rather than letting an adapter define that meaning.

Observed causal paths can become review-required `crux-receipt-proposal/0.1` artefacts. They deliberately leave final authority, actual outcome, AI effect and challenge routes unresolved until the application or a human can provide that organisational meaning.

See [CRUX in AI pipelines](docs/PIPELINE_INTEGRATION.md) for the design and implementation sequence.

## Beta pilot app

The pilot UI does not introduce a second database model. It edits and reads the same portable CRUX bundle used by the CLI.

```bash
pnpm install
pnpm pilot
```

The pilot surface can:

- start a simple canonical CRUX record;
- open an existing `crux-bundle/0.1` JSON file;
- show organisational AI uses, systems and the current process;
- distinguish claims from their evidence and derived evidence state;
- display consequential receipts;
- compare declared provider/model details with bounded observed runtime metadata for the exact SystemVersion in the working lens;
- switch between working, public and affected-person disclosure lenses;
- export canonical, public and affected-person JSON;
- keep incomplete edits as an explicit draft and block canonical/disclosure export until schema and reference validation pass;
- download a structured pilot-session sheet for authoring and comprehension tests.

`examples/observed-divergence/crux.json` is a small portable example for trying the observed-behaviour view.

It intentionally does **not** have accounts, hosted persistence or a separate application-only source of truth. The beta is designed to learn what the eventual guided product genuinely needs.

## Standalone CLI

Requires Node.js 22.12+ and pnpm 10.15.

```bash
pnpm install
pnpm build
```

Validate a canonical bundle:

```bash
pnpm crux -- validate examples/funding-review/crux.json
```

Inspect it in plain language, including current claim/evidence state:

```bash
pnpm crux -- inspect examples/funding-review/crux.json
```

Import a portable evidence result without silently linking it to a claim:

```bash
pnpm crux -- ingest-evidence \
  examples/funding-review/crux.json \
  examples/evidence/ci-eval-envelope.json \
  -o crux-with-evidence.json
```

Create a public disclosure projection:

```bash
pnpm crux -- redact examples/funding-review/crux.json \
  --level public \
  -o crux-public.json
```

Export JSON Schema for independent tooling:

```bash
pnpm crux -- schema -o crux-bundle.schema.json
```

`redact` produces `crux-disclosure/0.1`, a derived disclosure artefact. It does not mutate or pretend to replace the canonical bundle.

## Development

```bash
pnpm install
pnpm check
pnpm build
```

Useful package-level checks:

```bash
pnpm --filter @crux/schemas test
pnpm --filter @crux/core test
pnpm --filter @crux/formats test
pnpm --filter @crux/instrumentation test
pnpm --filter @crux/pilot test
```

## Principles

- **Standalone first** — integrations improve CRUX but never complete it.
- **Evidence over assertion** — declarations and evidence are distinct objects.
- **Process before model** — organisational processes are more durable than provider/model names.
- **Versioned truth** — receipts and evidence point to the system version they actually apply to.
- **Progressive disclosure** — useful transparency must not require unsafe disclosure of sensitive content.
- **Unknown is meaningful** — unknown, withheld and supplier-undisclosed information remain visible states.
- **No implied trust** — CRUX records evidence; it does not certify that an AI system is trustworthy.
- **Open contracts** — portable, versioned interchange formats are part of the product contract.
- **Minimal integration data** — connected tools exchange bounded evidence/metadata rather than whole projects, prompts or conversations.
- **Observed is not declared** — telemetry may report behaviour but does not silently rewrite organisational meaning or policy.
- **Proposal-first learning** — a real-world receipt can suggest a future eval case, but CRUX does not silently turn production behaviour into accepted policy or tests.

## Status

CRUX is at **0.1-beta.0**. The open contracts, evidence-resolution core, provenance foundations, portable bundle and CLI are implemented. A thin pilot authoring/viewer surface is available for organisational testing. On `beta/pipeline-instrumentation`, the bounded local automation path now covers AI SDK/OpenTelemetry runtime metadata, exact-version declared-versus-observed reconciliation, idempotent EvidenceEnvelope ingestion, and review-required receipt proposals. The remaining integration acceptance step before transport design is a metadata-only smoke test against a real external model provider.

See the [specification](docs/specification.md), [roadmap](docs/roadmap.md), [architecture](docs/architecture.md), [pilot plan](docs/PILOT.md), [pipeline integration design](docs/PIPELINE_INTEGRATION.md), [implementation status](docs/IMPLEMENTATION_STATUS.md) and [versioning policy](docs/VERSIONING.md).

## Licence

Code is intended to be Apache-2.0. Specification and example content are intended to be CC BY 4.0 unless a file says otherwise.
