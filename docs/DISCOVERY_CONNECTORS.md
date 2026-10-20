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

### SaaS and organisational tools — import-first prototype (October 2026)

CRUX now offers a **client-side JSON evidence review** alongside Git discovery
on the Connect / Discover screens. Files are parsed in the browser. Raw exports
are **not sent to a CRUX backend**. The first cut accepts up to 2 MB per file,
emits only fixed provider categories plus counts into the existing
`crux-discovery/0.1` contract, and does not establish whether a user-provided
file is authentic or complete.

| Platform | Evidence route | What a positive result actually means |
| --- | --- | --- |
| Microsoft 365 Copilot | Microsoft Purview `CopilotInteraction` records in JSON | Recorded Copilot interaction in a known host app |
| Google Workspace Gemini | Admin Reports `gemini_in_workspace_apps` feature-utilisation events | Recorded Gemini feature use |
| Salesforce Agentforce | OTLP `resourceSpans` with `gen_ai.*` attributes | Recorded model activity in a supplied trace |
| Power Automate | Dataverse `FlowRun` export | Workflow execution only; requires AI-step evidence |
| Airtable | Enterprise audit API JSON with AI_CREDIT_CONSUMED | AI credit-consuming activity; ordinary record changes remain context only |
| Plinth | Organisation-scoped grant, fund and service API JSON | Workflow context only; AI assessment and writing exist as distinct supplier-described features, not inferred execution |

**Never equate record modifications, file access, enabled product licences,
successful flow runs or ordinary automation activity with AI influence.**
Without a documented AI activity marker the adapter emits **zero candidate
signals**. The UI offers human description and declares the uncertainty.

The path from an imported audit event is:
`Local file → exact provider event parser → metadata-only candidate → human confirmation → CRUX record`.
Only human confirmation can establish purpose, affected people, authority,
challenge route and consequences.

#### Next live connections, in order

1. **Microsoft** — tenant-authorised read-only Purview Copilot audit ingestion,
   then separately evaluate Copilot Studio and Power Automate `FlowRun`/App Insights.
   Capture licensing, retention and scope limitations.
2. **Google Workspace** — read-only Admin Reports API with narrow Gemini activity
   scopes; record customer and event coverage without collecting prompts.
3. **Salesforce Agentforce** — use the beta single-session OTLP endpoint with
   Data 360 access; reuse the existing CRUX OTLP adapter and redact payloads
   at source. Beta tracing can contain prompts and response text; never ingest
   a raw trace by default.
4. **Airtable** — inspect Enterprise audit API JSON for the documented
   `AI_CREDIT_CONSUMED` event. The AI credit record indicates feature use, not
   why the AI ran or what its output changed. Confirm agent attribution and
   automation context separately. Enterprise audit access is not universal;
   other plans need a declared use and supplier/automation evidence.
5. **Plinth** — use the documented, organisation-scoped
   `https://app.plinth.org.uk/api/v1` platform API for a fund or workflow
   inventory; distinguish funder grantmaking from charity-side grant writing.
   Its published grant applications endpoint includes status and amounts but
   does **not** document AI execution markers, so it cannot prove model activity.
   Obtain specific supplier evidence or opt-in bounded AI-step instrumentation.
   Never bulk-import full applications, member details or case notes to detect AI.

#### Plinth: separate products and AI uses

Plinth's public product descriptions include several AI capabilities; the
availability of a feature is supplier **SAYS**, not proof a particular
organisation has configured it (**SHOWS**) or used it (**HAPPENED**).

- **For grantmakers:** AI-assisted eligibility screening and routing;
  document/register due diligence with cited risk flags; draft assessment
  scorecards and justifications; AI-assisted feedback letters; monitoring
  classifications; payment/bank reconciliation. A rule-only eligibility gate
  must be distinguished from an AI decision aid.
- **For applicants / charities:** AI grant-writing drafts informed by
  organisational material, and AI-assisted funder/impact reporting. These
  involve different people, controls and potential consequences from a
  funder's assessment system.
- **Higher-consequence review:** Was an application screened out or its
  assessor's judgement influenced by AI? Was a suggested score visible to
  reviewers? What source evidence supported a red flag? Did a person override
  the suggested result? Who was accountable for an award or rejection?
- **Evidence boundary:** The platform API documents funds, grant
  applications, status and disbursements; this is useful **workflow context**
  only. Assessment provenance, AI invocation logs, score/flag visibility,
  human reviewer edits and override history would require additional API
  access or vendor collaboration. Do not call application statuses
  AI activity observations.
- **Sensitive data:** Applications, due diligence, bank statements and
  feedback may be sensitive. Prefer event categories, reviewer-control
  configuration, source citations, counts and status transitions over
  identifiable grant application content.

The browser UI now offers a Plinth workflow selector and questions to
investigate for these separate use cases. Selection itself emits **no**
AI activity signal or claim.

Supplier docs (verified October 2026):
- Microsoft: https://learn.microsoft.com/en-us/purview/audit-copilot
- FlowRun: https://learn.microsoft.com/power-automate/dataverse/cloud-flow-run-metadata
- Google: https://developers.google.com/workspace/admin/reports/v1/appendix/activity/gemini-in-workspace-apps
- Salesforce: https://developer.salesforce.com/docs/ai/agentforce/guide/otel-api.html
- Airtable AI credit audit: https://support.airtable.com/articles/5959979753-tracking-ai-credit-consumption-in-airtable-audit-logs
- Airtable agent audit: https://www.airtable.com/articles/agent-audit-log
- Plinth platform API: https://docs.plinth.org.uk/docs/grant-applications
- Plinth grantmakers: https://www.plinth.org.uk/grantmakers
- Plinth AI grant writing: https://blog.plinth.org.uk/how-our-ai-grant-writer-tool-works/

**Not delivered by this slice:** provider OAuth, background polling, SaaS
credentials, permanent ingestion storage, or real-time outcome monitoring.
"Evidence from an export" must never be labelled "live observation".

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
