import { NextRequest, NextResponse } from "next/server";
import { connectionCookie, oauthConfig, safeReturn, seal, stateCookie, tokenCookie, unseal, allowedOrigin, type SaasProvider } from "../../../../../lib/saas-oauth";

export const runtime = "nodejs";
type State = { state: string; verifier: string; created: number };
export async function GET(request: NextRequest, context: {params: Promise<{provider: string}>}) {
  const {provider: requested} = await context.params;
  if (requested !== "airtable" && requested !== "google") return new Response("Not found", {status: 404});
  const provider = requested as SaasProvider;
  const config = oauthConfig(provider);
  if (!config) return new Response("Connection unavailable", {status: 503});
  if (!allowedOrigin(request, config.origin)) return new Response("Invalid origin", {status: 400});
  const url = new URL(request.url);
  const cookie = request.cookies.get(stateCookie(provider))?.value;
  const expected = cookie ? unseal<State>(cookie) : null;
  const redirect = (status: string) => {
    const response = NextResponse.redirect(safeReturn(config.origin, provider, status));
    response.cookies.delete(stateCookie(provider));
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  if (!expected || Date.now() - expected.created > 600000 ||
      url.searchParams.get("state") !== expected.state) return redirect("invalid-state");
  if (url.searchParams.has("error")) return redirect("cancelled");
  const code = url.searchParams.get("code");
  if (!code) return redirect("failed");
  try {
    const tokenUrl = provider === "airtable"
      ? "https://airtable.com/oauth2/v1/token" : "https://oauth2.googleapis.com/token";
    const body = new URLSearchParams({
      grant_type: "authorization_code", code, client_id: config.clientId,
      client_secret: config.clientSecret, redirect_uri: config.redirectUri,
    });
    if (provider === "airtable") body.set("code_verifier", expected.verifier);
    const result = await fetch(tokenUrl, {
      method: "POST", headers: {"content-type": "application/x-www-form-urlencoded"},
      body: body.toString(), cache: "no-store", signal: AbortSignal.timeout(12000),
    });
    const json = await result.json() as {access_token?: string; expires_in?: number};
    if (!result.ok || !json.access_token) return redirect("failed");
    const expires = Date.now() + Math.min(Math.max(json.expires_in ?? 3600, 60), 2700) * 1000;
    const response = redirect("connected");
    // Short-lived, encrypted, httpOnly. No refresh token, raw data or persistent connection stored.
    response.cookies.set(tokenCookie(provider), seal({token: json.access_token, expires}), connectionCookie);
    return response;
  } catch { return redirect("failed"); }
}
