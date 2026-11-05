import { NextRequest, NextResponse } from "next/server";
import { oauthConfig, allowedOrigin, pkceChallenge, randomVerifier, seal, stateCookie, transientCookie, type SaasProvider } from "../../../../../lib/saas-oauth";

export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{provider: string}> }) {
  const { provider: requested } = await context.params;
  if (requested !== "airtable" && requested !== "google") return new Response("Not found", {status: 404});
  const provider = requested as SaasProvider;
  const config = oauthConfig(provider);
  if (!config) return NextResponse.json({error: "Connection not configured by CRUX administrator."}, {status: 503});
  if (!allowedOrigin(request, config.origin)) return new Response("Invalid origin", {status: 400});
  const state = randomVerifier();
  const verifier = randomVerifier();
  const url = provider === "airtable"
    ? new URL("https://airtable.com/oauth2/v1/authorize")
    : new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  if (provider === "airtable") {
    url.searchParams.set("scope", "schema.bases:read");
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("code_challenge", pkceChallenge(verifier));
  } else {
    url.searchParams.set("scope", "https://www.googleapis.com/auth/admin.reports.audit.readonly");
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "consent");
  }
  const response = NextResponse.redirect(url);
  response.cookies.set(stateCookie(provider), seal({state, verifier, created: Date.now()}), transientCookie);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
