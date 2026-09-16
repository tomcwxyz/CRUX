# CRUX pilot session sheet

Use this sheet alongside a CRUX `0.1-beta` authoring or comprehension session. The aim is to record what people understand, misunderstand or cannot represent — not to score the organisation or produce an overall CRUX score.

See `docs/BETA_LEARNING_PROTOCOL.md` for the shared session method.

## Session

- Organisation:
- Date:
- Facilitator:
- Author / participant:
- Reader / comprehension participant:
- CRUX bundle filename:
- AI use(s) tested:
- Case shape: productivity / consequential human decision / bounded agentic action / other
- Lens tested: working / public / affected person
- Participant relationship to the process:

## Authoring observations

For each point below, record what happened rather than teaching CRUX vocabulary.

| Area | What happened? | Problem type | Change needed? |
| --- | --- | --- | --- |
| Organisational purpose | | | |
| People affected | | | |
| AI influence | | | |
| AI agency | | | |
| Human responsibility | | | |
| Decision authority | | | |
| Actions / boundaries | | | |
| Claims | | | |
| Evidence | | | |
| Disclosure level | | | |
| Specific-case receipt | | | |
| Questions to resolve | | | |

Problem types: **language**, **interaction**, **representation**, **comprehension**, **missing information**, **positive**.

## Non-author comprehension test

Give the participant the disclosure without coaching first. Record their answer in their own words, then mark the interpretation as **correct**, **partial** or **incorrect**. Keep those question-level observations separate; do not aggregate them into a single score.

| Question | Participant answer / notes | Interpretation |
| --- | --- | --- |
| 1. Where is AI involved? | | correct / partial / incorrect |
| 2. What does the AI actually do? | | correct / partial / incorrect |
| 3. What information or data does it use? | | correct / partial / incorrect |
| 4. Can it make or trigger consequential decisions or actions? | | correct / partial / incorrect |
| 5. Where is human judgement or authority? | | correct / partial / incorrect |
| 6. What claims is the organisation making? | | correct / partial / incorrect |
| 7. Which claims have evidence, and what kind? | | correct / partial / incorrect |
| 8. What remains unknown, withheld, stale, limited or contradictory? | | correct / partial / incorrect |
| 9. What happened in the specific case, if a receipt exists? | | correct / partial / incorrect |
| 10. Can the affected person question or challenge the outcome? | | correct / partial / incorrect |

Most important misunderstanding to preserve verbatim:

## Affected-person receipt test

Prompt only:

> Imagine this was your case. Tell me what you think happened.

Could the reader identify, without extra explanation:

- [ ] what AI did
- [ ] why it mattered
- [ ] what a person did, if anything
- [ ] who or what had final authority
- [ ] the outcome
- [ ] how to question or challenge it

Misunderstandings / missing information:

## Declared-versus-observed review

Use this section when runtime evidence exists.

Can the participant distinguish, in their own words:

| Concept | Participant explanation | Clear? |
| --- | --- | --- |
| What the organisation declared | | yes / partly / no |
| What the runtime actually observed | | yes / partly / no |
| A divergence that needs review | | yes / partly / no |
| Something CRUX still cannot know automatically | | yes / partly / no |

Did any provider/model divergence get interpreted as a trust, safety or compliance judgement?

Notes:

Did automatic evidence make the record clearer, noisier or neither?

Notes:

## Disclosure test

Compare the canonical, public and affected-person views.

### Too much disclosure

Did any view reveal unnecessary personal data, source content, prompts, model outputs, security-sensitive implementation details or hidden object references?

Notes:

### Too little disclosure

Did redaction make any explanation technically safe but practically meaningless?

Notes:

### Useful after redaction

What remained genuinely useful to the reader?

Notes:

## Questions to resolve

Which CRUX prompts were useful?

Which were irrelevant or too opinionated?

Which were unclear?

What important question did CRUX fail to ask?

## Learning classification

For each material issue, decide what kind of change it suggests before treating it as a schema problem.

- [ ] explanatory copy
- [ ] authoring scaffolding/example
- [ ] disclosure projection
- [ ] derived interpretation in `@crux/core`
- [ ] genuine canonical schema gap
- [ ] instrumentation/transport issue
- [ ] no change — needs more evidence

## Schema signal

Only use this section when the existing CRUX model genuinely cannot faithfully represent something important.

What could not be represented?

Why is this structural rather than a wording, interaction or disclosure problem?

Which existing fields/relationships were considered and why were they insufficient?

Possible model change to investigate:

Has the same structural gap appeared in another session? yes / no / unknown

## Session outcome

### Keep

What worked particularly well?

### Change next

What is the smallest useful change before the next session?

### Do not change yet

What was awkward but needs more evidence before changing CRUX?

### Follow-up

- [ ] authoring UI
- [ ] public disclosure UI
- [ ] affected-person receipt
- [ ] schema / contracts
- [ ] evidence resolution
- [ ] declared-versus-observed interpretation
- [ ] integration / instrumentation
- [ ] documentation
- [ ] no change
