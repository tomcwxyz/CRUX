import type { CruxPortableBundle } from "@crux/formats";
import {
  appendManualEvidence,
  type ManualEvidenceInput,
} from "./authoring";

export type ManualEvidenceWithSourceInput = ManualEvidenceInput & {
  sourceUri?: string;
};

export const appendManualEvidenceWithSource = (
  bundle: CruxPortableBundle,
  claimId: string,
  input: ManualEvidenceWithSourceInput,
  now = new Date().toISOString(),
) => {
  const sourceUri = input.sourceUri?.trim() || undefined;
  if (sourceUri) {
    try {
      new URL(sourceUri);
    } catch {
      throw new Error("Source link must be a valid URL, including https://.");
    }
  }

  const result = appendManualEvidence(bundle, claimId, input, now);
  if (!sourceUri) return result;

  const evidence = result.bundle.evidence.find((item) => item.id === result.evidenceId);
  if (!evidence) return result;

  evidence.source.source_ref = sourceUri;
  evidence.external_refs = Array.from(new Set([...evidence.external_refs, sourceUri]));
  return result;
};
