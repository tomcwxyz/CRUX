import { cookies } from "next/headers";
import {
  GITHUB_API_VERSION,
  GITHUB_CONNECTION_COOKIE,
  createGithubInstallationToken,
  decodeGithubConnection,
  getGithubAppConfig,
  githubAppConfigured,
  githubConnectionAllowsRepository,
  type GithubConnection,
} from "../../../../../lib/github-app";
import {
  getObservationPatchAdapter,
} from "../../../../../lib/observation-patch-registry";
import type { RepositoryPatchFile } from "../../../../../lib/observation-patch-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GithubContent = {
  sha?: string;
  content?: string;
  encoding?: string;
};

const headers = (token?: string) => ({
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": GITHUB_API_VERSION,
  "User-Agent": "crux-discovery-pilot",
  ...(token
    ? { Authorization: `Bearer ${token}` }
    : process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
});

const verifiedInstallationContext = async (
  installationId: number | undefined,
): Promise<
  | {
      installationId: number;
      token: string;
      connection: GithubConnection;
    }
  | undefined
> => {
  if (installationId === undefined) return undefined;
  if (!githubAppConfigured()) {
    throw new Error("The CRUX GitHub App is not configured on this deployment.");
  }

  const config = getGithubAppConfig();
  const cookieStore = await cookies();
  const connection = decodeGithubConnection(
    cookieStore.get(GITHUB_CONNECTION_COOKIE)?.value,
    config.connectionSecret,
  );
  if (
    !connection?.installations.some(
      (installation) => installation.id === installationId,
    )
  ) {
    throw new Error(
      "This browser session is not connected to that GitHub installation.",
    );
  }

  return {
    installationId,
    connection,
    token: await createGithubInstallationToken(
      installationId,
      config,
      { contents: "read" },
    ),
  };
};

const getFile = async ({
  repository,
  path,
  ref,
  token,
  optional = false,
}: {
  repository: string;
  path: string;
  ref: string;
  token?: string;
  optional?: boolean;
}): Promise<RepositoryPatchFile | null> => {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${encodeURIComponent(ref)}`,
    {
      headers: headers(token),
      cache: "no-store",
    },
  );

  if (optional && response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `GitHub returned ${response.status} while CRUX checked ${path}.`,
    );
  }

  const body = (await response.json()) as GithubContent;
  if (!body.content || body.encoding !== "base64") {
    throw new Error(`GitHub did not return readable text for ${path}.`);
  }

  return {
    path,
    ...(body.sha ? { sha: body.sha } : {}),
    content: Buffer.from(body.content.replace(/\n/g, ""), "base64").toString(
      "utf8",
    ),
  };
};

export async function POST(request: Request) {
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

  if (!body.repository || !body.adapter_id || !body.system_version_ref) {
    return Response.json(
      {
        ok: false,
        code: "invalid_request",
        message:
          "Repository, exact observation adapter and SystemVersion are required.",
      },
      { status: 400 },
    );
  }

  const adapter = getObservationPatchAdapter(
    body.adapter_id,
    body.repository,
  );
  if (!adapter) {
    return Response.json(
      {
        ok: false,
        code: "unsupported_patch_adapter",
        message:
          "No exact repository patch adapter is available for this proposal.",
      },
      { status: 400 },
    );
  }

  const installationId =
    Number.isSafeInteger(body.installation_id) &&
    (body.installation_id ?? 0) > 0
      ? body.installation_id
      : undefined;

  try {
    const installation = await verifiedInstallationContext(installationId);
    const repositoryResponse = await fetch(
      `https://api.github.com/repos/${body.repository}`,
      {
        headers: headers(installation?.token),
        cache: "no-store",
      },
    );
    if (!repositoryResponse.ok) {
      throw new Error(
        `GitHub returned ${repositoryResponse.status} while CRUX checked the repository.`,
      );
    }
    const repository = (await repositoryResponse.json()) as {
      id: number;
      default_branch?: string;
    };

    if (
      installation &&
      !githubConnectionAllowsRepository(
        installation.connection,
        installation.installationId,
        repository.id,
      )
    ) {
      throw new Error(
        "This GitHub user connection is not allowed to read that repository.",
      );
    }

    if (!repository.default_branch) {
      throw new Error("GitHub did not return the repository default branch.");
    }
    const ref = repository.default_branch;

    const fetched = await Promise.all(
      adapter.files.map((file) =>
        getFile({
          repository: body.repository!,
          path: file.path,
          ref,
          ...(installation?.token ? { token: installation.token } : {}),
          ...(file.optional ? { optional: true } : {}),
        }),
      ),
    );

    const patch = adapter.generate({
      repository: body.repository,
      systemVersionRef: body.system_version_ref,
      files: fetched.filter(
        (file): file is RepositoryPatchFile => Boolean(file),
      ),
    });

    if (patch.status === "blocked") {
      return Response.json({
        ok: true,
        patch: {
          status: "blocked",
          adapter_id: patch.adapter_id,
          reason: patch.reason,
        },
      });
    }

    return Response.json({
      ok: true,
      patch: {
        status: "ready",
        adapter_id: patch.adapter_id,
        title: patch.title,
        branch_name: patch.branch_name,
        changes: patch.changes.map((change) => ({
          path: change.path,
          mode: change.mode,
          purpose: change.purpose,
          ...(change.base_sha ? { base_sha: change.base_sha } : {}),
        })),
        required_environment: patch.required_environment,
        pull_request_body: patch.pull_request_body,
        checked_ref: ref,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "CRUX could not check patch readiness.";
    const status = /not connected|not configured|not allowed/i.test(message)
      ? 401
      : 502;
    return Response.json(
      {
        ok: false,
        code: "patch_readiness_failed",
        message,
      },
      { status },
    );
  }
}
