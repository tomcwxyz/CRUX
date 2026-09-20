import type {
  GeneratedObservationPatch,
  RepositoryPatchFile,
} from "./observation-patch-adapters";

const ORCHESTRATOR_PATH = "server/soundings/ask/orchestrator.py";
const HELPER_PATH = "server/soundings/ask/crux_observe.py";
const TEST_PATH = "server/tests/test_crux_observe.py";
const ENV_PATH = ".env.example";

const helperSource = "\"\"\"Optional metadata-only CRUX observation for the Soundings Ask loop.\"\"\"\n\nfrom __future__ import annotations\n\nimport logging\nimport os\nfrom datetime import UTC, datetime\nfrom typing import Any\nfrom uuid import uuid4\n\nimport httpx\n\nlogger = logging.getLogger(__name__)\n\n\ndef _read_config() -> tuple[str, str, str, str] | None:\n    ingest_url = os.getenv(\"CRUX_INGEST_URL\")\n    ingest_token = os.getenv(\"CRUX_INGEST_TOKEN\")\n    system_version_ref = os.getenv(\"CRUX_SYSTEM_VERSION_REF\")\n    producer_id = os.getenv(\"CRUX_PRODUCER_ID\")\n    if (\n        ingest_url is None\n        or ingest_token is None\n        or system_version_ref is None\n        or producer_id is None\n    ):\n        return None\n    return ingest_url, ingest_token, system_version_ref, producer_id\n\n\ndef build_crux_ingest_batch(\n    *,\n    workflow: str,\n    provider: str,\n    operation: str,\n    system_version_ref: str,\n    producer_id: str,\n    request_model: str | None = None,\n    response_model: str | None = None,\n    finish_reason: str | None = None,\n    input_tokens: int | None = None,\n    output_tokens: int | None = None,\n    occurred_at: str | None = None,\n    run_id: str | None = None,\n) -> dict[str, Any]:\n    \"\"\"Build one metadata-only CRUX Run/Event batch.\n\n    No prompt, answer, reasoning, source data or tool payload is accepted by\n    this API. Keep the signature intentionally narrow.\n    \"\"\"\n    timestamp = occurred_at or datetime.now(tz=UTC).isoformat()\n    resolved_run_id = run_id or f\"run:{producer_id}:{uuid4()}\"\n    event_id = f\"event:{resolved_run_id.removeprefix('run:')}:1\"\n\n    attributes: dict[str, Any] = {\n        \"workflow\": workflow,\n        \"provider\": provider,\n        \"operation\": operation,\n    }\n    if request_model:\n        attributes[\"request_model\"] = request_model\n    if response_model:\n        attributes[\"response_model\"] = response_model\n    if finish_reason:\n        attributes[\"finish_reason\"] = finish_reason\n    if input_tokens is not None:\n        attributes[\"input_tokens\"] = input_tokens\n    if output_tokens is not None:\n        attributes[\"output_tokens\"] = output_tokens\n\n    return {\n        \"format\": \"crux-ingest/0.1\",\n        \"request_id\": f\"request:{resolved_run_id.removeprefix('run:')}\",\n        \"producer\": {\n            \"id\": producer_id,\n            \"kind\": \"application\",\n            \"name\": \"Soundings\",\n        },\n        \"system_version_ref\": system_version_ref,\n        \"runs\": [\n            {\n                \"schema_version\": \"0.1\",\n                \"id\": resolved_run_id,\n                \"system_version_ref\": system_version_ref,\n                \"started_at\": timestamp,\n                \"completed_at\": timestamp,\n                \"status\": \"completed\",\n                \"capture_mode\": \"metadata_only\",\n                \"disclosure\": \"internal\",\n                \"external_refs\": [],\n            }\n        ],\n        \"events\": [\n            {\n                \"schema_version\": \"0.1\",\n                \"id\": event_id,\n                \"run_ref\": resolved_run_id,\n                \"sequence\": 1,\n                \"occurred_at\": timestamp,\n                \"type\": \"ai_invocation\",\n                \"attributes\": attributes,\n                \"disclosure\": \"internal\",\n            }\n        ],\n        \"observations\": [],\n        \"evidence_envelopes\": [],\n    }\n\n\nasync def emit_crux_ai_invocation(\n    *,\n    workflow: str,\n    provider: str,\n    operation: str,\n    request_model: str | None = None,\n    response_model: str | None = None,\n    finish_reason: str | None = None,\n    input_tokens: int | None = None,\n    output_tokens: int | None = None,\n) -> None:\n    \"\"\"Best-effort metadata delivery; disabled unless all four env vars exist.\"\"\"\n    config = _read_config()\n    if config is None:\n        return\n\n    ingest_url, ingest_token, system_version_ref, producer_id = config\n    body = build_crux_ingest_batch(\n        workflow=workflow,\n        provider=provider,\n        operation=operation,\n        system_version_ref=system_version_ref,\n        producer_id=producer_id,\n        request_model=request_model,\n        response_model=response_model,\n        finish_reason=finish_reason,\n        input_tokens=input_tokens,\n        output_tokens=output_tokens,\n    )\n\n    try:\n        async with httpx.AsyncClient(timeout=1.5) as client:\n            response = await client.post(\n                ingest_url,\n                headers={\n                    \"authorization\": f\"Bearer {ingest_token}\",\n                    \"content-type\": \"application/json\",\n                },\n                json=body,\n            )\n        if not response.is_success:\n            logger.warning(\"CRUX observation rejected with HTTP %s\", response.status_code)\n    except Exception as exc:\n        # CRUX telemetry must never determine Ask availability.\n        logger.warning(\"CRUX observation delivery skipped: %s\", type(exc).__name__)\n";
const testSource = "\"\"\"Tests for the opt-in Soundings CRUX observation payload.\"\"\"\n\nimport json\n\nfrom soundings.ask.crux_observe import build_crux_ingest_batch\n\n\ndef test_crux_ask_batch_is_metadata_only() -> None:\n    batch = build_crux_ingest_batch(\n        workflow=\"ask\",\n        provider=\"anthropic\",\n        operation=\"messages.create\",\n        system_version_ref=\"system-version:soundings-ask:0.1\",\n        producer_id=\"producer:soundings\",\n        request_model=\"claude-sonnet-5\",\n        response_model=\"claude-sonnet-5-20260901\",\n        finish_reason=\"tool_use\",\n        input_tokens=123,\n        output_tokens=45,\n        occurred_at=\"2026-09-19T20:45:00+00:00\",\n        run_id=\"run:soundings:test-1\",\n    )\n\n    assert batch[\"system_version_ref\"] == \"system-version:soundings-ask:0.1\"\n    assert batch[\"runs\"][0][\"capture_mode\"] == \"metadata_only\"\n    assert batch[\"events\"][0][\"attributes\"] == {\n        \"workflow\": \"ask\",\n        \"provider\": \"anthropic\",\n        \"operation\": \"messages.create\",\n        \"request_model\": \"claude-sonnet-5\",\n        \"response_model\": \"claude-sonnet-5-20260901\",\n        \"finish_reason\": \"tool_use\",\n        \"input_tokens\": 123,\n        \"output_tokens\": 45,\n    }\n\n    serialised = json.dumps(batch).lower()\n    for forbidden in (\n        \"prompt\",\n        \"question\",\n        \"thinking\",\n        \"tool_input\",\n        \"tool_result\",\n        \"answer\",\n        \"source_data\",\n    ):\n        assert forbidden not in serialised\n";

