import type { SimpleUseAnswers } from "./simple-ai-use";
import { parsePortableBundle, validateBundleReferences, type CruxPortableBundle } from "@crux/formats";

const key = "crux:pending-ai-use-connection:v1";
const windowMs = 30 * 60 * 1000;

type PendingConnection = {
  createdAt: number;
  answers: SimpleUseAnswers;
};

const validText = (value: unknown, max: number) =>
  typeof value === "string" && value.length <= max;

const isRole = (value: unknown): value is SimpleUseAnswers["role"] =>
  ["assist", "recommend", "decide", "act", "unsure"].includes(String(value));
const isControl = (value: unknown): value is SimpleUseAnswers["control"] =>
  ["person", "ai", "rule", "unsure"].includes(String(value));

export function parsePendingConnection(raw: string | null, now = Date.now()): SimpleUseAnswers | null {
  if (!raw || raw.length > 16_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const handoff = value as Partial<PendingConnection>;
    if (typeof handoff.createdAt !== "number" || !Number.isFinite(handoff.createdAt)
      || handoff.createdAt > now || now - handoff.createdAt > windowMs) return null;
    const a = handoff.answers;
    if (!a || !validText(a.name, 150) || !validText(a.description, 4000)
      || !validText(a.organisation, 180) || !validText(a.peopleAffected, 400)
      || !isRole(a.role) || !isControl(a.control) || typeof a.consequential !== "boolean") return null;
    return a;
  } catch {
    return null;
  }
}

/** Only carry answers across this tab, never evidence, tokens or unreviewed observations. */
export function savePendingConnection(answers: SimpleUseAnswers, now = Date.now()): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify({ createdAt: now, answers } satisfies PendingConnection));
}

/** Starting a fresh connection must not reuse an abandoned description. */
export function clearPendingConnection(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
}

export function takePendingConnection(): SimpleUseAnswers | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(key);
  window.sessionStorage.removeItem(key);
  return parsePendingConnection(raw);
}

const reviewKey = "crux:confirmed-discovery:v1";
const reviewMaxLength = 150_000;

/** Keep the exact discovered SystemVersion; do not silently change its identity. */
export function prepareDiscoveryForReview(original: CruxPortableBundle): CruxPortableBundle {
  const next = structuredClone(original);
  const use = next.ai_uses[0];
  const system = next.systems.find((item) => use?.system_refs.includes(item.id));
  const version = next.system_versions.find((item) => item.id === system?.current_version_ref);
  if (!use || !version || !use.purpose.trim()) throw new Error("A confirmed AI use is required.");
  if (next.runs.length || next.events.length || next.observations.length || next.receipts.length) {
    throw new Error("Only an unobserved discovery draft can use this transfer.");
  }
  if (!next.claims.length) {
    next.claims.push({
      schema_version: "0.1",
      id: "claim:confirmed-purpose",
      type: "descriptive",
      statement: use.purpose,
      applies_to: [{ kind: "system_version", ref: version.id }],
      status: "active",
      disclosure: "internal",
      created_at: next.generated_at,
    });
  }
  const valid = parsePortableBundle(next);
  if (!validateBundleReferences(valid).valid) throw new Error("This record contains invalid references.");
  return valid;
}

/**
 * Accept a human-confirmed discovery record without re-scoping evidence from
 * the previous authoring draft. The earlier record stays available to restore.
 */
export function acceptDiscoveredUse(
  previous: CruxPortableBundle | null,
  confirmed: CruxPortableBundle,
): { active: CruxPortableBundle; previous: CruxPortableBundle | null } {
  return { active: prepareDiscoveryForReview(confirmed), previous };
}

export function parsePendingReviewRecord(raw: string | null, now = Date.now()): CruxPortableBundle | null {
  if (!raw || raw.length > reviewMaxLength) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const payload = value as { createdAt?: unknown; bundle?: unknown };
    if (typeof payload.createdAt !== "number"
      || !Number.isFinite(payload.createdAt)
      || payload.createdAt > now
      || now - payload.createdAt > windowMs) return null;
    const bundle = parsePortableBundle(payload.bundle);
    if (!validateBundleReferences(bundle).valid) return null;
    return bundle;
  } catch {
    return null;
  }
}

export function savePendingReviewRecord(bundle: CruxPortableBundle, now = Date.now()): void {
  if (typeof window === "undefined") return;
  const prepared = prepareDiscoveryForReview(bundle);
  const raw = JSON.stringify({ createdAt: now, bundle: prepared });
  if (raw.length > reviewMaxLength) throw new Error("This record is too large for a temporary hand-off. Download it instead.");
  window.sessionStorage.setItem(reviewKey, raw);
}

