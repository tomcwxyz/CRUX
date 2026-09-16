# CRUX pilot plan

**Target:** `0.1-beta`  
**Purpose:** test whether CRUX transparency records help people understand real organisational AI use, not whether organisations can fill in a schema.

The repeatable session method now lives in `docs/BETA_LEARNING_PROTOCOL.md`. Use the downloadable `crux-pilot-session.md` sheet from the pilot app to capture comparable evidence.

## First learning cycle

Before broad schema change, run at least six structured sessions using three contrasting case shapes:

- low-consequence productivity — `examples/writing-assistant`;
- consequential human decision — `examples/funding-review`;
- bounded agentic action — browser Workflow/runtime path.

Run two sessions per shape, with at least one non-author reader in each pair. Include at least one affected-person-style reading of the consequential case and one declared-versus-observed divergence in the bounded-action case.

The goal is to learn whether CRUX's current model survives materially different situations and whether people can understand the resulting disclosures without being taught CRUX vocabulary.

## Cohort

After the anchor-case cycle, start with 5–8 organisations with materially different AI use. Aim for a mix of:

- a funder or grant-maker;
- a frontline charity/service organisation;
- a public body or public-service partner;
- an organisation using AI mainly for internal productivity;
- an organisation building or operating its own AI product;
- at least one bounded agentic workflow.

Each organisation should document 2–3 AI uses. At least two pilot cases should involve consequential processes.

The synthetic/fixture cases may be replaced by real organisational records as soon as suitable partners are available, but retain the three case shapes so learning remains comparable.

## Pilot artefacts

Each participating organisation should produce a canonical CRUX bundle and, where appropriate:

- a public disclosure projection;
- an affected-person projection;
- at least one evidence-backed claim;
- at least one deliberately unevidenced/declarative claim, so the distinction is visible;
- an evaluation record where evaluation already exists;
- one receipt for a consequential example where this can be done safely;
- a completed pilot-session sheet for each authoring/comprehension session.

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

Classify friction before proposing a schema change: explanatory copy, authoring scaffolding, disclosure projection, derived interpretation, or genuine representation gap.

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
8. What remains unknown, stale, qualified, limited or contradictory?
9. What happened in the specific case, if a receipt exists?
10. Can the affected person challenge or query the outcome?

Record the participant's answer before correcting it, then classify the interpretation at question level as correct, partial or incorrect. Do not aggregate these into an overall trust/comprehension score.

Record misunderstanding as a product/schema signal. The goal is not to teach people CRUX vocabulary.

## Evidence test

For evidence-backed claims, check whether a reader can distinguish:

- declaration from observation;
- eval result from organisational impact;
- a passed bounded check from proof of safety;
- evidence about one version from evidence about the system generally;
- external evidence from CRUX-native evidence.

## Declared-versus-observed test

Where runtime evidence exists, ask a non-author to distinguish:

- what the organisation declared;
- what the runtime observed;
- a divergence that requires review;
- something CRUX still cannot know automatically.

Provider/model divergence is descriptive evidence. It must not be interpreted or presented as a trust, safety or compliance judgement.

## Disclosure test

Compare canonical, public and affected-person views. Check that:

- hidden object references do not leak through surviving records;
- hidden causal steps are indicated rather than silently joining unrelated visible steps;
- affected-person receipts remain useful without raw prompts/source material;
- supplier or security-sensitive details can remain internal without making the public explanation meaningless;
- the public view does not imply stronger evidence than the internal record supports.

## Standalone test

At least half the organisational pilot should use CRUX with **none** of TOPO, RACK or Ship Check connected.

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
- declared meaning and observed behaviour are distinguishable;
- disclosure projections are useful rather than merely safe;
- receipts explain consequential cases without requiring sensitive raw content;
- the standalone workflow is viable for small organisations;
- unresolved gaps are understood well enough to make deliberate schema changes rather than speculative ones.
