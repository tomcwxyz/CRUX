import { describe, expect, it } from "vitest";
import { generateOpenRecsSourceExtractPatch } from "../lib/observation-patch-adapters";

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
