# CRUX product mental model

**Status:** product north star for the next beta iteration  
**Updated:** 19 September 2026

CRUX should not behave like an interface for editing a transparency schema.

It should be a guided way to think clearly about AI in an organisation. The schema is the durable, portable output of that thinking.

The canonical contracts remain important, but they are an implementation model rather than the user's mental model.

## Discovery before declaration

CRUX should not normally ask someone to model their organisation from a blank form when useful technical evidence already exists.

The preferred entry journey is:

```text
Connect something already in use
        ↓
Discover bounded technical signals
        ↓
A person confirms whether they describe a real AI use
        ↓
Ask only for meaning technology cannot know
        ↓
Create an internal canonical draft
        ↓
Offer the smallest useful observation hook
```

Discovery is evidence, not declaration. Repository ownership does not establish organisational identity. Filenames do not establish purpose. A model call does not establish affected people, consequence or decision authority.

The confirmation step therefore asks in ordinary language:

- which organisation is using this;
- what the AI use is for;
- who can be affected;
- whether it could materially affect a person, service, opportunity or entitlement;
- what the AI can do: **Suggest / Recommend / Decide / Act**;
- if it can act, what constrains that action.

Those answers map into the existing canonical model underneath. Confirmation may create an internal Organisation, AI Use, System and exact SystemVersion, but it must not invent claims, evidence or outcomes.

The draft should remain portable before accounts/workspaces exist. Runtime observation must bind to the exact human-confirmed SystemVersion rather than becoming a free-floating description of the application.

## The four questions

A person using or reading CRUX should be able to organise the whole product around four questions.

### 1. Where is AI involved?

Start with the real-world process, not model/provider metadata.

Example:

```text
Application arrives
      ↓
AI highlights relevant evidence
      ↓
Funding officer reviews the original application
      ↓
Funding officer decides
      ↓
Applicant is notified
```

The product should make AI steps, human steps, decision points and actions visually distinct without requiring the reader to know CRUX vocabulary.

The canonical Process, ProcessNode, System and SystemVersion records sit underneath this view.

### 2. What power does it have here?

The reader's practical question is not "what is the agency enum?". It is:

> Can this AI cause something to happen to me without a person intervening?

The primary visual language should therefore use concepts such as:

```text
AI can:
Suggest → Recommend → Decide → Act

Before anything happens:
Person approves / Rule controls it / It can happen automatically
```

`AIInfluence`, `AIAgency`, Decision authority and Action controls remain canonical distinctions underneath this explanation.

Authors should encounter additional questions only when consequence or ability to act makes them necessary.

### 3. Why should I believe this?

CRUX's Claim / Evidence / EvidenceLink separation is a core strength, but those terms should not be the primary mental model.

Use a consistent visual grammar:

**SAYS**  
What the organisation declares.

**SHOWS**  
Evidence that supports, qualifies or challenges what it says.

**HAPPENED**  
Evidence about a particular execution, decision or outcome.

Example:

```text
SAYS
AI cannot reject an application.

SHOWS
✓ The deployed workflow has no automated rejection action.
✓ The process requires funding-officer approval.
⚠ Configuration evidence was last checked on 14 September.
⚠ This evidence applies to SystemVersion 2.3.
```

A declaration must remain visibly different from evidence-backed understanding. Missing, stale, contradictory, withheld and unknown evidence remain meaningful states rather than being flattened into a score.

### 4. What happened here?

For a consequential case, explain the actual path in ordinary language.

Example:

```text
AI highlighted two eligibility issues
      ↓
A funding officer checked the original application
      ↓
The funding officer made the decision
      ↓
The application remained eligible

Challenge or query this outcome: …
```

The canonical Run → Event → Trace → Receipt chain sits underneath this view. A user should not need to know the word "Receipt" to understand or record an outcome.

## Authoring principle: consequence reveals complexity

CRUX should not ask every author to populate the full ontology.

A low-consequence writing assistant should be describable quickly:

```text
What are you trying to do?
Where does AI help?
What can it do?
Who remains responsible?
```

Only escalate when necessary:

```text
Could this materially affect someone?
        ↓ yes
Who decides?
Can AI cause an action?
Does a person approve before effect?
How can someone challenge the result?
What evidence shows those controls are real?
```

A bounded or partially autonomous workflow can reveal further detail about action scope, limits, reversibility and observed behaviour.

The ontology becomes progressively visible because consequences demand it, not because CRUX happens to contain those fields.

