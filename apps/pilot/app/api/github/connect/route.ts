import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  GITHUB_OAUTH_STATE_COOKIE,
  connectionCookieOptions,
  createGithubOauthState,
  githubAppConfigured,
  githubOauthUrl,
} from "../../../../lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!githubAppConfigured()) {
    return Response.json({
      ok: false,
      code: "github_app_not_configured",
      message: "The CRUX GitHub App is not configured on this deployment.",
    }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const state = createGithubOauthState();
  const cookieStore = await cookies();
  cookieStore.set(GITHUB_OAUTH_STATE_COOKIE, state, {
    ...connectionCookieOptions(),
    maxAge: 10 * 60,
  });

  return NextResponse.redirect(githubOauthUrl({ origin, state }));
}
