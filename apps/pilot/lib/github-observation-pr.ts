import type { GithubConnection } from "./github-app";
import {
  GITHUB_API_VERSION,
  createGithubInstallationToken,
  getGithubAppConfig,
  githubConnectionAllowsRepository,
  githubConnectionAllowsWriteRepository,
} from "./github-app";
import type { RepositoryPatchFile } from "./observation-patch-adapters";
import { getObservationPatchAdapter } from "./observation-patch-registry";

type FetchLike = typeof fetch;

type GithubRepositoryMeta = {
  id: number;
  full_name: string;
  default_branch: string;
  html_url: string;
};

type GithubRef = {
  object?: { sha?: string };
};

type GithubCommit = {
  tree?: { sha?: string };
};

type GithubContent = {
  sha?: string;
  content?: string;
  encoding?: string;
};

type GithubBlob = { sha?: string };
type GithubTree = { sha?: string };
type GithubCreatedCommit = { sha?: string };
type GithubPull = {
  number?: number;
  html_url?: string;
  state?: string;
};

export type ObservationPullRequestResult =
  | {
      status: "created";
      repository: string;
      base_branch: string;
      base_sha: string;
      branch: string;
      commit_sha: string;
      pull_request_number: number;
      pull_request_url: string;
    }
  | {
      status: "existing_review";
      repository: string;
      branch: string;
      pull_request_number: number;
      pull_request_url: string;
    }
  | {
      status: "blocked";
      code:
        | "repository_not_allowed"
        | "user_write_not_allowed"
        | "adapter_blocked"
        | "branch_exists"
        | "app_write_permission_unavailable";
      reason: string;
    };

const apiHeaders = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": GITHUB_API_VERSION,
  "User-Agent": "crux-discovery-pilot",
});

const githubError = async (response: Response) => {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `GitHub returned HTTP ${response.status}.`;
  } catch {
    return `GitHub returned HTTP ${response.status}.`;
  }
};

const json = async <T>(
  fetchImpl: FetchLike,
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<T> => {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      ...apiHeaders(token),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await githubError(response));
  return response.json() as Promise<T>;
};

const optionalJson = async <T>(
  fetchImpl: FetchLike,
  url: string,
  token: string,
): Promise<{ found: false } | { found: true; value: T }> => {
  const response = await fetchImpl(url, {
    headers: apiHeaders(token),
    cache: "no-store",
  });
  if (response.status === 404) return { found: false };
  if (!response.ok) throw new Error(await githubError(response));
  return { found: true, value: (await response.json()) as T };
};

