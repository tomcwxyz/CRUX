import { parsePortableBundle, validateBundleReferences, type CruxPortableBundle } from "@crux/formats";
import { buildReaderModel } from "./reader-model";

const storageKey = "crux:browser-records:v1";
const maximumRecords = 12;
const maximumRecordChars = 700_000;
const maximumStorageChars = 2_000_000;

export type BrowserRecord = {
  id: string;
  createdAt: string;
  savedAt: string;
  changesSinceLastSave: string[];
  bundle: CruxPortableBundle;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const validDate = (date: unknown): date is string =>
  typeof date === "string" && Number.isFinite(Date.parse(date));
const validateBundle = (raw: unknown): CruxPortableBundle => {
  const bundle = parsePortableBundle(raw);
  if (!validateBundleReferences(bundle).valid) throw new Error("This record has broken references.");
  if (JSON.stringify(bundle).length > maximumRecordChars) {
    throw new Error("This record is too large for browser storage. Download a JSON copy instead.");
  }
  return bundle;
};

/** Never trust edited/stale browser storage. No accounts or server sync are involved. */
export function parseBrowserRecords(raw: string | null): BrowserRecord[] {
  if (raw === null) return [];
  if (raw.length > maximumStorageChars) throw new Error("Saved records exceed the supported browser limit.");
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error("Saved records are damaged. Nothing has been overwritten."); }
  if (!Array.isArray(data) || data.length > maximumRecords) throw new Error("Saved record list is invalid.");
  const used = new Set<string>();
  return data.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("A saved record is invalid.");
    const value = entry as Partial<BrowserRecord>;
    if (!value.id || typeof value.id !== "string" || value.id.length > 100
      || used.has(value.id) || !validDate(value.createdAt) || !validDate(value.savedAt)
      || !Array.isArray(value.changesSinceLastSave)
      || value.changesSinceLastSave.length > 6
      || value.changesSinceLastSave.some((change) => typeof change !== "string" || change.length > 160)) {
      throw new Error("A saved record is invalid.");
    }
    used.add(value.id);
    return {
      id: value.id,
      createdAt: value.createdAt,
      savedAt: value.savedAt,
      changesSinceLastSave: value.changesSinceLastSave,
      bundle: validateBundle(value.bundle),
    };
  });
}

export function readBrowserRecords(storage: StorageLike): BrowserRecord[] {
  return parseBrowserRecords(storage.getItem(storageKey));
}

function describeChanges(before: CruxPortableBundle, after: CruxPortableBundle): string[] {
  const changes: string[] = [];
  if (before.ai_uses[0]?.purpose !== after.ai_uses[0]?.purpose) changes.push("The description was edited");
  const beforeVersions = before.systems.map((system) => system.current_version_ref).join("|");
  const afterVersions = after.systems.map((system) => system.current_version_ref).join("|");
  if (beforeVersions !== afterVersions) changes.push("The recorded system version changed");
  if (before.claims.length !== after.claims.length) changes.push("The number of statements changed");
  if (before.evidence.length !== after.evidence.length || before.evidence_links.length !== after.evidence_links.length) {
    changes.push("Evidence was added or removed");
  }
  if (before.observations.length !== after.observations.length
    || before.runs.length !== after.runs.length || before.events.length !== after.events.length) {
    changes.push("Recorded system activity was updated");
  }
  if (before.receipts.length !== after.receipts.length) changes.push("Specific cases were added or removed");
  if (!changes.length && JSON.stringify(before) !== JSON.stringify(after)) changes.push("Other record details changed");
  return changes;
}

export function putBrowserRecord(
  storage: StorageLike,
  bundle: CruxPortableBundle,
  existingId?: string,
  now = new Date().toISOString(),
  createId: () => string = () => crypto.randomUUID(),
): BrowserRecord {
  const valid = validateBundle(bundle);
  if (!validDate(now)) throw new Error("The save date is invalid.");
  const current = readBrowserRecords(storage);
  const previous = existingId ? current.find((record) => record.id === existingId) : undefined;
  if (existingId && !previous) throw new Error("The saved record is no longer in this browser. Save a new copy.");
  if (!previous && current.length >= maximumRecords) throw new Error("This browser already has 12 records. Download or remove one before saving another.");
  const id = previous?.id ?? createId();
  if (!id || id.length > 100 || current.some((item) => item.id === id && item !== previous)) {
    throw new Error("Could not create a unique record ID.");
  }
  const entry: BrowserRecord = {
    id,
    createdAt: previous?.createdAt ?? now,
    savedAt: now,
    changesSinceLastSave: previous ? describeChanges(previous.bundle, valid) : [],
    bundle: valid,
  };
  const updated = [entry, ...current.filter((record) => record.id !== id)];
  const raw = JSON.stringify(updated);
  if (raw.length > maximumStorageChars) throw new Error("Browser storage limit reached. Download a JSON copy instead.");
  storage.setItem(storageKey, raw);
  return entry;
}

export function deleteBrowserRecord(storage: StorageLike, id: string): void {
  const current = readBrowserRecords(storage);
  if (!current.some((record) => record.id === id)) throw new Error("That record is no longer saved here.");
  storage.setItem(storageKey, JSON.stringify(current.filter((record) => record.id !== id)));
}

/** These are prompts to check, not a score, certification or live health status. */
export function reviewSignals(bundle: CruxPortableBundle): {
  title: string;
  actions: string[];
  observations: number;
  differences: number;
} {
  const actions: string[] = [];
  let observations = 0;
  let differences = 0;
  for (const use of bundle.ai_uses) {
    const model = buildReaderModel({ kind: "working", bundle }, use.id);
    const subject = bundle.ai_uses.length > 1 ? use.name + ": " : "";
    if (!model.claims.length) actions.push(subject + "Add a statement about what AI does");
    else if (model.claims.some((claim) => claim.evidence.length === 0)) actions.push(subject + "Some statements have no evidence");
    if (model.unknowns.length) actions.push(subject + "Some questions are still unanswered");
    if (use.consequential && !model.cases.length) actions.push(subject + "No particular case has been recorded");
    const count = model.activity?.differencesToReview ?? 0;
    if (count) actions.unshift(subject + count + " observed difference" + (count === 1 ? "" : "s") + " to review");
    observations += (model.activity?.modelComparisons ?? 0) + (model.activity?.attachedObservations ?? 0);
    differences += count;
  }
  if (!observations) actions.push("No linked runtime observations in this record");
  return {
    title: differences ? "Differences to review" : actions.length ? "Questions to check" : "No flagged gaps in this record",
    actions: actions.slice(0, 8),
    observations,
    differences,
  };
}

export function browserRecordLabel(record: BrowserRecord): string {
  const first = record.bundle.ai_uses[0]?.name ?? "Unnamed AI use";
  const more = record.bundle.ai_uses.length - 1;
  return more > 0 ? first + " and " + more + " more" : first;
}
