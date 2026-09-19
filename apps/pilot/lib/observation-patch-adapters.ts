export type RepositoryPatchFile = {
  path: string;
  content: string;
  sha?: string;
};

export type RepositoryPatchChange = {
  path: string;
  mode: "create" | "update";
  content: string;
  base_sha?: string;
  purpose: string;
};

export type GeneratedObservationPatch =
  | {
      status: "ready";
      adapter_id: "open-recs-source-extract";
      title: string;
      branch_name: string;
      commit_message: string;
      pull_request_body: string;
      changes: RepositoryPatchChange[];
      required_environment: string[];
    }
  | {
      status: "blocked";
      adapter_id: "open-recs-source-extract";
      reason: string;
    };

const OBSERVE_PATH = "src/lib/crux/observe.ts";
const OBSERVE_TEST_PATH = "src/lib/crux/observe.test.ts";
const EXTRACT_PATH = "src/lib/jobs/handlers/extract.ts";
const ENV_PATH = ".env.example";

const observeSource = `import { randomUUID } from 'node:crypto';

export type CruxAIObservation = {
  workflow: string;
  provider: string;
  operation: string;
  requestModel?: string;
  responseModel?: string;
  finishReason?: string;
  inputTokens?: number;
  outputTokens?: number;
};

type CruxEmitterConfig = {
  ingestUrl: string;
  ingestToken: string;
  systemVersionRef: string;
  producerId: string;
};

const readConfig = (): CruxEmitterConfig | null => {
  const ingestUrl = process.env.CRUX_INGEST_URL;
  const ingestToken = process.env.CRUX_INGEST_TOKEN;
  const systemVersionRef = process.env.CRUX_SYSTEM_VERSION_REF;
  const producerId = process.env.CRUX_PRODUCER_ID;
  if (!ingestUrl || !ingestToken || !systemVersionRef || !producerId) return null;
  return { ingestUrl, ingestToken, systemVersionRef, producerId };
};

export function buildCruxIngestBatch(
  input: CruxAIObservation,
  config: Pick<CruxEmitterConfig, 'systemVersionRef' | 'producerId'>,
  occurredAt = new Date().toISOString(),
  runId = \`run:\${config.producerId}:\${randomUUID()}\`,
) {
  const eventId = \`event:\${runId.replace(/^run:/, '')}:1\`;

  return {
    format: 'crux-ingest/0.1' as const,
    request_id: \`request:\${runId.replace(/^run:/, '')}\`,
    producer: {
      id: config.producerId,
      kind: 'application' as const,
      name: 'Open Recommendations Local',
    },
    system_version_ref: config.systemVersionRef,
    runs: [{
      schema_version: '0.1' as const,
      id: runId,
      system_version_ref: config.systemVersionRef,
      started_at: occurredAt,
      completed_at: occurredAt,
      status: 'completed' as const,
      capture_mode: 'metadata_only' as const,
      disclosure: 'internal' as const,
      external_refs: [] as string[],
    }],
    events: [{
      schema_version: '0.1' as const,
      id: eventId,
      run_ref: runId,
      sequence: 1,
      occurred_at: occurredAt,
      type: 'ai_invocation' as const,
      attributes: {
        workflow: input.workflow,
        provider: input.provider,
        operation: input.operation,
        ...(input.requestModel ? { request_model: input.requestModel } : {}),
        ...(input.responseModel ? { response_model: input.responseModel } : {}),
        ...(input.finishReason ? { finish_reason: input.finishReason } : {}),
        ...(input.inputTokens !== undefined ? { input_tokens: input.inputTokens } : {}),
        ...(input.outputTokens !== undefined ? { output_tokens: input.outputTokens } : {}),
      },
      disclosure: 'internal' as const,
    }],
    observations: [],
    evidence_envelopes: [],
  };
}

export async function emitCruxAIInvocation(input: CruxAIObservation): Promise<void> {
  const config = readConfig();
  if (!config) return;

  const body = buildCruxIngestBatch(input, config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(config.ingestUrl, {
      method: 'POST',
      headers: {
        authorization: \`Bearer \${config.ingestToken}\`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(\`[crux] observation rejected with HTTP \${response.status}\`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.name : typeof error;
    console.warn(\`[crux] observation delivery skipped: \${reason}\`);
  } finally {
    clearTimeout(timeout);
  }
}
`;

const observeTestSource = `import { describe, expect, it } from 'vitest';
import { buildCruxIngestBatch } from './observe';

describe('buildCruxIngestBatch', () => {
  it('emits metadata-only runtime provenance without source or prompt content', () => {
    const batch = buildCruxIngestBatch(
      {
        workflow: 'source.extract',
        provider: 'local-openai-compatible',
        operation: 'recommendation_extract',
      },
      {
        systemVersionRef: 'system-version:open-recs:0.1',
        producerId: 'producer:open-recs',
      },
      '2026-09-18T20:45:00.000Z',
      'run:open-recs:test-1',
    );

    expect(batch.runs[0]?.capture_mode).toBe('metadata_only');
    expect(batch.events[0]?.attributes).toEqual({
      workflow: 'source.extract',
      provider: 'local-openai-compatible',
      operation: 'recommendation_extract',
    });

    const serialised = JSON.stringify(batch);
    expect(serialised).not.toContain('prompt');
    expect(serialised).not.toContain('completion');
    expect(serialised).not.toContain('reasoning');
    expect(serialised).not.toContain('canonicalMarkdown');
  });
});
`;

