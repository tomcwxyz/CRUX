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
  listUserInstallationRepositoryAccess,
} from "../../../../lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GitHub connections now return to the same AI-use workbench.
const redirectToWorkbench = (origin: string, state: string) =>
  NextResponse.redirect(new URL(`/author?github=${state}#connect`, origin));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GITHUB_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GITHUB_OAUTH_STATE_COOKIE);

  // A cancelled authorisation is different from an expired or mismatched state.
  // Never process an OAuth code unless its browser-bound state is verified.
  if (!state || !expectedState || state !== expectedState) {
    return redirectToWorkbench(origin, "invalid-state");
  }
  if (url.searchParams.get("error") === "access_denied") {
    return redirectToWorkbench(origin, "denied");
  }
  if (!code) {
    return redirectToWorkbench(origin, "error");
  }

  try {
    const config = getGithubAppConfig();
    // Re-authorisation must not keep stale repository access if it fails.
    cookieStore.delete(GITHUB_CONNECTION_COOKIE);
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
      verifiedInstallations.map(async (installation) => {
        const access = await listUserInstallationRepositoryAccess(
          userToken,
          installation.id,
        );
        return {
          id: installation.id,
          repository_ids: access.repository_ids,
          write_repository_ids: access.write_repository_ids,
        };
      }),
    );

    const scopedInstallations = installationRepositories.filter(
      (installation) => installation.repository_ids.length > 0,
    );

    if (scopedInstallations.length === 0) {
      return redirectToWorkbench(origin, "no-repositories");
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

    return redirectToWorkbench(origin, "connected");
  } catch {
    return redirectToWorkbench(origin, "error");
  }
}
