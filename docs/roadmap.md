# CRUX roadmap

**Status:** active prototype  
**Updated:** 19 September 2026

## Direction

CRUX should be a guided way to think clearly about AI in an organisation.

The canonical schema is the portable output of that thinking, not the user's mental model.

The next beta is organised around four questions:

1. **Where is AI involved?**
2. **What power does it have here?**
3. **Why should I believe what the organisation says?**
4. **What happened in a particular case?**

See `docs/PRODUCT_MENTAL_MODEL.md`.

The underlying operating rule remains:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

CRUX remains standalone. TOPO, RACK, Ship Check, eval tools and observability systems are optional producers/consumers, never requirements.

## What the prototype has demonstrated

CRUX has a substantial technical prototype:

- canonical organisation / AI-use / system / process contracts;
- Claim / Evidence / EvidenceLink separation;
- evidence scope, conflict and freshness resolution;
- explicit unknown / withheld / supplier-undisclosed states;
- metadata-first Run / Event / Trace / Receipt provenance;
- portable `crux-bundle/0.1` and derived disclosure format;
- standalone CLI validation, inspection, evidence import and projection;
- metadata-first AI SDK/OpenTelemetry instrumentation experiments;
- provider-neutral semantic ingestion and PostgreSQL persistence experiments;
- real external-provider and Neon paths manually exercised end-to-end.

These are **technical paths exercised in a prototype**. They are not evidence that CRUX is usable, understandable or ready for organisational adoption.

No external participant evidence yet supports a claim that:

- a normal author can create a good CRUX record unaided;
- a non-author can correctly understand a disclosure;
- the current ontology is the minimum useful ontology;
- organisations will maintain these records;
- an independent consumer can use the open contract effectively.

Those are now the important questions.

## Discovery before declaration — current product test

CRUX should not usually begin with a blank transparency form.

The preferred onboarding sequence is:

```text
CONNECT
   ↓
DISCOVER
   ↓
CONFIRM
   ↓
OBSERVE
   ↓
RECONCILE
```

**Connect** to where AI already lives: source code, a project export, an AI gateway, a workflow platform, a runtime or another bounded evidence source.

**Discover** technical signals without inventing organisational meaning. A producer may report SDKs, providers, model-call boundaries, workflow/job names, human-review markers, decisions, actions or runtime observations using `crux-discovery/0.1`.

**Confirm** turns one or more discovered signals into a human-recognised AI use. Purpose, affected people, authority, challenge routes and action limits stay unanswered until a person supplies or confirms them.

**Observe** installs or enables the smallest appropriate runtime path for that environment.

**Reconcile** keeps the human declaration and observed behaviour separate and makes meaningful differences visible.

Ship Check is the first source-code discovery producer, not a dependency. The same discovery contract must work for gateway, workflow-platform and runtime producers.

### First test

