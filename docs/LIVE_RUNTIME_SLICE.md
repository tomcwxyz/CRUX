# Live runtime reconciliation slice

**Status:** working synthetic production slice  
**Updated:** 18 September 2026

This slice tests the CRUX operating rule in a real deployed path:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

It deliberately reuses existing instrumentation, transport and persistence rather than expanding telemetry breadth.

## What is live

The pilot at `/live` uses a synthetic Funding Review scope stored in the existing Neon/Postgres durable store.

The flow is:

```text
Declared Funding Review record
        ↓
AI invocation runs
        ↓
metadata-only Run / Event records
        ↓
durable CRUX ingestion → Neon
        ↓
exact SystemVersion reconciliation
        ↓
Internal view shows declared ↔ observed
        ↓
observed case becomes a review proposal
        ↓
human confirms effect / authority / outcome / challenge
        ↓
reviewed Trace + Receipt
        ↓
Affected-person disclosure can show the case
```

The production API is `/api/live-runtime`; the human-facing pilot is `/live`.

## Runtime boundary

The AI SDK integration records bounded metadata such as:

- provider;
- request/response model identifier;
- finish reason;
- token counts;
- tool-call count;
- event type and references to the declared process/component.

The live pilot keeps the normal transport boundary:

- `capture_mode` is `metadata_only`;
- event summaries are stripped before HTTP/durable ingestion;
- prompts, outputs, reasoning, tool arguments and tool results are not ingested;
- runtime records must reference the exact `SystemVersion` being observed.

The production live-provider probe on 18 September 2026 observed provider `gateway` and model `anthropic/claude-3-haiku` using synthetic text only.

## Reconciliation, not automatic correction

Runtime evidence does not silently rewrite the organisational declaration.

The Funding Review example deliberately declares its model identifier as `unknown`. A live observation can therefore establish that a particular run used a particular model while leaving the declaration unchanged. CRUX presents that as an observational gap/difference to review, not as an automatic correction or trust judgement.

The same rule applies to true divergence: an observed provider/model difference is surfaced for review; it does not mutate the declared system version.

## Case publication boundary

Runtime can establish that events occurred and in what order. It cannot safely infer all organisational meaning from those events.

For a consequential run CRUX can generate a receipt proposal from observations such as:

```text
AI invocation → human review → decision → action
```

But the proposal still requires a person to confirm, as relevant:

- what role AI actually played;
- what happened because of its output;
- what the human reviewer actually did;
- who or what had final authority;
- the actual outcome;
- the relevant challenge, appeal or correction route.

Only after that review does the pilot create an `affected_party` Trace/Receipt that can appear in the Affected-person view.

This is intentional: **runtime evidence can propose HAPPENED; a person must resolve what HAPPENED means.**

## Audience behaviour

### Internal

Runtime feeds this view automatically. It shows:

- number of observed runs;
- latest observed provider/model;
- declared-versus-observed comparison;
- differences that need review;
- which process steps were observed in the latest synthetic run;
- whether a case is observed-but-unreviewed or reviewed.

### Public

Raw runtime telemetry is not automatically published. The public view continues to consume the public disclosure projection.

A later product experiment can test whether reviewed/aggregated runtime observations should become explicit public evidence, with scope, period and limitations. That is not automatic in this slice.

### Affected person

An observed runtime case remains hidden until human review is complete. After review, the affected-person projection can show:

- AI contribution;
- what happened next;
- human involvement;
- outcome;
- final authority;
- challenge route.

## Production smoke exercised

A production smoke on 18 September 2026 exercised the deployed Vercel API and Neon scope end to end:

1. reset synthetic scope;
2. ingest a deterministic metadata-only run;
3. verify AI invocation, human-review and decision events persisted;
4. verify no event summaries crossed the runtime boundary;
5. verify CRUX produced a pending case rather than a published receipt;
6. submit reviewed organisational meaning;
7. verify exactly one `affected_party` receipt with `source_content_included: false`;
8. verify the reviewed state survived a fresh GET from Neon;
9. reset the scope;
10. run the real provider path and verify a pending case was produced;
11. reset the scope again.

The reusable manual smoke is `.github/workflows/live-runtime-production-smoke.yml`.

## What this does not prove

This is still a synthetic learning slice. It does not prove that:

- a production organisation can instrument a real consequential workflow easily;
- event semantics are complete enough for arbitrary systems;
- human review of proposed cases is usable at scale;
- runtime evidence should be public by default;
- a runtime event proves the quality of human review;
- observed sequence alone establishes causality or authority.

Those are product and organisational questions, not reasons to broaden telemetry prematurely.

## Next learning step

Use this slice to test the *relationship* between declared and observed information before adding more instrumentation:

- Does the Internal view make a model/provider change understandable rather than alarming?
- Can someone see the difference between “observed” and “declared”? 
- Is the review gate for a consequential case obvious and proportionate?
- Does the Affected-person explanation feel meaningfully stronger because it is grounded in an observed run?
- What runtime evidence would genuinely strengthen a public claim, and what would merely add technical noise?
