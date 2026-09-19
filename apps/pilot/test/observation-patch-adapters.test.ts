import { describe, expect, it } from "vitest";
import { generateOpenRecsSourceExtractPatch } from "../lib/observation-patch-adapters";
import { generateSoundingsAskPatch } from "../lib/soundings-observation-patch";

const extract = `import type { RepoContext } from '@/lib/repositories/types';

async function run(ctx: any) {
    const metadata: SourceMetadataOutput = pass1Result.value;
    const recs: RecommendationInput[] = pass2Result.value.recommendations;

    return { metadata, recs };
}
`;

describe("Open Recs observation patch adapter", () => {
  it("generates exact bounded changes only when tested anchors are present", () => {
    const patch = generateOpenRecsSourceExtractPatch({
      repository: "tomcwxyz/open-recs-local",
      systemVersionRef: "system-version:open-recs-source-extract:0.1",
      files: [
        {
          path: "src/lib/jobs/handlers/extract.ts",
          sha: "extract-sha",
          content: extract,
        },
        {
          path: ".env.example",
          sha: "env-sha",
          content: "APP_MODE=local\n",
        },
      ],
    });

    expect(patch.status).toBe("ready");
    if (patch.status !== "ready") return;

    expect(patch.changes).toHaveLength(4);
    const changedExtract = patch.changes.find(
      (change) => change.path === "src/lib/jobs/handlers/extract.ts",
    );
    expect(changedExtract?.content).toContain("emitCruxAIInvocation");
    expect(changedExtract?.content).toContain("source_metadata_extract");
    expect(changedExtract?.content).toContain("recommendation_extract");
    expect(patch.pull_request_body).toContain(
      "system-version:open-recs-source-extract:0.1",
    );
    expect(patch.pull_request_body).toContain("does not merge it automatically");
  });

  it("refuses to guess when the source anchors have moved", () => {
    const patch = generateOpenRecsSourceExtractPatch({
      repository: "tomcwxyz/open-recs-local",
      systemVersionRef: "system-version:open-recs-source-extract:0.1",
      files: [
        {
          path: "src/lib/jobs/handlers/extract.ts",
          content: "export async function extractHandler() {}",
        },
        { path: ".env.example", content: "APP_MODE=local\n" },
      ],
    });

    expect(patch).toEqual({
      status: "blocked",
      adapter_id: "open-recs-source-extract",
      reason: expect.stringContaining("will not guess"),
    });
  });

  it("refuses to stack a second integration", () => {
    const patch = generateOpenRecsSourceExtractPatch({
      repository: "tomcwxyz/open-recs-local",
      systemVersionRef: "system-version:open-recs-source-extract:0.1",
      files: [
        {
          path: "src/lib/jobs/handlers/extract.ts",
          content: extract.replace(
            "async function run",
            "const emitCruxAIInvocation = () => {};\nasync function run",
          ),
        },
        { path: ".env.example", content: "APP_MODE=local\n" },
      ],
    });

    expect(patch.status).toBe("blocked");
    if (patch.status === "blocked") {
      expect(patch.reason).toContain("already");
    }
  });
});


const soundingsOrchestrator = `import asyncio

from soundings.ask.dispatcher import ToolDispatcher

class AskOrchestrator:
    def __init__(self) -> None:
        self._answer_cache = answer_cache

    async def _loop(self) -> None:
        response = await asyncio.to_thread(
            lambda: client.messages.create(
                model=self._model,
                messages=messages,
            )
        )

        # A cybersecurity/safety classifier can decline a request: HTTP 200
        return response
`;

describe("Soundings Ask observation patch adapter", () => {
  it("generates the CI-tested bounded Python patch when exact anchors are present", () => {
    const patch = generateSoundingsAskPatch({
      repository: "tomcwxyz/soundings",
      systemVersionRef: "system-version:soundings-ask:0.1",
      files: [
        {
          path: "server/soundings/ask/orchestrator.py",
          sha: "orchestrator-sha",
          content: soundingsOrchestrator,
        },
        {
          path: ".env.example",
          sha: "env-sha",
          content: "SOUNDINGS_ENV=dev\n",
        },
      ],
    });

    expect(patch.status).toBe("ready");
    if (patch.status !== "ready") return;

    expect(patch.adapter_id).toBe("soundings-ask");
    expect(patch.changes).toHaveLength(4);
    const orchestrator = patch.changes.find(
      (change) => change.path === "server/soundings/ask/orchestrator.py",
    );
    expect(orchestrator?.content).toContain(
      "from soundings.ask.crux_observe import emit_crux_ai_invocation",
    );
    expect(orchestrator?.content).toContain(
      "self._crux_observation_tasks: set[asyncio.Task[None]] = set()",
    );
    expect(orchestrator?.content).toContain('workflow="ask"');
    expect(orchestrator?.content).toContain('operation="messages.create"');
    expect(orchestrator?.content).not.toContain("CRUX_SYSTEM_VERSION_REF=");
    expect(patch.pull_request_body).toContain(
      "system-version:soundings-ask:0.1",
    );
    expect(patch.pull_request_body).toContain("does not merge it automatically");
  });

  it("refuses to guess when the Ask loop anchors have moved", () => {
    const patch = generateSoundingsAskPatch({
      repository: "tomcwxyz/soundings",
      systemVersionRef: "system-version:soundings-ask:0.1",
      files: [
        {
          path: "server/soundings/ask/orchestrator.py",
          content: "class AskOrchestrator: pass\n",
        },
        { path: ".env.example", content: "SOUNDINGS_ENV=dev\n" },
      ],
    });

    expect(patch).toEqual({
      status: "blocked",
      adapter_id: "soundings-ask",
      reason: expect.stringContaining("will not guess"),
    });
  });

  it("refuses to stack a second Soundings Ask integration", () => {
    const patch = generateSoundingsAskPatch({
      repository: "tomcwxyz/soundings",
      systemVersionRef: "system-version:soundings-ask:0.1",
      files: [
        {
          path: "server/soundings/ask/orchestrator.py",
          content: soundingsOrchestrator,
        },
        { path: ".env.example", content: "SOUNDINGS_ENV=dev\n" },
        {
          path: "server/soundings/ask/crux_observe.py",
          content: "already here\n",
        },
      ],
    });

    expect(patch.status).toBe("blocked");
    if (patch.status === "blocked") {
      expect(patch.reason).toContain("already");
    }
  });
});
