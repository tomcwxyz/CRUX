import { NextRequest, NextResponse } from "next/server";
import { oauthConfig, allowedOrigin, tokenCookie, unseal, type SaasProvider } from "../../../../../lib/saas-oauth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Credential = {token: string; expires: number};
const failed = (message: string, status: number) => NextResponse.json({error: message}, {status, headers: {"Cache-Control": "no-store"}});
type Obj = Record<string, unknown>;
const object = (value: unknown): Obj => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const list = (value: unknown): Obj[] => Array.isArray(value) ? value.filter((v) => v && typeof v === "object").map(object) : [];
async function api(url: string, token: string): Promise<Obj> {
  const result = await fetch(url, {headers: {Authorization: `Bearer ${token}`}, cache: "no-store", signal: AbortSignal.timeout(12000)});
  if (!result.ok) throw new Error(result.status === 403 ? "Your account may need administrator permission." : `Provider returned HTTP ${result.status}.`);
  return object(await result.json());
}
async function scanGoogle(token: string) {
  // One bounded page: no user identifiers, prompts or content returned to the client.
  const start = new Date(Date.now() - 30 * 86400000).toISOString();
  const url = new URL("https://admin.googleapis.com/admin/reports/v1/activity/users/all/applications/gemini_in_workspace_apps");
  url.searchParams.set("startTime", start);
  url.searchParams.set("eventName", "feature_utilization");
  url.searchParams.set("maxResults", "100");
  const response = await api(url.toString(), token);
  const counts = new Map<string, number>();
  let events = 0;
  for (const record of list(response.items)) for (const event of list(record.events)) {
    if (event.name !== "feature_utilization" || event.type !== "ai_usage_event") continue;
    events++;
    const params = list(event.parameters);
    const raw = params.find((param) => param.name === "app_name")?.value;
    const allowed = ["gmail", "docs", "sheets", "slides", "meet", "drive", "chat", "gemini_app"];
    const app = typeof raw === "string" && allowed.includes(raw) ? raw : "other";
    counts.set(app, (counts.get(app) ?? 0) + 1);
  }
  return {provider: "google", checked: true, events, uses: [...counts].map(([name, count]) => ({name: `Gemini in ${name}`, count, status: "observed_in_audit"})),
    limitation: "A sample of up to 100 report entries from the last 30 days. Incomplete results are possible; no event does not establish non-use. Organisational purpose and outcomes remain unverified.",
    truncated: Boolean(response.nextPageToken)};
}
async function scanAirtable(token: string) {
  const response = await api("https://api.airtable.com/v0/meta/bases", token);
  const bases = list(response.bases);
  // Metadata access is not the Enterprise AI activity audit API.
  // Never label a base or normal field as confirmed AI use.
  return {provider: "airtable", checked: true, baseCount: bases.length, uses: [] as {name: string; count: number; status: string}[],
    limitation: "Connected to Airtable with read-only base metadata access. Base visibility is not evidence of AI use. Enterprise Scale administrator audit access is needed to verify AI_CREDIT_CONSUMED activity.",
    truncated: Boolean(response.offset)};
}
export async function GET(request: NextRequest, context: {params: Promise<{provider: string}>}) {
  const {provider: requested} = await context.params;
  if (requested !== "airtable" && requested !== "google") return failed("Not found", 404);
  const provider = requested as SaasProvider;
  const config = oauthConfig(provider);
  if (!config || !allowedOrigin(request, config.origin)) return failed("Connection unavailable", 503);
  const raw = request.cookies.get(tokenCookie(provider))?.value;
  const credential = raw ? unseal<Credential>(raw) : null;
  if (!credential || credential.expires <= Date.now()) return failed("Connect this platform first (the temporary connection may have expired).", 401);
  try {
    const result = provider === "google" ? await scanGoogle(credential.token) : await scanAirtable(credential.token);
    return NextResponse.json(result, {headers: {"Cache-Control": "no-store"}});
  } catch (cause) {
    return failed(cause instanceof Error ? cause.message : "Could not inspect this platform.", 502);
  }
}
