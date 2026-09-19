import { cookies } from "next/headers";
import {
  GITHUB_CONNECTION_COOKIE,
  decodeGithubConnection,
  getGithubAppConfig,
  githubAppConfigured,
} from "../../../../lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!githubAppConfigured()) {
    return Response.json({
      ok: true,
      configured: false,
      connected: false,
      installation_count: 0,
    });
  }

  const config = getGithubAppConfig();
  const cookieStore = await cookies();
  const connection = decodeGithubConnection(
    cookieStore.get(GITHUB_CONNECTION_COOKIE)?.value,
    config.connectionSecret,
  );

  return Response.json({
    ok: true,
    configured: true,
    connected: Boolean(connection),
    installation_count: connection?.installation_ids.length ?? 0,
  });
}
