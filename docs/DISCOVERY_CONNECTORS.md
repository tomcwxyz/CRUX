# Discovery connectors and collector direction

**Status:** prototype direction  
**Updated:** 18 September 2026

## Product principle

CRUX should normally begin with evidence from systems that already exist rather than a blank declaration form.

The onboarding sequence is:

```text
Connect → Discover → Confirm → Observe → Reconcile
```

A connector is not required to do every step. It declares what it can actually do.

## Connector capabilities

The shared connector contract distinguishes:

- `discover_source` — inspect source/project evidence for AI integration points;
- `discover_runtime` — identify model/provider activity from runtime metadata;
- `discover_workflow` — inspect an explicit workflow graph/export;
- `observe_runtime` — continue sending bounded runtime observations;
- `install_observer` — help add the smallest missing observation hook.

This prevents the UI from pretending GitHub, a gateway and n8n are the same technical integration while still giving the user one coherent onboarding journey.

## Current connector ladder

### GitHub + Ship Check — prototype

CRUX asks for a repository. Ship Check produces `crux-discovery/0.1` from bounded source evidence.

Ship Check may identify:

- AI SDK/provider dependencies;
- model-call sites;
- configurable provider boundaries;
- named job/workflow boundaries;
- explicit human-review/decision/action markers where source evidence supports them.

It must not infer organisational purpose, affected people or decision authority from those signals.

After human confirmation, this connector may offer to generate a small instrumentation patch.

### Project ZIP — planned

Same source-discovery semantics as GitHub, but acquisition can remain local/transient for exported projects such as hosted builders.

### AI gateway — planned

The gateway path should be close to one-click for organisations already routing model calls through a supported boundary.

Metadata may identify provider/model, application/project, timing, failures, fallback and tools where available. It still cannot establish why the AI is used or who has authority.

### Workflow platforms — planned

For n8n, Make, Zapier, Power Automate and similar systems, the connector can use workflow structure as discovery evidence and execution metadata as runtime evidence.

A workflow graph may make human gates and actions easier to suggest, but suggestions remain candidates until confirmed.

## Collector

Longer term, adapters should be able to feed a small CRUX Collector:

```text
apps / gateways / workflows
          │
          ▼
    CRUX Collector
      normalise
      redact
      batch
      authenticate
          │
          ▼
       CRUX ingest
```

The Collector should be deployable close to the source so content can be stripped before transmission. Its output is the existing semantic runtime transport plus the discovery envelope; it should not create a second CRUX ontology.

## One-click does not mean one mechanism

The UX target is one obvious start:

> Connect where your AI already lives.

Underneath, a connector may use OAuth, a GitHub App, an API key, upload, webhook, local scan or generated patch.

The product should expose technical setup only when the environment requires it.

## Acceptance boundary

Automatic discovery may create:

- signals;
- grouped candidates;
- suggested labels;
- suggested integration points.

It may not automatically create or publish organisational assertions about:

- purpose;
- affected people;
- final authority;
- actual impact;
- challenge rights;
- whether a workflow is appropriate or trustworthy.

Those remain human-confirmed meaning.

## First two tests

1. **Open Recommendations Local** — source-code discovery via Ship Check. Test whether the user recognises recommendation extraction from the evidence CRUX found and can confirm the use with a few plain-language answers.
2. **Materially different producer** — use the same `crux-discovery/0.1` onboarding with a gateway/runtime or workflow-platform source. This test should require no source-code assumptions in the CRUX UI or candidate grouper.

A successful second test is evidence that the discovery contract is genuinely connector-neutral rather than an Open Recs scanner format with a generic name.


## Test evidence so far

### Open Recommendations Local — real source discovery

Ship Check scanned the real `tomcwxyz/open-recs-local` repository and produced a 10-signal `crux-discovery/0.1` report from executable/config evidence.

It identified two use-level candidates:

- `chat.search` / **Chat search** from the API route and streaming model call;
- `source.extract` / **Recommendation extraction** from the queue/handler boundary and structured LLM-provider call.

Shared SDK/provider evidence remains shared context rather than becoming a third AI use. Markdown, test/spec and e2e evidence are excluded from the final regression.

### Gateway/runtime — producer-contract test

The production runtime smoke previously observed one real call through the gateway using `anthropic/claude-3-haiku`. That metadata has now been converted into the same discovery envelope and passed through the same candidate/confirmation UI with no source-code paths.

This demonstrates that CRUX's discovery model is not tied to Ship Check. It does **not** yet demonstrate one-click gateway account connection; OAuth/API ingestion remains a connector implementation task.