const readRepositoryFile = async ({
  fetchImpl,
  repository,
  path,
  ref,
  token,
  optional = false,
}: {
  fetchImpl: FetchLike;
  repository: string;
  path: string;
  ref: string;
  token: string;
  optional?: boolean;
}): Promise<RepositoryPatchFile | null> => {
  const url =
    `https://api.github.com/repos/${repository}/contents/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}?ref=${encodeURIComponent(ref)}`;
  const response = await fetchImpl(url, {
    headers: apiHeaders(token),
    cache: "no-store",
  });

  if (optional && response.status === 404) return null;
  if (!response.ok) throw new Error(await githubError(response));

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

const deleteBranchBestEffort = async ({
  fetchImpl,
  repository,
  branch,
  token,
}: {
  fetchImpl: FetchLike;
  repository: string;
  branch: string;
  token: string;
}) => {
  try {
    await fetchImpl(
      `https://api.github.com/repos/${repository}/git/refs/heads/${branch
        .split("/")
        .map(encodeURIComponent)
        .join("/")}`,
      {
        method: "DELETE",
        headers: apiHeaders(token),
        cache: "no-store",
      },
    );
  } catch {
    // A failed cleanup must not hide the original pull-request error.
  }
};

export const createObservationPullRequest = async ({
  repository,
  installationId,
  connection,
  adapterId,
  systemVersionRef,
  fetchImpl = fetch,
  mintToken = async (
    id: number,
    permissions: Record<string, "read" | "write">,
  ) =>
    createGithubInstallationToken(
      id,
      getGithubAppConfig(),
      permissions,
    ),
}: {
  repository: string;
  installationId: number;
  connection: GithubConnection;
  adapterId: string;
  systemVersionRef: string;
  fetchImpl?: FetchLike;
  mintToken?: (
    installationId: number,
    permissions: Record<string, "read" | "write">,
  ) => Promise<string>;
}): Promise<ObservationPullRequestResult> => {
  const adapter = getObservationPatchAdapter(adapterId, repository);
  if (!adapter) {
    return {
      status: "blocked",
      code: "adapter_blocked",
      reason: "No exact repository patch adapter is available for this proposal.",
    };
  }

  const readToken = await mintToken(installationId, { contents: "read" });
  const repo = await json<GithubRepositoryMeta>(
    fetchImpl,
    `https://api.github.com/repos/${repository}`,
    readToken,
  );

  if (
    repo.full_name !== repository ||
    !githubConnectionAllowsRepository(connection, installationId, repo.id)
  ) {
    return {
      status: "blocked",
      code: "repository_not_allowed",
      reason: "This GitHub connection is not allowed to read that repository.",
    };
  }

  if (
    !githubConnectionAllowsWriteRepository(
      connection,
      installationId,
      repo.id,
    )
  ) {
    return {
      status: "blocked",
      code: "user_write_not_allowed",
      reason:
        "The authorising GitHub user did not have write access to this repository when the CRUX connection was created.",
    };
  }

  const branchRef = await json<GithubRef>(
    fetchImpl,
    `https://api.github.com/repos/${repository}/git/ref/heads/${repo.default_branch
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    readToken,
  );
  const baseSha = branchRef.object?.sha;
  if (!baseSha) throw new Error("GitHub did not return the default-branch commit SHA.");

  const fetched = await Promise.all(
    adapter.files.map((file) =>
      readRepositoryFile({
        fetchImpl,
        repository,
        path: file.path,
        ref: baseSha,
        token: readToken,
        ...(file.optional ? { optional: true } : {}),
      }),
    ),
  );

  const patch = adapter.generate({
    repository,
    systemVersionRef,
    files: fetched.filter(
      (file): file is RepositoryPatchFile => Boolean(file),
    ),
  });
  if (patch.status === "blocked") {
    return {
      status: "blocked",
      code: "adapter_blocked",
      reason: patch.reason,
    };
  }

  const existingBranch = await optionalJson<GithubRef>(
    fetchImpl,
    `https://api.github.com/repos/${repository}/git/ref/heads/${patch.branch_name
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
    readToken,
  );
  if (existingBranch.found) {
    const owner = repository.split("/")[0] ?? "";
    const pullsUrl = new URL(
      `https://api.github.com/repos/${repository}/pulls`,
    );
    pullsUrl.searchParams.set("state", "open");
    pullsUrl.searchParams.set("head", `${owner}:${patch.branch_name}`);
    let existingPull: GithubPull | undefined;
    try {
      const pullReadToken = await mintToken(installationId, {
        pull_requests: "read",
      });
      const pulls = await json<GithubPull[]>(
        fetchImpl,
        pullsUrl.toString(),
        pullReadToken,
      );
      existingPull = pulls.find(
        (pull) => Boolean(pull.number && pull.html_url),
      );
    } catch {
      // Existing branch still fails closed if the App cannot inspect PRs.
    }
    if (existingPull?.number && existingPull.html_url) {
      return {
        status: "existing_review",
        repository,
        branch: patch.branch_name,
        pull_request_number: existingPull.number,
        pull_request_url: existingPull.html_url,
      };
    }

    return {
      status: "blocked",
      code: "branch_exists",
      reason:
        `The review branch ${patch.branch_name} already exists. CRUX will not update or force-push it.`,
    };
  }

  let writeToken: string;
  try {
    writeToken = await mintToken(installationId, {
      contents: "write",
      pull_requests: "write",
    });
  } catch {
    return {
      status: "blocked",
      code: "app_write_permission_unavailable",
      reason:
        "The installed CRUX GitHub App does not currently have the write permissions required to create a review branch and pull request.",
    };
  }

  const baseCommit = await json<GithubCommit>(
    fetchImpl,
    `https://api.github.com/repos/${repository}/git/commits/${baseSha}`,
    writeToken,
  );
  const baseTreeSha = baseCommit.tree?.sha;
  if (!baseTreeSha) throw new Error("GitHub did not return the base tree SHA.");

  const blobShas = await Promise.all(
    patch.changes.map(async (change) => {
      const blob = await json<GithubBlob>(
        fetchImpl,
        `https://api.github.com/repos/${repository}/git/blobs`,
        writeToken,
        {
          method: "POST",
          body: JSON.stringify({
            content: change.content,
            encoding: "utf-8",
          }),
        },
      );
      if (!blob.sha) throw new Error(`GitHub did not create a blob for ${change.path}.`);
      return { change, sha: blob.sha };
    }),
  );

  const tree = await json<GithubTree>(
    fetchImpl,
    `https://api.github.com/repos/${repository}/git/trees`,
    writeToken,
    {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: blobShas.map(({ change, sha }) => ({
          path: change.path,
          mode: "100644",
          type: "blob",
          sha,
        })),
      }),
    },
  );
  if (!tree.sha) throw new Error("GitHub did not create the review tree.");

  const commit = await json<GithubCreatedCommit>(
    fetchImpl,
    `https://api.github.com/repos/${repository}/git/commits`,
    writeToken,
    {
      method: "POST",
      body: JSON.stringify({
        message: patch.commit_message,
        tree: tree.sha,
        parents: [baseSha],
      }),
    },
  );
  if (!commit.sha) throw new Error("GitHub did not create the review commit.");

  await json<Record<string, unknown>>(
    fetchImpl,
    `https://api.github.com/repos/${repository}/git/refs`,
    writeToken,
    {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${patch.branch_name}`,
        sha: commit.sha,
      }),
    },
  );

  try {
    const pull = await json<GithubPull>(
      fetchImpl,
      `https://api.github.com/repos/${repository}/pulls`,
      writeToken,
      {
        method: "POST",
        body: JSON.stringify({
          title: patch.title,
          head: patch.branch_name,
          base: repo.default_branch,
          body: patch.pull_request_body,
          draft: true,
        }),
      },
    );
    if (!pull.number || !pull.html_url) {
      throw new Error("GitHub created an incomplete pull-request response.");
    }

    return {
      status: "created",
      repository,
      base_branch: repo.default_branch,
      base_sha: baseSha,
      branch: patch.branch_name,
      commit_sha: commit.sha,
      pull_request_number: pull.number,
      pull_request_url: pull.html_url,
    };
  } catch (error) {
    await deleteBranchBestEffort({
      fetchImpl,
      repository,
      branch: patch.branch_name,
      token: writeToken,
    });
    throw error;
  }
};
