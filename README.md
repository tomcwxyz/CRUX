# CRUX

**Open evidence and provenance for organisational AI.**

CRUX helps organisations show where AI is used, how AI-mediated processes work, what evidence supports claims about those systems, and what actually happened in consequential cases.

CRUX is deliberately not a trust score, compliance badge or all-purpose eval platform. Its job is to make organisational AI **inspectable, evidenced and traceable**.

The core chain is:

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

The sibling products answer different questions:

- **TOPO** — what may AI know? Portable, user-controlled context and memory.
- **RACK** — how should AI work? Portable working practice, boundaries and verification.
- **CRUX** — where is AI used, what evidence supports the claims made about it, and what actually happened?
- **Ship Check** — what implementation evidence can be independently observed in software?

Integrations are optional, explicit and replaceable. CRUX owns its canonical transparency, claim/evidence and provenance records. It does not read another product's database or require another Good Ship runtime.

## Core model

```text
Organisation
    │
    ├── AI Use
    │      └── System
    │             ├── System Version
    │             │      ├── Process
    │             │      ├── Components
    │             │      ├── Data Sources
    │             │      ├── Human Roles
    │             │      ├── Decision Points
    │             │      ├── Risks
    │             │      └── Safeguards
    │             ├── Claims
    │             │      └── Evidence
    │             │              └── Evaluations
    │             └── Runs
    │                    ├── Events
    │                    └── Receipts
    └── Change History
```

The first implementation focus is the evidence spine:

- `Claim`
- `Evidence`
- `EvaluationDefinition`
- `EvaluationRun`
- `EvidenceEnvelope`

These contracts are provider-neutral. RACK, Ship Check, external eval tools, custom test suites, research, audits and human evaluations should all be able to contribute evidence without becoming CRUX dependencies.

## Repository shape

CRUX follows the same broad engineering conventions as RACK and Ship Check:

- `packages/schemas` — canonical runtime and interchange schemas;
- `docs/specification.md` — accepted product/specification direction;
- `docs/roadmap.md` — active implementation roadmap;
- `docs/architecture.md` — product boundaries and interoperability rules;
- later `packages/core` — claim/evidence resolution and versioning policy;
- later `packages/cli` — validation and inspection tooling;
- later application surfaces — guided authoring, publishing, system exploration and receipts.

The schema package is TypeScript + Zod, built and tested independently.

## Development

Requires Node.js 22.12 or newer and pnpm 10.15.

```bash
pnpm install
pnpm check
pnpm build
```

Run schema tests directly:

```bash
pnpm --filter @crux/schemas test
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
- **Minimal integration data** — connected tools exchange bounded evidence rather than entire projects, prompts or conversations.

## Status

CRUX is at **0.1-alpha.1**: specification and schema foundation.

See [the specification](docs/specification.md), [roadmap](docs/roadmap.md) and [architecture](docs/architecture.md).

## Licence

Code is intended to be Apache-2.0. Specification and example content are intended to be CC BY 4.0 unless a file says otherwise.