## Guidance is part of the product

Do not rely on documentation to explain CRUX concepts after the interface has confused someone.

Use embedded guidance:

**Example**  
"AI drafts an email, but a staff member chooses whether to send it."

**Why we're asking**  
"This helps someone understand whether AI can only assist or can actually cause something to happen."

**Not sure?**  
"Choose 'I don't know yet'. Unknown is useful information in CRUX."

Prefer visual counter-examples where two concepts are easy to confuse:

```text
AI recommends → Person decides
```

is not the same as:

```text
AI recommends → System automatically acts
```

CRUX should improve the quality of organisational reasoning, not merely collect governance metadata.

## Examples are teaching artefacts

Examples should not just be completed CRUX datasets.

For the funding-review case, provide a "See how this record was built" path:

1. show the real-world process;
2. mark where AI enters;
3. mark where authority sits;
4. ask the critical claim: "How do we know AI cannot reject someone itself?";
5. attach the evidence that answers that question;
6. show one specific outcome separately from the general control evidence.

The worked example should teach the reasoning before showing the resulting record.

## Visual grammar

Develop a restrained, consistent visual language before adding more forms.

At minimum distinguish:

- **AI contribution** — where AI analyses, transforms, suggests or recommends;
- **human judgement** — where a person reviews, decides or approves;
- **decision** — where an outcome is determined;
- **action** — where something changes in the world or another system;
- **SAYS** — organisational declaration;
- **SHOWS** — evidence about a declaration or control;
- **HAPPENED** — specific-case provenance/outcome;
- **UNKNOWN** — information that is missing, withheld, not disclosed or genuinely not known.

The same grammar should work in authoring, public disclosures, affected-person explanations and independent readers.

## Disclosure is a safety boundary

Public and affected-person outputs must be constructed from explicit allowed fields. They must never be made by copying an internal object and hoping sensitive fields are removed afterwards.

Rules:

- projected types are explicit and strongly typed;
- public-safe variants such as `public_summary` must be used instead of internal fields such as `purpose`;
- the UI must render the disclosure projection itself, not use projection IDs to re-select internal objects;
- tests should assert which fields survive each disclosure level;
- hidden evidence must not silently influence a public status in a way the reader cannot inspect.

Safe transparency is a product requirement, not an export feature.

## What not to optimise next

Until the mental model and comprehension are tested with people, avoid broad expansion of:

- runtime telemetry breadth;
- hosted ingestion infrastructure;
- accounts/tenancy;
- queues and delivery guarantees;
- hosted MCP;
- additional ontology categories that have not emerged from observed authoring problems.

A small connector is justified when it directly tests the product journey — for example, letting someone choose a repository they already use or opening a generated observation change as a reviewable pull request. The connector is scaffolding for the product test, not a reason to build a general integration platform.

The technical paths already built remain useful experiments and future options. They are not evidence that the product itself is validated.

## Validation language

Use precise prototype language.

Prefer:

- **technical path exercised** rather than **accepted**;
- **demonstrated in the prototype** rather than **proven**;
- **manually verified by the developer** rather than **human-accepted**.

CRUX currently has no externally validated claim that organisations can author useful records unaided or that non-authors can correctly understand its disclosures.

That is the central beta question.

## Near-term learning loop

Do not wait for a large formal study before fixing obvious confusion.

### Formative loop

Run three rough sessions quickly:

- one ordinary AI user/author;
- one service or domain owner for a consequential process;
- one non-author reader.

Make obvious copy, visual and scaffolding changes immediately.

### Structured loop

Then use the beta learning protocol for more comparable sessions across low-consequence, consequential-human-decision and bounded-action cases.

Broad canonical schema changes should still require repeated evidence that the model cannot represent something important.

## Open-contract test

A provider-neutral format is only meaningfully open once something independent can consume it.

A later beta milestone should therefore be a deliberately small independent **CRUX reader** that takes a disclosure and answers/renders only:

- where AI is involved;
- what power it has;
- what the organisation says;
- what evidence is visible;
- what happened in a specific case;
- what remains unknown.

It should not share the pilot UI and should depend on as little CRUX implementation code as possible.

The purpose is not another product surface. It is a test that the interchange contract is genuinely understandable outside CRUX itself.

## Product test

The central test is now:

> Can CRUX help an ordinary person think clearly about where AI matters, what power it has, why organisational claims should be believed, and what happened — without first teaching them CRUX?

If not, the next problem is product design and explanation, not more infrastructure.
