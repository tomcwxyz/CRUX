import { cookies } from "next/headers";
import {
  GITHUB_CONNECTION_COOKIE,
  decodeGithubConnection,
  getGithubAppConfig,
  githubAppConfigured,
  listGithubInstallationRepositories,
} from "../../../../lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!githubAppConfigured()) {
    return Response.json({ ok: false, code: "github_app_not_configured" }, { status: 503 });
  }

  const config = getGithubAppConfig();
  const cookieStore = await cookies();
  const connection = decodeGithubConnection(
    cookieStore.get(GITHUB_CONNECTION_COOKIE)?.value,
    config.connectionSecret,
  );
  if (!connection) {
    return Response.json({ ok: false, code: "github_not_connected" }, { status: 401 });
  }

  try {
    const groups = await Promise.all(
      connection.installation_ids.map((installationId) =>
        listGithubInstallationRepositories(installationId, config),
      ),
    );
    const repositories = groups
      .flat()
      .sort((left, right) => left.full_name.localeCompare(right.full_name));

    return Response.json({ ok: true, repositories });
  } catch (error) {
    return Response.json({
      ok: false,
      code: "github_repository_list_failed",
      message: error instanceof Error ? error.message : "CRUX could not list GitHub repositories.",
    }, { status: 502 });
  }
}
