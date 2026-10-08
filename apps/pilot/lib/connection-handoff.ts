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
