# CRUX implementation status

**Updated:** 18 September 2026

CRUX is at `0.1-beta.0`.

The technical prototype can represent organisational declarations, evidence, observed behaviour and specific-case outcomes in a portable form. The main uncertainty is now whether real people can author and understand that transparency without learning the CRUX schema.

> **CRUX is a guided way to think clearly about AI in an organisation. The schema is the durable, portable output of that thinking — not the user's mental model.**

The underlying operating rule remains:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

## Human mental model

The pilot is now organised around four questions:

1. **Where is AI involved?**
2. **What power does it have here?**
3. **Why should I believe what the organisation says?**
4. **What happened in this particular case?**

The reader-facing reasoning language is:

- **SAYS** — an organisational declaration;
- **SHOWS** — evidence supporting, qualifying or challenging it;
- **HAPPENED** — a particular execution or outcome;
- **UNKNOWN** — information that remains unresolved or unavailable.

See `docs/PRODUCT_MENTAL_MODEL.md`.

## Implemented in the prototype

The canonical model and standalone tooling currently cover:

- Organisation / AIUse / System / SystemVersion;
- process graphs, components and data sources;
- human roles, decision authority and bounded actions;
- Claim / Evidence / EvidenceLink;
- evidence scope, freshness, conflict and version resolution;
- explicit unknown / withheld / supplier-undisclosed states;
- Run / Event / Trace / Receipt / Observation;
- `crux-bundle/0.1` and derived `crux-disclosure/0.1`;
- JSON Schema and CLI validation/inspection/redaction/evidence import;
- metadata-first runtime instrumentation;
- provider-neutral semantic ingestion and a PostgreSQL adapter;
- worked low-consequence, consequential-decision and bounded-action examples.

None of those implementation facts should be read as evidence that the product is useful, understandable or suitable for organisational adoption yet.

## Disclosure safety

A critical review on 18 September identified that the original disclosure projector filtered whole objects but could preserve internal fields inside a visible object.

That class of bug has now been addressed in the prototype by:

- constructing disclosure objects through explicit typed projections rather than spreading canonical records;
- substituting `public_summary` for internal AI-use `purpose` in public/affected-person projections;
- excluding internal owner/timestamp/detail fields from lower-disclosure AI-use projections;
- strongly typing the main `CruxDisclosureBundle` collections instead of leaving them as `unknown[]`;
- adding regression tests for field-level disclosure safety;
- separating the pilot UI's canonical working view from its projection-only public/affected-person view model.

Disclosure remains a high-risk boundary and should continue to be tested as an allow-list projection problem, not as cosmetic redaction.

## Technical paths exercised

The following paths have been exercised successfully in prototype tests. This language is deliberately narrower than “validated”, “accepted” or “proven”.

### Runtime instrumentation

Prototype checks have exercised:

- canonical Run/Event generation;
- Vercel AI SDK lifecycle mapping;
- OpenTelemetry GenAI metadata mapping;
- an external provider call through Vercel AI Gateway;
- prompt/output exclusion from the bounded metadata path;
- exact-SystemVersion provider/model comparison;
- a synthetic model → human review → decision → bounded action workflow;
- observed trace → review-required receipt proposal.

These are developer-run technical checks, not external usability or governance validation.

### Transport and durable ingress

Prototype checks have exercised:

- `crux-ingest/0.1` semantic writes;
- request replay/idempotency and changed-request conflict rejection;
- authenticated principal separation from producer provenance;
- optimistic revisions;
- PostgreSQL/Neon persistence;
- commit → replay → changed-request rejection through a production Vercel endpoint;
- reconnect, concurrency and rollback behaviour in the test path.

These checks established that the path can work technically. They do not establish a need for, or validate the design of, a hosted CRUX service.

## Pilot surface

The current pilot intentionally translates the schema into the four human questions rather than exposing canonical object names as the primary navigation.

It includes:

- visual process stories showing where AI, people, decisions and actions appear;
- plain-language explanation of what AI can influence or cause;
- **SAYS / SHOWS / UNKNOWN** evidence reasoning;
- **HAPPENED** specific-case explanations;
- consequence-led progressive authoring;
- embedded examples and “why we ask” guidance;
- a Funding Review teaching example;
- working/public/affected-person views;
- public and affected-person views rendered from the disclosure projection rather than filtered canonical records.

The canonical bundle remains the editable source of truth underneath.

## What has not been validated

As of 18 September 2026:

- no claim is made that a non-author can reliably understand CRUX without coaching;
- no claim is made that a service manager or domain owner can author a useful record unaided;
- no organisational adoption claim has been established;
- no regulator, auditor, procurement team or independent external tool has yet validated the interchange model as useful;
- the first independent consumer of the CRUX disclosure contract has not yet been built;
- the structured external learning cycle has not yet produced evidence sufficient to justify broad schema expansion.

These are the important product questions now.

## Current phase

Infrastructure expansion is paused by default.

The next unit of work is human learning:

1. make Funding Review an excellent teaching and comprehension example;
2. run fast formative sessions with authors and non-authors;
3. fix obvious copy, guidance and visual failures quickly;
4. then run the more structured beta learning cycle;
5. change the canonical schema only where observed use shows that it cannot faithfully represent something important;
6. later build a deliberately independent CRUX reader as a real test of the open-contract claim.

## Product boundary

CRUX remains standalone. TOPO, RACK, Ship Check and external evaluation/observability systems are optional context, practice, evidence or observation producers/consumers. None is a CRUX runtime dependency.