export function takePendingReviewRecord(): CruxPortableBundle | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(reviewKey);
  window.sessionStorage.removeItem(reviewKey);
  return parsePendingReviewRecord(raw);
}

const oauthReturnKey = "crux:oauth-return-draft:v1";
const oauthReturnMaxLength = 500_000;

/** Session-only draft handoff for GitHub OAuth, not an account or saved CRUX record. */
export function saveOauthReturnDraft(bundle: CruxPortableBundle, imported: boolean, now = Date.now(), savedId?: string): void {
  if (typeof window === "undefined") return;
  const valid = parsePortableBundle(bundle);
  if (!validateBundleReferences(valid).valid) throw new Error("The draft has broken references.");
  if (savedId && savedId.length > 100) throw new Error("Invalid saved record identifier.");
  const raw = JSON.stringify({ createdAt: now, imported, bundle: valid, ...(savedId ? { savedId } : {}) });
  if (raw.length > oauthReturnMaxLength) throw new Error("This draft is too large to carry through GitHub. Download it before continuing.");
  window.sessionStorage.setItem(oauthReturnKey, raw);
}

export function parseOauthReturnDraft(
  raw: string | null,
  now = Date.now(),
): { bundle: CruxPortableBundle; imported: boolean; savedId?: string } | null {
  if (!raw || raw.length > oauthReturnMaxLength) return null;
  try {
    const value = JSON.parse(raw) as { createdAt?: unknown; imported?: unknown; bundle?: unknown; savedId?: unknown };
    if (typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt)
      || value.createdAt > now || now - value.createdAt > windowMs
      || typeof value.imported !== "boolean"
      || (value.savedId !== undefined && (typeof value.savedId !== "string" || !value.savedId || value.savedId.length > 100))) return null;
    const bundle = parsePortableBundle(value.bundle);
    if (!validateBundleReferences(bundle).valid) return null;
    return { bundle, imported: value.imported, ...(value.savedId ? { savedId: value.savedId as string } : {}) };
  } catch {
    return null;
  }
}

export function takeOauthReturnDraft(): { bundle: CruxPortableBundle; imported: boolean; savedId?: string } | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(oauthReturnKey);
  window.sessionStorage.removeItem(oauthReturnKey);
  return parseOauthReturnDraft(raw);
}

const savedReturnKey = "crux:open-browser-record:v1";
const savedReturnMaxLength = 750_000;

/** One-time local tab handoff; never publishes or re-scopes evidence. */
export function parsePendingBrowserRecord(
  raw: string | null,
  now = Date.now(),
): { id: string; bundle: CruxPortableBundle } | null {
  if (!raw || raw.length > savedReturnMaxLength) return null;
  try {
    const item = JSON.parse(raw) as { createdAt?: unknown; id?: unknown; bundle?: unknown };
    if (typeof item.createdAt !== "number" || !Number.isFinite(item.createdAt)
      || item.createdAt > now || now - item.createdAt > windowMs
      || typeof item.id !== "string" || item.id.length === 0 || item.id.length > 100) return null;
    const bundle = parsePortableBundle(item.bundle);
    if (!validateBundleReferences(bundle).valid) return null;
    return { id: item.id, bundle };
  } catch {
    return null;
  }
}

export function savePendingBrowserRecord(id: string, bundle: CruxPortableBundle, now = Date.now()): void {
  if (typeof window === "undefined") return;
  if (!id || id.length > 100) throw new Error("Invalid local record ID.");
  const valid = parsePortableBundle(bundle);
  if (!validateBundleReferences(valid).valid) throw new Error("Cannot reopen a record with broken references.");
  const raw = JSON.stringify({ createdAt: now, id, bundle: valid });
  if (raw.length > savedReturnMaxLength) throw new Error("This record is too large to reopen in the same tab. Download a copy.");
  window.sessionStorage.setItem(savedReturnKey, raw);
}

export function takePendingBrowserRecord(): { id: string; bundle: CruxPortableBundle } | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(savedReturnKey);
  window.sessionStorage.removeItem(savedReturnKey);
  return parsePendingBrowserRecord(raw);
}

const advancedKey = "crux:pending-advanced-ai-use:v1";

export function savePendingAdvancedAnswers(answers: SimpleUseAnswers, now = Date.now()): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify({ createdAt: now, answers } satisfies PendingConnection);
  if (raw.length > 16_000) throw new Error("This description is too large to transfer automatically.");
  window.sessionStorage.setItem(advancedKey, raw);
}

export function takePendingAdvancedAnswers(): SimpleUseAnswers | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(advancedKey);
  window.sessionStorage.removeItem(advancedKey);
  return parsePendingConnection(raw);
}
