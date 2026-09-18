# CRUX in the Organisational OS runtime experiment

Date: 2026-09-18  
Status: architectural record / experiment

The canonical cross-project decision is recorded in `tomcwxyz/Organisational-OS` RFC 0002: **AI runtime interoperability and the Orbital experiment**.

## Role

CRUX is the evidence plane around AI and automated work.

Its questions are:

> What actually happened?

> What evidence supports that account?

> How does observed behaviour compare with what was declared, expected or intended?

CRUX is not the execution runtime, the durable personal memory store or the canonical practice library.

## Relationship to the Orbital fork

`tomcwxyz/Orbital` is being used as a reference runtime/proving ground.

Orbital should emit a deliberately small, structured vocabulary of execution events rather than forcing CRUX to scrape full chat/session logs.

Initial candidate events:

- `project.started`
- `task.started`
- `context.requested`
- `context.used`
- `practice.applied`
- `worker.dispatched`
- `tool.called`
- `approval.requested`
- `approval.resolved`
- `artifact.created`
- `task.completed`
- `task.blocked`
- `evaluation.completed`

Events should carry stable correlation identifiers where available for project, task/run, worker/model, context packet, practice/version, approval, artefact and evaluation.

## Declared versus observed

The runtime experiment should exercise CRUX's core distinction:

~~~text
DECLARED                         OBSERVED

expected model                   model actually used
expected tools                   tools actually called
required approval                approval event recorded
RACK practice/version            practice reference on the run
TOPO context packet              packet identity/revision used
expected checks                  evaluations / Ship Check evidence
expected outcome                 actual completion / block / artefact

             \                  /
              \                /
                    CRUX
             evidence + receipt
~~~

CRUX should preserve uncertainty and provenance. An event emitted by a runtime is evidence from that runtime, not independent proof of every claim represented by the event.

## Relationship to TOPO

TOPO provides governed context and durable reviewed memory. CRUX may reference a TOPO Context Packet used during a run, but should not require the full private packet contents when identifiers/digests are enough for lineage.

CRUX evidence may later support a TOPO Memory Page proposal, but cannot silently establish canonical memory.

## Relationship to RACK

RACK supplies practice. CRUX can record that a particular practice/version was selected and compare expected behaviour with observed execution and outcomes.

Evidence may justify a **proposal** to improve a practice. It must not automatically rewrite RACK.

## Relationship to Ship Check

Ship Check is an independent evidence producer.

Its findings should be ingestible through an adapter/evidence envelope and correlated with runtime actions, artefacts, builds, releases and RACK practices.

Example:

~~~text
Orbital task/run ───────────────┐
RACK practice/version ─────────┤
TOPO packet reference ─────────┤──► CRUX receipt
Ship Check findings ───────────┤
other evals / approvals ───────┘
~~~

CRUX does not need to reimplement Ship Check's inspection logic.

## Organisational OS semantics

CRUX participates primarily through:

- **Event** — consume and emit durable evidence-bearing observations;
- **Object** — reference evidence, traces, receipts, artefacts and declared system descriptions;
- **Context** — answer questions such as what evidence exists for a declaration, action or outcome;
- **Action** — explicit authorised evidence/evaluation operations where appropriate, never implied by read access.

## First experiment

1. Instrument selected Orbital runs with the initial event vocabulary.
2. Correlate TOPO packet and RACK practice references without copying their canonical stores.
3. Ingest a Ship Check result for an artefact or repository involved in the run.
4. Produce an inspectable trace/receipt that separates declaration, runtime observation, independent inspection and human approval.
5. Identify which events are genuinely useful and reduce the vocabulary rather than expanding telemetry by default.

## Invariants

1. CRUX records evidence; it does not become the agent runtime.
2. Evidence is not automatically organisational truth.
3. Human decisions, agent interpretations, runtime telemetry and scanner findings remain distinguishable by provenance.
4. CRUX must not require wholesale copying of TOPO context or runtime conversations.
5. CRUX evidence can inform TOPO and RACK only through explicit reviewable promotion paths.
6. Ship Check and other evaluators remain independent evidence producers.
7. The CRUX event/evidence contract should work with runtimes other than Orbital.