const importAnchor = "from soundings.ask.dispatcher import ToolDispatcher";
const initAnchor = "        self._answer_cache = answer_cache";
const modelCallAnchor =
  "            response = await asyncio.to_thread(\n" +
  "                lambda: client.messages.create(";
const classifierAnchor =
  "            # A cybersecurity/safety classifier can decline a request: HTTP 200";

const observationBlock = `            usage = getattr(response, "usage", None)
            observation_task = asyncio.create_task(
                emit_crux_ai_invocation(
                    workflow="ask",
                    provider="anthropic",
                    operation="messages.create",
                    request_model=self._model,
                    response_model=getattr(response, "model", None),
                    finish_reason=getattr(response, "stop_reason", None),
                    input_tokens=getattr(usage, "input_tokens", None),
                    output_tokens=getattr(usage, "output_tokens", None),
                )
            )
            self._crux_observation_tasks.add(observation_task)
            observation_task.add_done_callback(self._crux_observation_tasks.discard)

`;

const envBlock = `
# CRUX runtime observation (optional; disabled unless all four are set)
# Ask emits only workflow/provider/model/stop-reason/token metadata.
# Questions, prompts, thinking, tool payloads, answers and source data are not emitted.
CRUX_INGEST_URL=
CRUX_INGEST_TOKEN=
CRUX_SYSTEM_VERSION_REF=
CRUX_PRODUCER_ID=
`;

const count = (value: string, needle: string) =>
  value.split(needle).length - 1;

