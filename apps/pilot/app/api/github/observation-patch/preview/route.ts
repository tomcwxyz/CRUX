import { GITHUB_API_VERSION } from "../../../../../lib/github-app";
import { generateOpenRecsSourceExtractPatch } from "../../../../../lib/observation-patch-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GithubContent = {
  sha?: string;
  content?: string;
  encoding?: string;
};

const headers = () => ({
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": GITHUB_API_VERSION,
  "User-Agent": "crux-discovery-pilot",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
});

const getFile = async ({
  repository,
  path,
  ref,
  optional = false,
}: {
  repository: string;
  path: string;
  ref: string;
  optional?: boolean;
}) => {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${encodeURIComponent(ref)}`,
    { headers: headers(), cache: "no-store" },
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
    adapter_id?: string;
    system_version_ref?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, code: "invalid_json" }, { status: 400 });
  }

  if (
    body.repository !== "tomcwxyz/open-recs-local" ||
    body.adapter_id !== "open-recs-source-extract" ||
    !body.system_version_ref
  ) {
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

  try {
    const repositoryResponse = await fetch(
      "https://api.github.com/repos/tomcwxyz/open-recs-local",
      { headers: headers(), cache: "no-store" },
    );
    if (!repositoryResponse.ok) {
      throw new Error(
        `GitHub returned ${repositoryResponse.status} while CRUX checked the repository.`,
      );
    }
    const repository = (await repositoryResponse.json()) as {
      default_branch?: string;
    };
    const ref = repository.default_branch ?? "master";

    const [extract, env, observe, observeTest] = await Promise.all([
      getFile({
        repository: body.repository,
        path: "src/lib/jobs/handlers/extract.ts",
        ref,
      }),
      getFile({
        repository: body.repository,
        path: ".env.example",
        ref,
      }),
      getFile({
        repository: body.repository,
        path: "src/lib/crux/observe.ts",
        ref,
        optional: true,
      }),
      getFile({
        repository: body.repository,
        path: "src/lib/crux/observe.test.ts",
        ref,
        optional: true,
      }),
    ]);

    const patch = generateOpenRecsSourceExtractPatch({
      repository: body.repository,
      systemVersionRef: body.system_version_ref,
      files: [extract, env, observe, observeTest].filter(
        (file): file is NonNullable<typeof file> => Boolean(file),
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
    return Response.json(
      {
        ok: false,
        code: "patch_readiness_failed",
        message:
          error instanceof Error
            ? error.message
            : "CRUX could not check patch readiness.",
      },
      { status: 502 },
    );
  }
}
