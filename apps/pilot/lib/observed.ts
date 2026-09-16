import {
  compareDeclaredAndObservedModels,
  hasDeclaredObservedDivergence,
  type DeclaredObservedComparison,
} from "@crux/core/observed";
import type { CruxPortableBundle } from "@crux/formats";

export type PilotObservedBehaviour = {
  comparisons: DeclaredObservedComparison[];
  divergenceCount: number;
  comparableCount: number;
  observationCount: number;
};

/**
 * Select observed AI events only from runs that explicitly reference the exact
 * SystemVersion being viewed. This avoids comparing runtime metadata against a
 * newer/older declaration merely because it belongs to the same System.
 */
export const observedBehaviourForVersion = (
  bundle: CruxPortableBundle,
  systemVersionId: string | undefined,
): PilotObservedBehaviour => {
  if (!systemVersionId) {
    return { comparisons: [], divergenceCount: 0, comparableCount: 0, observationCount: 0 };
  }

  const version = bundle.system_versions.find((item) => item.id === systemVersionId);
  if (!version) {
    return { comparisons: [], divergenceCount: 0, comparableCount: 0, observationCount: 0 };
  }

  const runIds = new Set(
    bundle.runs
      .filter((run) => run.system_version_ref === systemVersionId)
      .map((run) => run.id),
  );
  const events = bundle.events.filter((event) => runIds.has(event.run_ref));
  const comparisons = compareDeclaredAndObservedModels(version, events);

  return {
    comparisons,
    divergenceCount: comparisons.filter(hasDeclaredObservedDivergence).length,
    comparableCount: comparisons.filter((comparison) => comparison.comparable).length,
    observationCount: comparisons.length,
  };
};