export const generateSoundingsAskPatch = ({
  repository,
  files,
  systemVersionRef,
}: {
  repository: string;
  files: RepositoryPatchFile[];
  systemVersionRef: string;
}): GeneratedObservationPatch => {
  if (repository !== "tomcwxyz/soundings") {
    return {
      status: "blocked",
      adapter_id: "soundings-ask",
      reason: "This adapter is intentionally scoped to tomcwxyz/soundings.",
    };
  }

  if (!systemVersionRef.startsWith("system-version:")) {
    return {
      status: "blocked",
      adapter_id: "soundings-ask",
      reason: "An exact human-confirmed CRUX SystemVersion reference is required.",
    };
  }

  const byPath = new Map(files.map((file) => [file.path, file] as const));
  const orchestrator = byPath.get(ORCHESTRATOR_PATH);
  const env = byPath.get(ENV_PATH);

  if (!orchestrator || !env) {
    return {
      status: "blocked",
      adapter_id: "soundings-ask",
      reason:
        "The adapter could not read the expected Ask orchestrator and .env.example.",
    };
  }

  if (
    byPath.has(HELPER_PATH) ||
    byPath.has(TEST_PATH) ||
    orchestrator.content.includes("emit_crux_ai_invocation") ||
    env.content.includes("CRUX_INGEST_URL")
  ) {
    return {
      status: "blocked",
      adapter_id: "soundings-ask",
      reason:
        "A CRUX Ask observation integration already appears to be present. CRUX will not stack a second patch on top of it.",
    };
  }

  if (
    count(orchestrator.content, importAnchor) !== 1 ||
    count(orchestrator.content, initAnchor) !== 1 ||
    count(orchestrator.content, modelCallAnchor) !== 1 ||
    count(orchestrator.content, classifierAnchor) !== 1
  ) {
    return {
      status: "blocked",
      adapter_id: "soundings-ask",
      reason:
        "The CI-tested Soundings Ask source anchors have changed, so this deterministic adapter will not guess where to edit.",
    };
  }

  const nextOrchestrator = orchestrator.content
    .replace(
      importAnchor,
      `from soundings.ask.crux_observe import emit_crux_ai_invocation\n${importAnchor}`,
    )
    .replace(
      initAnchor,
      `${initAnchor}\n        self._crux_observation_tasks: set[asyncio.Task[None]] = set()`,
    )
    .replace(classifierAnchor, `${observationBlock}${classifierAnchor}`);

  const nextEnv = `${env.content.replace(/\s*$/, "")}\n${envBlock}`;

  return {
    status: "ready",
    adapter_id: "soundings-ask",
    title: "Observe Ask Anthropic turns with bounded CRUX metadata",
    branch_name: "crux/observe-ask",
    commit_message: "Observe Ask Anthropic turns with bounded CRUX metadata",
    pull_request_body: [
      "CRUX discovered and a person confirmed Soundings Ask as an AI-use boundary.",
      "",
      "This patch adds an opt-in metadata-only observation hook around each Anthropic messages.create turn in the Ask tool-use loop.",
      "",
      `Bind CRUX_SYSTEM_VERSION_REF to \`${systemVersionRef}\` when configuring the integration.`,
      "",
      "The patch does not emit the user question, system prompt, model text, thinking blocks, tool arguments/results, composed answer or Soundings source data.",
      "",
      "Observation delivery is best-effort and does not block Ask. This pull request is generated for review only; CRUX does not merge it automatically.",
    ].join("\n"),
    changes: [
      {
        path: HELPER_PATH,
        mode: "create",
        content: helperSource,
        purpose: "Add the opt-in metadata-only Soundings Ask CRUX emitter.",
      },
      {
        path: TEST_PATH,
        mode: "create",
        content: testSource,
        purpose:
          "Prove the emitted payload excludes prompt, question, thinking, tool, answer and source-data content.",
      },
      {
        path: ORCHESTRATOR_PATH,
        mode: "update",
        content: nextOrchestrator,
        ...(orchestrator.sha ? { base_sha: orchestrator.sha } : {}),
        purpose:
          "Schedule bounded CRUX observations after each Anthropic messages.create response without blocking Ask.",
      },
      {
        path: ENV_PATH,
        mode: "update",
        content: nextEnv,
        ...(env.sha ? { base_sha: env.sha } : {}),
        purpose: "Document the four opt-in CRUX runtime variables.",
      },
    ],
    required_environment: [
      "CRUX_INGEST_URL",
      "CRUX_INGEST_TOKEN",
      "CRUX_SYSTEM_VERSION_REF",
      "CRUX_PRODUCER_ID",
    ],
  };
};
