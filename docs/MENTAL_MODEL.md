# CRUX mental model

**Updated:** 18 September 2026

CRUX should feel like a way to understand one real use of AI, not like a register, schema browser or governance database.

The interface should therefore begin with the thing a person is trying to understand:

> **What is AI doing here, what power does it have, why should I believe this account, and what happened in a particular case?**

The canonical CRUX model remains richer than this mental model. That is intentional. The schema is infrastructure; the mental model is the product experience.

## The reading model

The four questions are useful, but they are not four equivalent categories.

### 1–2 · Understand the system

**Where is AI involved?**

Start with the real-world process. Show where information enters, where AI contributes, where people intervene, where decisions happen and what actions or outcomes follow.

**What power does it have?**

Describe what AI can influence, decide or cause in this particular process. The important distinction is not model sophistication; it is authority and consequence.

Together these two questions describe **how the use is meant to work**.

### 3 · Check the account

**Why should I believe this?**

Separate the organisation's description from evidence that can be inspected.

- **SAYS** — what the organisation describes or claims to be true.
- **SHOWS** — evidence that supports, qualifies, challenges or leaves that description unresolved.

SAYS and SHOWS are not two competing truths. They are different kinds of information that should not be silently collapsed into one another.

### 4 · Inspect a case

**What happened here?**

A particular execution or consequential case is different again.

- **HAPPENED** — what AI contributed in this case, what followed, who exercised authority and what the outcome was.

A case can provide useful evidence, but it should not be confused with the organisation's general description of how the system works.

## UNKNOWN is a state, not a fourth layer

UNKNOWN can occur anywhere:

- where AI involvement is unclear;
- where authority is not recorded;
- where a claim has no supporting evidence;
- where the effect of AI in a particular case cannot be established;
- where a supplier has not disclosed something.

The UI should show the unknown at the point where it matters. It should not present UNKNOWN as another category alongside SAYS, SHOWS and HAPPENED.

## The primary unit is a use of AI

People usually care about a use of AI in a real process before they care about the underlying model, provider, component or system version.

CRUX should therefore lead with:

1. the **use** and its purpose;
2. the **process** in which AI appears;
3. AI's **power and boundaries**;
4. human **authority**;
5. inspectable **evidence**;
6. particular **cases**, when they matter.

Provider, model, version, runtime observation and provenance remain available underneath this story rather than defining the first screen.

## Reading and authoring are different jobs

The current record may be editable, but reading and editing should not happen in the same cognitive mode.

### Read mode

A reader should be able to understand the use without seeing editors, schema controls or prompts to add records.

The preferred reading order is one continuous story:

```text
Short answer
  ↓
01 Where is AI involved?
  ↓
02 What power does it have?
  ↓
03 Why should I believe this?
  ↓
04 What happened here?   [when relevant]
```

The questions can be jump links, but the reader should not have to open four separate tabs to assemble the story.

### Edit mode

Editing should be a separate guided activity: **Describe this use**.

The same four questions can structure authoring, with progressive detail only when the use is consequential or can cause actions.

## Audience is a projection, not a mode of authorship

Internal, public and affected-person views answer a different question:

> **What may this audience see?**

They should be presented as views of the same record, not mixed with the authoring workflow.

A reader-facing label such as **View as: Internal · Public · Affected person** is clearer than making disclosure lenses compete with the four-question navigation.

Public and affected-person rendering must continue to consume only the disclosure projection, never canonical objects filtered at render time.

## Proportionality

CRUX should not make a writing assistant feel like a high-risk automated decision system.

A low-consequence assistive use may only need:

- a clear description of where AI is involved;
- what it can do;
- who remains responsible;
- one or two relevant claims/evidence items if useful.

A consequential or agentic use should progressively reveal more questions about authority, pre-effect review, bounded actions, challenge routes and particular cases.

The amount of CRUX should follow the amount of consequence.

## UI implications

The interface should optimise for comprehension in this order:

1. **A short answer first.** A reader should quickly understand AI's role, human authority and whether AI can act by itself.
2. **One continuous reading surface.** The four questions are sections in a story, not four destinations that must be mentally recombined.
3. **Plain language first.** SAYS / SHOWS / HAPPENED can reinforce the reasoning model, but ordinary labels such as “What the organisation says”, “Evidence we can inspect” and “A particular case” should carry the meaning.
4. **Editing is explicit.** Read mode contains no inline evidence or receipt editors.
5. **Disclosure controls are secondary.** Audience switching belongs beside the record context, not in the main conceptual navigation.
6. **Technical detail is progressive.** Provider/model observations, IDs and provenance can sit behind detail affordances.
7. **Unknown appears locally.** Missing evidence or unresolved authority is shown exactly where the gap occurs.
8. **Examples teach by contrast.** Writing assistant, funding review and bounded action should illustrate increasing consequence without becoming a separate navigation system.

## A useful comprehension test

After reading a CRUX view, someone unfamiliar with the schema should be able to answer, in their own words:

- Where exactly does AI enter the process?
- What can it influence or cause?
- Who has final authority?
- Which important statements are descriptions, and what evidence can I inspect for them?
- If a particular case is shown, what did AI actually contribute and what happened next?
- What remains unknown?

If the interface makes those answers easy, CRUX is doing its job. If the user instead has to learn CRUX's record types, lenses or implementation terminology, the UI is exposing too much of the schema.