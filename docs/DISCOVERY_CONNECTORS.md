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

### Public Git forges — feature branch

Public-repository discovery now has a separate, bounded, read-only API and uses
the same source evidence scanner as the GitHub pilot. A user pastes an HTTPS
repository URL; no source change or GitHub authorisation is required.

Supported public hosts:

| Host | API implementation | Notes |
| --- | --- | --- |
| github.com | Existing GitHub public route | The GitHub App remains the private-repo connection |
| gitlab.com | GitLab REST API v4 | Groups and nested subgroups |
| framagit.org | GitLab REST API v4 | Framasoft-hosted GitLab; no GitHub identity required |
| codeberg.org | Forgejo/Gitea v1 API | Read-only tree and contents |
| gitea.com | Forgejo/Gitea v1 API | Read-only tree and contents |
| bitbucket.org | Bitbucket Cloud v2 API | Bounded recursive source listing |

Administrators may opt in **additional** self-hosted GitLab or Forgejo hosts
using the environment variable CRUX_PUBLIC_GIT_INSTANCES, with a value such
as gitlab:git.example.org,forgejo:code.example.org. This is an explicit
server allow-list, not an arbitrary network URL fetch. HTTPS only, no
userinfo/ports, bounded response sizes and file counts, no redirects.
Private self-hosted repositories are **not** automatically accessible;
tokens must not be placed into browser-submitted URLs.

The hosted probe reads no more than 80 selected source/config files or two
million characters and excludes docs, tests, fixtures and dependency
directories. Truncation remains visible. These limits mean a negative
result is **not** evidence that a project does not use AI. The source
code is processed for technical signals; discovery responses do not publish
prompt or application-record content.

The GitHub-specific draft observation PR path remains GitHub-only. For GitLab,
Framagit, Bitbucket and Forgejo, discovery and confirmation work but automatic
merge-request/pull-request creation and live runtime instrumentation are not
yet connected. Local Git and authenticated private-federated connections
remain follow-up work.

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
