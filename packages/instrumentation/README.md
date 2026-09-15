# @crux/instrumentation

Metadata-first runtime instrumentation for CRUX.

This package is the first pipeline integration spike for `0.1-beta`. It turns bounded runtime observations into canonical CRUX `Run` and `Event` records without introducing a hosted CRUX service or making observability tooling part of CRUX core.

## Boundary

The package follows one rule:

> **Humans declare meaning; systems report behaviour; CRUX reconciles the two.**

It is appropriate for facts software can observe, such as model/version used, finish reason, token counts, event sequence, errors and deliberately annotated business events.

It does **not** infer organisational purpose, consequence, accountability, challenge routes or publication decisions.

By default, the package does not copy prompts, completions, reasoning, retrieved documents, tool arguments/results or OpenTelemetry message-content attributes.

## Basic session

```ts
import { createInstrumentationSession } from "@crux/instrumentation";

const crux = createInstrumentationSession({
  runId: "run:application-123",
  systemVersionRef: "system-version:funding-review:2.3",
});

crux.record({
  type: "human_review",
  humanRoleRef: "role:funding-officer",
  summary: "Funding officer reviewed the original source.",
});

crux.finish();

const { run, events } = crux.snapshot();
```

The snapshot contains canonical CRUX records. During beta these can be stored locally or incorporated into a bundle. A later exporter can send the same records to an HTTP ingestion API without changing the event model.

## Vercel AI SDK callback mapping

`recordAISdkStep` accepts the bounded metadata available from an AI SDK step callback. The adapter deliberately uses a small structural interface instead of importing `ai`, keeping CRUX isolated from framework version churn.

```ts
import { recordAISdkStep } from "@crux/instrumentation/ai-sdk";

// Inside the AI SDK onStepFinish callback:
recordAISdkStep(crux, {
  finishReason: step.finishReason,
  usage: step.usage,
  response: {
    id: step.response?.id,
    model: step.response?.model,
  },
  toolCalls: step.toolCalls.map(tool => ({ toolName: tool.toolName })),
}, {
  componentRef: "component:funding-model",
  processNodeRef: "node:funding-ai",
});
```

Only counts and selected response metadata are recorded. Tool names are not copied into the event by the current mapper; tool arguments and tool results are never copied.

AI SDK OpenTelemetry can still be enabled separately for normal observability. CRUX should consume or map that telemetry rather than replace it.

## OpenTelemetry GenAI mapping

`recordOpenTelemetryGenAI` accepts a span-like object and copies only an allow-list of GenAI semantic-convention attributes, including:

- `gen_ai.operation.name`;
- `gen_ai.provider.name`;
- `gen_ai.request.model`;
- `gen_ai.response.model`;
- `gen_ai.response.id`;
- input/output token counts;
- finish reason;
- workflow name.

Content-bearing attributes such as `gen_ai.input.messages` and `gen_ai.output.messages` are ignored even when present.

```ts
import { recordOpenTelemetryGenAI } from "@crux/instrumentation/opentelemetry";

recordOpenTelemetryGenAI(crux, span, {
  componentRef: "component:funding-model",
  processNodeRef: "node:funding-ai",
});
```

A tool execution maps to a generic transformation unless application code deliberately links it to a CRUX `Action`, in which case it can be recorded as `action_executed`. This prevents telemetry from silently deciding that every technical tool call is an organisationally meaningful action.

## Declared versus observed

```ts
import { compareDeclaredAndObservedModel } from "@crux/instrumentation/compare";

const result = compareDeclaredAndObservedModel(systemVersion, observedEvent);
```

Example result:

```json
{
  "componentRef": "component:funding-model",
  "comparable": true,
  "fields": [
    {
      "field": "provider",
      "declared": "provider-a",
      "observed": "provider-a",
      "status": "match"
    },
    {
      "field": "model_identifier",
      "declared": "model-a",
      "observed": "model-b",
      "status": "divergence"
    }
  ]
}
```

A divergence is an observation to review. CRUX does not automatically change the `SystemVersion`, judge the cause, or declare the system unsafe.

## Next steps

This beta package should be exercised against a small real AI pipeline before adding transport infrastructure. If the mapping survives that test, the next layers are:

1. local/file exporter and receipt proposal generation;
2. HTTP batch ingestion with idempotency and authentication;
3. OTLP/Collector bridge;
4. optional framework adapters;
5. optional MCP server for low-frequency agent-facing reads and writes.

MCP is not intended to carry every model/token/runtime event.
