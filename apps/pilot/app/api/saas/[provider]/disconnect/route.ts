import { NextRequest, NextResponse } from "next/server";
import { oauthConfig, allowedOrigin, tokenCookie, type SaasProvider } from "../../../../../lib/saas-oauth";

export async function POST(request: NextRequest, context: {params: Promise<{provider: string}>}) {
  const {provider: requested} = await context.params;
  if (requested !== "airtable" && requested !== "google") return new Response("Not found", {status: 404});
  const provider = requested as SaasProvider;
  const config = oauthConfig(provider);
  if (!config || !allowedOrigin(request, config.origin) || request.headers.get("origin") !== config.origin)
    return new Response("Forbidden", {status: 403});
  const response = NextResponse.json({connected: false});
  response.cookies.delete(tokenCookie(provider));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
