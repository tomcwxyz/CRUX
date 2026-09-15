# CRUX pilot plan

**Target:** `0.1-beta`  
**Purpose:** test whether CRUX transparency records help people understand real organisational AI use, not whether organisations can fill in a schema.

## Cohort

Start with 5–8 organisations with materially different AI use. Aim for a mix of:

- a funder or grant-maker;
- a frontline charity/service organisation;
- a public body or public-service partner;
- an organisation using AI mainly for internal productivity;
- an organisation building or operating its own AI product;
- at least one bounded agentic workflow.

Each organisation should document 2–3 AI uses. At least two pilot cases should involve consequential processes.

## Pilot artefacts

Each participating organisation should produce a canonical CRUX bundle and, where appropriate:

- a public disclosure projection;
- an affected-person projection;
- at least one evidence-backed claim;
- at least one deliberately unevidenced/declarative claim, so the distinction is visible;
- an evaluation record where evaluation already exists;
- one receipt for a consequential example where this can be done safely.

CRUX should not require participants to adopt RACK, TOPO, Ship Check or any particular eval provider.

## Authoring test

Observe where participants struggle to describe:

- the organisational purpose before naming a model;
- AI influence separately from AI agency;
- different decision points with different authorities;
- what is genuinely known versus supplier-undisclosed;
- the difference between a claim and evidence;
- what evidence actually applies to a particular system version;
- what can be safely disclosed at public/affected/trusted/internal levels.

Do not add schema concepts merely because participants prefer different words. Add them when the current model cannot faithfully represent something important.

## Comprehension test

Give the resulting disclosure to someone who did not author it. Without coaching, can they answer:

1. Where is AI involved?
2. What does the AI actually do?
3. What information or data does it use?
4. Can it make or trigger consequential decisions or actions?
5. Where is human judgement or authority?
6. What claims is the organisation making?
7. Which claims have evidence, and what kind?
8. Is any evidence stale, qualified or contradictory?
9. What changed between system versions?
10. For an individual receipt, what did AI contribute and what happened because of it?
11. Can the affected person challenge or query the outcome?

Record misunderstanding as a product/schema signal. The goal is not to teach people CRUX vocabulary.

## Evidence test

For evidence-backed claims, check whether a reader can distinguish:

- declaration from observation;
- eval result from organisational impact;
- a passed bounded check from proof of safety;
- evidence about one version from evidence about the system generally;
- external evidence from CRUX-native evidence.

## Disclosure test

Compare canonical, public and affected-person views. Check that:

- hidden object references do not leak through surviving records;
- hidden causal steps are indicated rather than silently joining unrelated visible steps;
- affected-person receipts remain useful without raw prompts/source material;
- supplier or security-sensitive details can remain internal without making the public explanation meaningless.

## Standalone test

At least half the pilot should use CRUX with **none** of TOPO, RACK or Ship Check connected.

The standalone proposition fails if meaningful transparency depends on another Good Ship product.

## Optional interoperability tests

Where useful, separately test:

- RACK verification → neutral EvidenceEnvelope → CRUX claim evidence;
- Ship Check assurance → neutral EvidenceEnvelope → CRUX technical safeguard claim;
- TOPO purpose-bound context → CRUX authoring suggestion, with explicit human acceptance;
- third-party/custom eval → EvaluationRun/Evidence without provider-specific core fields.

These tests should improve interoperability, not redefine CRUX around sibling products.

## Exit criteria

Move from schema beta towards the guided product when:

- the same core model survives the pilot without repeated structural exceptions;
- non-authors can correctly explain the role and authority of AI from CRUX disclosures;
- claims and evidence are meaningfully distinguishable;
- disclosure projections are useful rather than merely safe;
- receipts explain consequential cases without requiring sensitive raw content;
- the standalone workflow is viable for small organisations;
- unresolved gaps are understood well enough to make deliberate schema changes rather than speculative ones.
