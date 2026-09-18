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

## Audience projection and audience experience are different things

Internal, public and affected-person disclosure projections answer:

> **What may this audience see?**

That is a safety and information-boundary question. It does **not** imply that each audience should receive the same interface with different fields hidden.

The composition of the view should answer a second question:

> **What does this audience need to understand?**

The three primary reading jobs are therefore:

### Internal · scrutinise and improve

Internal readers are responsible for the use. Their view may be denser and should foreground the intended process, human authority, claims, evidence, limitations, gaps and unknowns, plus operational/runtime detail when useful.

### Public · understand the system

The public view should feel like a clear transparency page. It should foreground the plain-language purpose, a visual process, the boundary of AI's authority, who decides, and the strongest inspectable evidence. Internal operational detail should not define the page.

### Affected person · understand my case

The affected-person view should be case-centred when a receipt is available. It should start with what AI contributed in the particular case, what happened next, who had final authority, the outcome, and the route for questions or challenge. The wider system description is supporting context, not the main story.

**Projection decides what may be shown. Audience design decides what should be foregrounded.**

Public and affected-person rendering must continue to consume only their disclosure projections, never canonical objects filtered at render time.

## Proportionality

CRUX should not make a writing assistant feel like a high-risk automated decision system.

A low-consequence assistive use may only need:

- a clear description of where AI is involved;
- what it can do;
- who remains responsible;
- one or two relevant claims/evidence items if useful.

A consequential or agentic use should progressively reveal more questions about authority, pre-effect review, bounded actions, challenge routes and particular cases.

The amount of CRUX should follow the amount of consequence.

## Visual grammar

Prefer **show first, explain second, detail on demand**.

Use a small repeated set of visual primitives rather than adding more prose:

- a distinct **AI** node for AI contribution;
- a **person** node for human involvement;
- a **decision** shape for consequential authority;
- an explicit **AI stops here** boundary where human authority takes over;
- **✓** for evidence that supports an account;
- **△** for evidence that qualifies or challenges it;
- **○** and a dashed treatment for something unknown, unavailable or not disclosed;
- a case timeline for what happened in a particular execution.

These marks should carry meaning consistently across audiences, while the surrounding composition changes to fit the audience's job.

## UI implications

The interface should optimise for comprehension in this order:

1. **A short answer first.** A reader should quickly understand AI's role, human authority and whether AI can act by itself.
2. **Show before explaining.** Prefer process diagrams, authority boundaries, evidence marks and timelines over repeated explanatory paragraphs.
3. **One coherent story per audience.** Do not make readers reconstruct the meaning from schema-shaped tabs.
4. **Plain language first.** SAYS / SHOWS / HAPPENED can reinforce the reasoning model, but ordinary labels should carry the meaning.
5. **Editing is separate.** Reading views contain no inline evidence or receipt editors.
6. **Audience views are purpose-specific.** Internal, public and affected-person views may have different layouts and starting points.
7. **Technical detail is progressive.** Provider/model observations, IDs and provenance can sit behind detail affordances.
8. **Unknown appears locally.** Missing evidence or unresolved authority is shown exactly where the gap occurs.
9. **Examples teach by contrast.** Writing assistant, funding review and bounded action should illustrate increasing consequence without becoming a separate navigation system.

## A useful comprehension test

After reading the appropriate CRUX view, someone unfamiliar with the schema should be able to answer, in their own words:

- Where exactly does AI enter the process?
- What can it influence or cause?
- Who has final authority?
- What evidence can I inspect for important statements?
- If this is about my case, what did AI actually contribute and what happened next?
- What can I do if I have a question or concern?
- What remains unknown?

If the interface makes those answers easy, CRUX is doing its job. If the user instead has to learn CRUX's record types, lenses or implementation terminology, the UI is exposing too much of the schema.