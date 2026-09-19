import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  GITHUB_CONNECTION_COOKIE,
  GITHUB_OAUTH_STATE_COOKIE,
  connectionCookieOptions,
  encodeGithubConnection,
  exchangeGithubOauthCode,
  getGithubAppConfig,
  githubInstallUrl,
  listUserGithubInstallations,
  listUserInstallationRepositoryIds,
} from "../../../../lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const redirectToDiscover = (origin: string, state: string) =>
  NextResponse.redirect(new URL(`/discover?github=${state}`, origin));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GITHUB_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GITHUB_OAUTH_STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectToDiscover(origin, "invalid-state");
  }

  try {
    const config = getGithubAppConfig();
    const userToken = await exchangeGithubOauthCode({
      code,
      redirectUri: `${origin}/api/github/callback`,
      config,
    });
    const installations = await listUserGithubInstallations(userToken);
    const verifiedInstallations = installations
      .filter((installation) => String(installation.app_id) === String(config.appId));

    if (verifiedInstallations.length === 0) {
      return NextResponse.redirect(githubInstallUrl(config));
    }

    const installationRepositories = await Promise.all(
      verifiedInstallations.map(async (installation) => ({
        id: installation.id,
        repository_ids: await listUserInstallationRepositoryIds(userToken, installation.id),
      })),
    );

    const scopedInstallations = installationRepositories.filter(
      (installation) => installation.repository_ids.length > 0,
    );

    if (scopedInstallations.length === 0) {
      return redirectToDiscover(origin, "no-repositories");
    }

    cookieStore.set(
      GITHUB_CONNECTION_COOKIE,
      encodeGithubConnection({
        version: 1,
        installations: scopedInstallations,
        expires_at: Date.now() + 60 * 60 * 1000,
      }, config.connectionSecret),
      {
        ...connectionCookieOptions(),
        maxAge: 60 * 60,
      },
    );

    return redirectToDiscover(origin, "connected");
  } catch {
    return redirectToDiscover(origin, "error");
  }
}