const envBlock = `
# CRUX runtime observation (optional, disabled unless all four are set)
# Metadata only: workflow/provider/operation and optional model/token metadata.
# Prompt text, model output, reasoning and source-document content are not emitted.
CRUX_INGEST_URL=
CRUX_INGEST_TOKEN=
CRUX_SYSTEM_VERSION_REF=
CRUX_PRODUCER_ID=
`;

const importAnchor =
  "import type { RepoContext } from '@/lib/repositories/types';";
const resultAnchor = `    const metadata: SourceMetadataOutput = pass1Result.value;
    const recs: RecommendationInput[] = pass2Result.value.recommendations;`;

const hookBlock = `

    // CRUX discovery-first observation hook. This is opt-in and metadata-only:
    // the helper is a no-op unless explicit CRUX environment configuration is present,
    // and delivery failures never fail extraction.
    void emitCruxAIInvocation({
      workflow: 'source.extract',
      provider: ctx.providers.llm.name,
      operation: 'source_metadata_extract',
    });
    void emitCruxAIInvocation({
      workflow: 'source.extract',
      provider: ctx.providers.llm.name,
      operation: 'recommendation_extract',
    });`;

const fileMap = (files: RepositoryPatchFile[]) =>
  new Map(files.map((file) => [file.path, file] as const));

export const generateOpenRecsSourceExtractPatch = ({
  repository,
  files,
  systemVersionRef,
}: {
  repository: string;
  files: RepositoryPatchFile[];
  systemVersionRef: string;
}): GeneratedObservationPatch => {
  if (repository !== "tomcwxyz/open-recs-local") {
    return {
      status: "blocked",
      adapter_id: "open-recs-source-extract",
      reason: "This adapter is intentionally scoped to tomcwxyz/open-recs-local.",
    };
  }

  if (!systemVersionRef.startsWith("system-version:")) {
    return {
      status: "blocked",
      adapter_id: "open-recs-source-extract",
      reason: "An exact human-confirmed CRUX SystemVersion reference is required.",
    };
  }

  const byPath = fileMap(files);
  const extract = byPath.get(EXTRACT_PATH);
  const env = byPath.get(ENV_PATH);
  if (!extract || !env) {
    return {
      status: "blocked",
      adapter_id: "open-recs-source-extract",
      reason: "The adapter could not read the expected extraction handler and .env.example.",
    };
  }

  if (
    byPath.has(OBSERVE_PATH) ||
    byPath.has(OBSERVE_TEST_PATH) ||
    extract.content.includes("emitCruxAIInvocation") ||
    env.content.includes("CRUX_INGEST_URL")
  ) {
    return {
      status: "blocked",
      adapter_id: "open-recs-source-extract",
      reason: "A CRUX observation integration already appears to be present. CRUX will not stack a second patch on top of it.",
    };
  }

  if (
    !extract.content.includes(importAnchor) ||
    extract.content.split(importAnchor).length !== 2 ||
    !extract.content.includes(resultAnchor) ||
    extract.content.split(resultAnchor).length !== 2
  ) {
    return {
      status: "blocked",
      adapter_id: "open-recs-source-extract",
      reason: "The tested source anchors have changed, so this deterministic adapter will not guess where to edit.",
    };
  }

  const nextExtract = extract.content
    .replace(
      importAnchor,
      `${importAnchor}\nimport { emitCruxAIInvocation } from '@/lib/crux/observe';`,
    )
    .replace(resultAnchor, `${resultAnchor}${hookBlock}`);

  const nextEnv = `${env.content.replace(/\s*$/, "")}\n${envBlock}`;

  return {
    status: "ready",
    adapter_id: "open-recs-source-extract",
    title: "Observe source.extract with bounded CRUX metadata",
    branch_name: "crux/observe-source-extract",
    commit_message: "Observe source.extract with bounded CRUX metadata",
    pull_request_body: [
      "CRUX discovered and a person confirmed source.extract as an AI-use boundary.",
      "",
      "This patch adds an opt-in metadata-only observation hook at that exact workflow boundary.",
      "",
      `Bind CRUX_SYSTEM_VERSION_REF to \`${systemVersionRef}\` when configuring the integration.`,
      "",
      "The patch does not send prompts, model output, reasoning or source-document content, and CRUX delivery failures do not fail extraction.",
      "",
      "This pull request is generated for review only. CRUX does not merge it automatically.",
    ].join("\n"),
    changes: [
      {
        path: OBSERVE_PATH,
        mode: "create",
        content: observeSource,
        purpose: "Add the opt-in metadata-only CRUX emitter.",
      },
      {
        path: OBSERVE_TEST_PATH,
        mode: "create",
        content: observeTestSource,
        purpose: "Prove the emitted payload excludes prompt and document content.",
      },
      {
        path: EXTRACT_PATH,
        mode: "update",
        content: nextExtract,
        ...(extract.sha ? { base_sha: extract.sha } : {}),
        purpose: "Emit two bounded observations after the two source.extract model operations complete.",
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
