import {
  generateOpenRecsSourceExtractPatch,
  type GeneratedObservationPatch,
  type RepositoryPatchFile,
} from "./observation-patch-adapters";
import { generateSoundingsAskPatch } from "./soundings-observation-patch";

export type ObservationPatchAdapterId =
  | "open-recs-source-extract"
  | "soundings-ask";

export type ObservationPatchFileRequest = {
  path: string;
  optional?: boolean;
};

export type ObservationPatchAdapter = {
  id: ObservationPatchAdapterId;
  repository: string;
  files: ObservationPatchFileRequest[];
  generate: (input: {
    repository: string;
    files: RepositoryPatchFile[];
    systemVersionRef: string;
  }) => GeneratedObservationPatch;
};

const adapters: Record<ObservationPatchAdapterId, ObservationPatchAdapter> = {
  "open-recs-source-extract": {
    id: "open-recs-source-extract",
    repository: "tomcwxyz/open-recs-local",
    files: [
      { path: "src/lib/jobs/handlers/extract.ts" },
      { path: ".env.example" },
      { path: "src/lib/crux/observe.ts", optional: true },
      { path: "src/lib/crux/observe.test.ts", optional: true },
    ],
    generate: generateOpenRecsSourceExtractPatch,
  },
  "soundings-ask": {
    id: "soundings-ask",
    repository: "tomcwxyz/soundings",
    files: [
      { path: "server/soundings/ask/orchestrator.py" },
      { path: ".env.example" },
      { path: "server/soundings/ask/crux_observe.py", optional: true },
      { path: "server/tests/test_crux_observe.py", optional: true },
    ],
    generate: generateSoundingsAskPatch,
  },
};

export const getObservationPatchAdapter = (
  adapterId: string,
  repository: string,
): ObservationPatchAdapter | null => {
  if (
    adapterId !== "open-recs-source-extract" &&
    adapterId !== "soundings-ask"
  ) {
    return null;
  }

  const adapter = adapters[adapterId];
  return adapter.repository === repository ? adapter : null;
};
