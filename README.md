# CRUX

**Open evidence and provenance for organisational AI.**

CRUX is a guided way to think clearly about AI in an organisation.

The product starts with four ordinary questions:

1. **Where is AI involved?**
2. **What power does it have here?**
3. **Why should I believe what the organisation says?**
4. **What happened in this particular case?**

The schema is the durable, portable output of that thinking — not the user's mental model.

CRUX is not a trust score, compliance badge or all-purpose eval platform. It keeps organisational declarations, evidence, observed behaviour and particular outcomes distinct instead of collapsing them into a rating.

## The visible reasoning model

CRUX uses four deliberately simple ideas:

```text
SAYS
what the organisation declares

SHOWS
what evidence supports, qualifies or challenges it

HAPPENED
what occurred in a particular case

UNKNOWN
what remains unavailable or unresolved
```

For example:

```text
SAYS
“AI cannot reject a funding application.”

SHOWS
✓ the deployed workflow has no automated rejection action
✓ a funding officer must make the eligibility decision
⚠ this evidence applies to the current system version

HAPPENED
AI highlighted possible eligibility evidence
→ a funding officer reviewed the original application
→ the funding officer decided
→ the application remained eligible
```

The canonical CRUX model underneath can represent considerably more detail, but people should not need to learn terms such as `SystemVersion`, `EvidenceLink`, `Trace` or `Receipt` in order to use the product.

See [the product mental model](docs/PRODUCT_MENTAL_MODEL.md).

## Humans declare meaning; systems report behaviour

CRUX's underlying operating rule remains:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

People and organisations are appropriate sources for things such as purpose, accountability, consequences, challenge routes and public statements.

Systems are appropriate sources for things they can actually observe, such as which version ran, provider/model metadata, event sequence, errors and deliberately annotated review/decision/action events.

Observed behaviour never silently becomes organisational meaning or policy.

## The pilot

`apps/pilot` is currently a learning prototype, not a validated production product.

The main interface follows the four questions rather than exposing the schema as navigation. It includes:

- a visual process story showing where AI, people, decisions and actions appear;
- plain-language exploration of what AI can influence or cause;
- **SAYS / SHOWS / UNKNOWN** evidence reasoning;
- **HAPPENED** explanations for consequential cases;
- progressive authoring that asks more only when a use can materially affect people or cause actions;
- embedded examples and “why we ask” guidance;
- working, public and affected-person views;
- three contrasting learning cases: writing support, funding review and bounded action.

Run it locally:

```bash
pnpm install
pnpm pilot
```

The authoring pilot remains usable without accounts or hosted persistence.

## Disclosure is a boundary

CRUX uses a canonical working bundle and derived disclosure projections.

Public and affected-person disclosures must be **constructed from explicit allowed fields**, not made by copying internal records and trying to remove sensitive fields afterwards.

The current prototype therefore:

- uses typed field-level disclosure projections;
- uses `public_summary` rather than internal AI-use `purpose` in lower-disclosure views;
- excludes internal owner/timestamp/detail fields from those projections;
- renders public and affected-person UI from the disclosure projection itself rather than filtered canonical records;
- has regression tests for field-level disclosure safety.

`crux redact` produces `crux-disclosure/0.1`; it does not mutate the canonical bundle.

## Portable model and tooling

The technical prototype currently includes:

- `packages/schemas` — canonical contracts for organisations, AI uses, systems, versions, claims, evidence, evaluations, runs, events, traces and receipts;
- `packages/core` — evidence resolution, trace/projection logic and declared-versus-observed reconciliation;
- `packages/formats` — `crux-bundle/0.1`, `crux-disclosure/0.1`, reference validation, JSON Schema and evidence import;
- `packages/cli` — standalone validation, inspection, disclosure projection, evidence ingestion and schema export;
- `packages/instrumentation` — metadata-first runtime collection and AI SDK/OpenTelemetry mapping;
- `packages/transport` — provider-neutral semantic ingestion;
- `adapters/postgres` — optional PostgreSQL persistence;
- `apps/pilot` — the human learning surface.

