# CRUX beta learning protocol

**Status:** active  
**Started:** 16 September 2026

## Purpose

The technical spine is now strong enough that the main beta question is no longer whether CRUX can persist runtime evidence. It is whether CRUX helps real people understand organisational AI use without requiring them to learn CRUX vocabulary.

This protocol turns the pilot into a repeatable learning exercise rather than a sequence of product demos.

The governing rule remains:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

Do not add schema concepts because one participant prefers different terminology. Treat schema change as justified only when the current model cannot faithfully represent something important, or when the same structural misunderstanding appears repeatedly.

## Three anchor cases

Use the same three contrasting cases throughout the first beta learning cycle.

### Case A — writing assistant

Source: `examples/writing-assistant/crux.json`

Purpose: test a common, low-consequence productivity use where AI drafts or transforms content but does not hold organisational decision authority.

What this case should expose:

- whether purpose can be understood before model/provider detail;
- whether readers can distinguish assistance from agency;
- whether claims and evidence remain proportionate for an everyday use;
- whether CRUX feels useful rather than bureaucratic when the consequences are low.

### Case B — funding review

Source: `examples/funding-review/crux.json`

Purpose: test a consequential process where AI can influence a decision affecting another person or organisation but human authority remains explicit.

What this case should expose:

- whether readers can identify where AI influence begins and ends;
- whether different decision points and human authorities remain understandable;
- whether an affected person can understand the process and challenge route;
- whether evidence applying to one SystemVersion is distinguishable from broader organisational claims;
- whether receipts explain a specific case without exposing sensitive source content.

### Case C — bounded-action workflow

Source: browser Workflow test plus the runtime records produced through `@crux/instrumentation`.

Canonical shape:

```text
model invocation
  → human review
  → decision
  → bounded action
  → Run / Event / Trace
  → review-required receipt proposal
```

Purpose: test the boundary between observed behaviour and organisational meaning in a partially automated workflow.

What this case should expose:

- whether automatic runtime evidence improves transparency without inventing purpose or authority;
- whether readers understand that an observed model/provider/action is evidence, not an organisational claim;
- whether a receipt proposal is clearly incomplete until outcome, AI effect, final authority and challenge information are reviewed;
- whether bounded actions and reversibility are understandable without turning CRUX into an observability product.

## Session pattern

Run each case through the same four stages. Keep the facilitator language neutral and avoid teaching CRUX terminology before the participant has tried to interpret the record.

### 1. Authoring observation

Ask an author or domain owner to create or review the record while thinking aloud.

Capture:

- where they hesitate;
- where they cannot represent something important;
- where labels cause misunderstanding;
- where they provide information CRUX does not actually need;
- where they omit information a non-author later needs;
- time spent resolving structure rather than describing the real process.

Do not treat preference for a different word as a schema failure.

### 2. Non-author comprehension

Give the working/public/affected-person view, as appropriate, to someone who did not author it. Without coaching, ask them to explain:

1. Where is AI involved?
2. What does the AI actually do?
3. What information or data does it use?
4. Can it make or trigger a consequential decision or action?
5. Where is human judgement or authority?
6. What is the organisation claiming?
7. What evidence supports, qualifies or contradicts those claims?
8. What remains unknown, withheld or supplier-undisclosed?
9. What happened in the specific case, if a receipt exists?
10. What can the affected person challenge or query?

Record the answer before correcting anything. Record misunderstanding as evidence about the product, disclosure or schema.

Do not produce a single comprehension or trust score. Keep question-level observations so disagreement and nuance are not flattened.

### 3. Disclosure comparison

Compare internal, public and affected-person views.

Check whether:

- useful explanation survives redaction;
- hidden causal steps are signalled rather than silently skipped;
- sensitive model, supplier, security or source details can remain hidden without making the process unintelligible;
- the affected-person view contains what someone needs to understand agency, authority, outcome and challenge;
- the public view does not accidentally imply stronger evidence than the internal record supports.

### 4. Declared-versus-observed review

For cases with runtime evidence, compare what the organisation declared with what the system actually reported.

Ask the participant to distinguish:

- declaration;
- observation;
- divergence requiring review;
- contradiction supported by evidence;
- information CRUX still cannot know automatically.

Provider/model divergence must not be presented as a trust, safety or compliance judgement.

## What to record after every session

Use the pilot-session sheet plus a short learning note containing:

- case and disclosure lens used;
- author/non-author role;
- questions answered correctly, partially or incorrectly;
- exact misunderstandings worth preserving;
- authoring friction;
- disclosure failures;
- missing organisational meaning;
- useful automatic evidence;
- noisy or unnecessary automatic evidence;
- candidate product-copy change;
- candidate authoring-scaffold change;
- candidate schema change, if any;
- whether the issue was terminology, product design, disclosure logic or a genuine modelling gap.

A schema-change candidate should include the concrete thing CRUX failed to represent and why existing fields/relationships are insufficient.

## First learning cycle

Run at least six sessions before broad schema change:

- two sessions using the writing-assistant case;
- two sessions using the funding-review case;
- two sessions using the bounded-action workflow;
- in each pair, include at least one non-author reader;
- include at least one affected-person-style reading of the funding case;
- include at least one declared-versus-observed divergence in the bounded-action case.

The cases may be replaced by real organisational records as soon as suitable pilot partners are available, but retain the three case shapes: low-consequence productivity, consequential human decision, and bounded agentic action.

## Decision rules

Prefer changes in this order:

1. improve explanatory copy;
2. improve authoring scaffolding/examples;
3. improve disclosure projection;
4. improve derived interpretation in `@crux/core`;
5. change the canonical schema only when the model itself is insufficient.

Do not broaden telemetry collection to solve an authoring problem. Do not add manual fields to duplicate facts that runtime systems can safely and reliably report.

## Exit signal for this cycle

The first learning cycle is successful when we can say, with session evidence rather than intuition, which of the following is true for each case:

- a non-author can locate AI involvement;
- a non-author can identify human/AI authority correctly;
- claims are distinguishable from evidence;
- observed behaviour is distinguishable from declared meaning;
- consequential receipts are understandable without raw sensitive content;
- disclosure remains useful after redaction;
- unanswered questions remain visible rather than being converted into a score;
- the current schema either survives the cases or has a small set of evidenced structural gaps.

That evidence should determine the next product iteration.