- [x] define a producer-neutral `crux-discovery/0.1` contract;
- [x] group discovery signals into reviewable AI-use candidates without creating canonical declarations;
- [x] build a discovery-first onboarding surface;
- [x] accept a real public GitHub repository in the hosted pilot and produce `crux-discovery/0.1` from a bounded source/config probe;
- [x] run Ship Check discovery against Open Recommendations Local and keep it as a regression target;
- [x] discover the materially different Python/Anthropic **Soundings Ask** workflow with the same Ship Check command and generic rules;
- [x] generate a smallest-hook observation proposal from a confirmed candidate;
- [x] turn the Open Recs `source.extract` proposal into a real reviewable PR (#25), opt-in and metadata-only, without merging it;
- [x] turn Soundings `Ask` into a second real reviewable observation PR (#60), opt-in and metadata-only, and pass Soundings' own Ruff/mypy/UI/full-server CI without merging it;
- [x] encode both green target-repository patches as deterministic fail-closed adapters behind the same patch-readiness and draft-PR machinery;
- [x] collapse exact observation setup into automatic readiness + one **Create review PR** action, keeping technical patch mechanics on demand;
- [x] lock the dependency-free Open Recs observation payload against CRUX's canonical ingest schema;
- [ ] observe whether a person can recognise the discovered candidates without CRUX terminology;
- [x] make human confirmation create a canonical CRUX declaration rather than remaining UI state;
- [x] add the plain-language **What power does the AI have?** step before minting an exact SystemVersion;
- [x] bind the observation hook to that human-confirmed exact SystemVersion;
- [x] export the confirmed internal draft as a reference-valid portable `crux-bundle/0.1`;
- [x] pass a real gateway/runtime observation through the same discovery contract and onboarding without source-code evidence;
- [x] add a GitHub App/private-repository connection and repository chooser;
- [ ] configure the GitHub App on production and run one real private-repository discovery end-to-end;
- [ ] approve the App write-permission upgrade and run the first live CRUX-created draft observation PR end-to-end;
- [x] let an authorised GitHub connection open the generated observation PR from CRUX;
- [ ] build the actual account/platform connection for a non-source-code producer (gateway or workflow platform) and test discovery from that live connector.

The first real discovery run found two candidate uses from executable Open Recs evidence — `chat.search` and `source.extract` — plus shared AI SDK/provider infrastructure. The Ship Check regression excludes Markdown and test/spec evidence and keeps discovery concise. CRUX's hosted public-GitHub probe is deliberately lighter-weight than Ship Check and now uses the same discovery envelope.

The second application test is deliberately different: Soundings is Python, uses the Anthropic SDK directly, and runs an agent/tool loop. Generic discovery identifies **Ask**, the Anthropic SDK import and the real `messages.create` boundary in `server/soundings/ask/orchestrator.py`. Weak unscoped review/governance clues cannot create separate AI-use candidates by themselves.

The observation test is also real but bounded. Open Recs PR #25 adds an opt-in, dependency-free metadata emitter only around the confirmed `source.extract` workflow. CRUX configuration is absent in CI, so the hook makes no network request there. Open Recs typecheck/lint/unit/build and local e2e pass; its existing hosted-mode signup/upload/admin e2e currently fails independently at source creation/admin editing and has been documented on the PR. The PR remains open and unmerged.

A separate producer-contract test uses the real provider/model metadata observed during the production runtime smoke (`gateway` → `anthropic/claude-3-haiku`). It passes through the same `crux-discovery/0.1` candidate and confirmation flow with no repository paths. This validates the abstraction boundary, **not** a finished AI Gateway account connector.

The test is not whether CRUX can detect every AI call. It is whether an ordinary user can go from **connect something they already use** to **a useful, accurate AI-use record** with very little technical configuration.

## P0 — safe disclosure boundary

Before using CRUX with real organisational information:

- [x] stop copying full AI-use objects into public projections;
- [x] use explicit typed projection shapes for the main disclosure collections;
- [x] prevent internal `purpose`, owner role and authoring timestamps leaking through a public AI-use projection;
- [x] add field-survival regression tests;
- [ ] make the pilot public/affected-person UI render projected objects directly rather than filtering and re-rendering internal records;
- [ ] ensure public claim interpretation cannot be upgraded by evidence hidden from that disclosure;
- [ ] audit nested SystemVersion objects for fields that need public-safe projection rather than object-level visibility alone;
- [ ] add a disclosure fixture test that snapshots/asserts the complete public funding-review shape.

Disclosure should be constructive: build a safe object from allowed fields rather than spread an internal object and remove fields afterwards.

## P1 — establish the human mental model

Do not add more ontology or infrastructure before this work.

### Four-question experience

Prototype one coherent experience around:

```text
WHERE IS AI?
      ↓
WHAT POWER DOES IT HAVE?
      ↓
WHY SHOULD I BELIEVE THIS?
      ↓
WHAT HAPPENED HERE?
```

The interface should hide CRUX implementation vocabulary unless advanced inspection genuinely requires it.

### Visual grammar

Develop and test a small visual system for:

- AI contribution;
- human judgement;
- decision;
- action;
- **SAYS** — organisational declaration;
- **SHOWS** — evidence;
- **HAPPENED** — a specific execution/outcome;
- **UNKNOWN** — unavailable, withheld, undisclosed or unresolved information.

The same grammar should work in authoring, public reading and affected-person explanation.

### Consequence-led authoring

Make the simplest use genuinely simple.

A low-consequence writing assistant should require only a few plain-language questions.

Reveal decision authority, action limits, challenge routes, reversibility and deeper evidence prompts only when the use is consequential or can cause actions.

Do not ask people to select ontology categories when CRUX can infer or progressively map their plain-language answer underneath.

## P2 — make one example exceptional

Use `examples/funding-review` as the primary teaching example.

Build a "See how this was built" path:

1. start from the real-world process;
2. mark where AI enters;
3. identify human/AI authority;
4. ask the critical control question;
5. show the evidence that answers it;
6. show a specific outcome separately from general control evidence.

The example should teach the reasoning, not just display a completed bundle.

Keep writing-assistant and bounded-action as contrast cases, but do not spread design effort equally across three examples before the main mental model works.

## P3 — fast formative learning

Run three rough sessions as soon as the mental-model prototype is coherent:

- one ordinary AI user/author;
- one domain/service owner describing a consequential process;
- one non-author reader.

Observe without teaching CRUX terminology first.

Change obvious copy, guidance, sequence and visual problems immediately. This is not the point to freeze the UI until six sessions have completed.

Capture:

- where people hesitate;
- what they think each visual means;
- whether they can tell AI assistance from ability to act;
- whether they distinguish **SAYS**, **SHOWS** and **HAPPENED**;
- which questions feel irrelevant or bureaucratic;
- where "I don't know" is actually the accurate answer;
- what a non-author misunderstands without prompting.

## P4 — structured learning cycle

After the fast formative loop, use `docs/BETA_LEARNING_PROTOCOL.md` for comparable sessions across:

- low-consequence productivity;
- consequential human decision;
- bounded action.

Broad schema changes should require repeated evidence that the model cannot faithfully represent something important.

The key questions remain:

- Can a non-author locate AI involvement?
- Can they tell what AI can cause to happen?
- Can they identify where final authority sits?
- Can they distinguish an organisational assertion from visible evidence?
- Can they distinguish general control evidence from what happened in one case?
- Can they see what remains unknown or withheld?
- Can an affected person understand an outcome and challenge route?
- Does useful explanation survive safe disclosure?

Do not collapse results into a single trust/completeness score.

## P5 — independent open-contract consumer

Only after the disclosure and mental model are clearer, build a deliberately small independent CRUX reader.

It should consume `crux-disclosure/0.1` and render only:

- where AI is involved;
- what power it has;
- what the organisation says;
- what evidence is visible;
- what happened;
- what remains unknown.

It should share as little implementation/UI code with the pilot as practical.

This is the real beta test of the "open contract" claim: can something other than CRUX understand CRUX?

## Infrastructure freeze

Until P0–P4 produce evidence that further infrastructure is needed, do not expand:

- runtime telemetry breadth;
- production identity/OIDC/tenancy;
- asynchronous queues/delivery guarantees;
- hosted MCP;
- application workspaces/accounts;
- richer database projections;
- new framework adapters;
- additional ontology categories.

Existing instrumentation, transport and Postgres work stays in the repo as demonstrated technical capability and a source of future options.

It is not the current product bottleneck.

## Later — evidence-backed publishing

If authoring/comprehension learning supports the product direction:

- strengthen publication and change history;
- make freshness and scope of evidence clearer;
- support organisational review cycles;
- improve affected-person explanations;
- add selected evidence integrations that reduce manual work;
- stabilise runtime instrumentation only where observed behaviour materially improves explanation.

## Later — optional ecosystem integrations

### RACK

Working-practice verification can produce bounded EvidenceEnvelopes for CRUX. CRUX constraints may propose RACK practice changes, but never silently change them.

### TOPO

Purpose-bound context may help an author draft a CRUX record, while personal memory remains distinct from organisational truth.

### Ship Check

Ship Check findings can become bounded technical evidence. Absence of a finding must never be translated into proof of a broader organisational claim.

### Generic evaluation/observability systems

Keep the EvidenceEnvelope and semantic transport contracts provider-neutral. Add adapters only when there is a real producer/consumer use case.

## Cross-cutting constraints

- CRUX remains standalone.
- The user mental model is simpler than the canonical data model.
- Public disclosure is an explicit safety boundary.
- Unknown and contradictory information remains visible.
- Claims do not become facts because an organisation typed them into CRUX.
- Runtime observations do not silently become organisational meaning.
- No universal trust, ethics or completeness score.
- No employee-performance surveillance layer.
- Integrations exchange bounded evidence/metadata rather than whole projects, prompts or conversations by default.
- Schema changes follow observed modelling gaps, not speculative completeness.
- Documentation must distinguish prototype demonstration from external validation.

## Current product test

> Can someone connect a tool or project they already use, recognise the AI use CRUX discovers, add only the organisational meaning technology cannot know, and then understand how runtime evidence relates to that declaration — without first learning CRUX?

Until we have evidence for that, this is the roadmap.