These are implementation capabilities, not evidence that organisations need or understand every layer.

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

Inspect it:

```bash
pnpm crux -- inspect examples/funding-review/crux.json
```

Create a public disclosure:

```bash
pnpm crux -- redact examples/funding-review/crux.json \
  --level public \
  -o crux-public.json
```

Import external evidence without silently attaching it to a claim:

```bash
pnpm crux -- ingest-evidence \
  examples/funding-review/crux.json \
  examples/evidence/ci-eval-envelope.json \
  -o crux-with-evidence.json
```

Export JSON Schema:

```bash
pnpm crux -- schema -o crux-bundle.schema.json
```

## Technical paths exercised

The prototype has exercised metadata-first AI SDK/OpenTelemetry instrumentation, provider/model comparison, semantic ingestion, request idempotency and PostgreSQL/Neon persistence including a production synthetic commit/replay/conflict test.

Those checks demonstrate that the technical paths can work. They are **not** organisational, governance, usability or adoption validation.

See [implementation status](docs/IMPLEMENTATION_STATUS.md) for the precise distinction.

## What we are testing now

The important beta questions are human:

- Can a domain owner describe real AI use without learning the schema?
- Can a non-author see where AI enters a process and where it stops?
- Can they tell whether AI can merely assist, recommend, decide or act?
- Can they distinguish **SAYS** from **SHOWS**?
- Can they understand **HAPPENED** as one particular case rather than proof of all cases?
- Do public and affected-person views remain both safe and genuinely useful?
- Does **UNKNOWN** remain legible rather than being interpreted as a failure or hidden score?

Infrastructure expansion is paused by default while those questions are tested.

The first teaching case is `examples/funding-review`. The other anchor cases are `examples/writing-assistant` and `examples/bounded-action`.

See [beta learning protocol](docs/BETA_LEARNING_PROTOCOL.md) and [roadmap](docs/roadmap.md).

## Open contract

CRUX is standalone and provider-neutral. TOPO, RACK, Ship Check, eval systems and observability tools may later produce or consume bounded CRUX material, but none is a CRUX runtime dependency.

The stronger future test of the “open” claim is not another adapter. It is an **independent CRUX reader** that can consume a disclosure without importing the CRUX application and explain:

- where AI is used;
- who has authority;
- what is asserted;
- what evidence exists;
- what happened;
- what remains unknown.

Until an independent consumer exists, portability is an intended property being tested rather than an adoption claim.

## Principles

- **People first, schema underneath** — the product teaches critical thinking, not ontology navigation.
- **Evidence over assertion** — declarations and evidence remain distinct.
- **Process before model** — the real-world workflow matters more than the provider name.
- **Proportionate depth** — low-consequence assistance should remain lightweight; consequential/agentic uses justify more questions.
- **Versioned truth** — evidence and outcomes apply to the version they actually concern.
- **Progressive disclosure** — useful transparency must not require unsafe disclosure.
- **Unknown is meaningful** — unavailable information remains visible rather than being silently omitted.
- **No implied trust** — CRUX does not certify that a system is trustworthy.
- **Observed is not declared** — telemetry cannot silently define purpose, accountability or policy.
- **Standalone first** — integrations improve CRUX but never complete it.

## Development

```bash
pnpm install
pnpm check
pnpm build
```

## Status

CRUX is at **0.1-beta.0**.

The modelling and technical prototype are substantial. Human usefulness and comprehension are not yet validated externally. That is now the centre of the project.

See [product mental model](docs/PRODUCT_MENTAL_MODEL.md), [roadmap](docs/roadmap.md), [implementation status](docs/IMPLEMENTATION_STATUS.md), [beta learning protocol](docs/BETA_LEARNING_PROTOCOL.md), [architecture](docs/architecture.md) and [versioning policy](docs/VERSIONING.md).

## Licence

Code is intended to be Apache-2.0. Specification and example content are intended to be CC BY 4.0 unless a file says otherwise.
