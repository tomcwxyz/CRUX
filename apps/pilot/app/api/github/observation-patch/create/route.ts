import { cookies } from "next/headers";
import {
  GITHUB_CONNECTION_COOKIE,
  decodeGithubConnection,
  getGithubAppConfig,
  githubAppConfigured,
} from "../../../../../lib/github-app";
import { createObservationPullRequest } from "../../../../../lib/github-observation-pr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!githubAppConfigured()) {
    return Response.json(
      {
        ok: false,
        code: "github_app_not_configured",
        message: "The CRUX GitHub App is not configured on this deployment.",
      },
      { status: 503 },
    );
  }

  let body: {
    repository?: string;
    installation_id?: number;
    adapter_id?: string;
    system_version_ref?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, code: "invalid_json" }, { status: 400 });
  }

  if (
    !body.repository ||
    !Number.isSafeInteger(body.installation_id) ||
    (body.installation_id ?? 0) <= 0 ||
    !body.adapter_id ||
    !body.system_version_ref
  ) {
    return Response.json(
      {
        ok: false,
        code: "invalid_request",
        message:
          "Repository, verified installation, exact adapter and SystemVersion are required.",
      },
      { status: 400 },
    );
  }

  const config = getGithubAppConfig();
  const cookieStore = await cookies();
  const connection = decodeGithubConnection(
    cookieStore.get(GITHUB_CONNECTION_COOKIE)?.value,
    config.connectionSecret,
  );
  if (!connection) {
    return Response.json(
      {
        ok: false,
        code: "github_not_connected",
        message: "Reconnect GitHub before creating a review pull request.",
      },
      { status: 401 },
    );
  }

  try {
    const result = await createObservationPullRequest({
      repository: body.repository,
      installationId: body.installation_id!,
      connection,
      adapterId: body.adapter_id,
      systemVersionRef: body.system_version_ref,
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        code: "observation_pr_failed",
        message:
          error instanceof Error
            ? error.message
            : "CRUX could not create the review pull request.",
      },
      { status: 502 },
    );
  }
}
