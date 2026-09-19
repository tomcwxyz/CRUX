import { cookies } from "next/headers";
import { discoverAIFromSourceSnapshot } from "@crux/core";
import {
  GITHUB_API_VERSION,
  GITHUB_CONNECTION_COOKIE,
  createGithubInstallationToken,
  decodeGithubConnection,
  getGithubAppConfig,
  githubAppConfigured,
} from "../../../../lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 80;
const MAX_FILE_CHARS = 60_000;
const MAX_TOTAL_CHARS = 2_000_000;

type RepoRef = { owner: string; repo: string };
type TreeEntry = { path: string; sha: string; size?: number };

const parseRepo = (value: string): RepoRef | null => {
  const trimmed = value.trim().replace(/\.git$/, "");
  const urlMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:[/?#].*)?$/i);
  if (urlMatch?.[1] && urlMatch[2]) return { owner: urlMatch[1], repo: urlMatch[2] };

  const shortMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch?.[1] && shortMatch[2]) return { owner: shortMatch[1], repo: shortMatch[2] };
  return null;
};

const githubHeaders = (token?: string) => ({
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": GITHUB_API_VERSION,
  "User-Agent": "crux-discovery-pilot",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const sourcePath = (path: string) =>
  path === "package.json" ||
  /(?:^|\/)(?:pyproject\.toml|requirements(?:-[^/]+)?\.txt)$/i.test(path) ||
  (/\.(?:[cm]?[jt]sx?|py|json|ya?ml)$/i.test(path) &&
    !/(?:^|\/)(?:docs?|tests?|__tests__|fixtures?|coverage|dist|build|node_modules)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(?:test_[^/]+|[^/]+_test)\.py$/i.test(path));

const priority = (path: string) => {
  if (path === "package.json") return 0;
  if (/\/app\/api\//i.test(path)) return 1;
  if (/(?:^|\/)(?:ask|chat|agent|extract|extraction|search)(?:\/|$)/i.test(path)) return 1;
  if (/\/jobs?\//i.test(path)) return 2;
  if (/\/providers?\//i.test(path)) return 3;
  if (/\/services?\//i.test(path)) return 4;
  if (/\/lib\//i.test(path)) return 5;
  return 10;
};

const mapWithConcurrency = async <Input, Output>(
  values: Input[],
  limit: number,
  worker: (value: Input) => Promise<Output>,
): Promise<Output[]> => {
  const output: Output[] = new Array(values.length);
  let nextIndex = 0;

  const run = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await worker(values[index]!);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => run()),
  );
  return output;
};

const fetchJson = async <T>(url: string, token?: string): Promise<T> => {
  const response = await fetch(url, {
    headers: githubHeaders(token),
    cache: "no-store",
  });
  if (!response.ok) {
    const message = response.status === 404
      ? "Repository or branch was not found, or this GitHub connection cannot access it."
      : `GitHub returned ${response.status} while CRUX was reading the repository.`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

const installationContextFor = async (installationId?: number) => {
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
  const installation = connection?.installations.find((item) => item.id === installationId);
  if (!installation) {
    throw new Error("This browser session is not connected to that GitHub installation.");
  }

  return {
    token: await createGithubInstallationToken(
      installationId,
      config,
      { contents: "read" },
    ),
    repositoryIds: new Set(installation.repository_ids),
  };
};

const fetchSourceFile = async ({
  repoRef,
  repoUrl,
  branch,
  entry,
  token,
}: {
  repoRef: RepoRef;
  repoUrl: string;
  branch: string;
  entry: TreeEntry;
  token?: string;
}) => {
  if (token) {
    const blob = await fetchJson<{ content?: string; encoding?: string }>(
      `${repoUrl}/git/blobs/${encodeURIComponent(entry.sha)}`,
      token,
    );
    if (!blob.content || blob.encoding !== "base64") return null;
    return {
      path: entry.path,
      content: Buffer.from(blob.content.replace(/\n/g, ""), "base64")
        .toString("utf8")
        .slice(0, MAX_FILE_CHARS),
    };
  }

  const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(repoRef.owner)}/${encodeURIComponent(repoRef.repo)}/${encodeURIComponent(branch)}/${entry.path.split("/").map(encodeURIComponent).join("/")}`;
  const response = await fetch(rawUrl, { cache: "no-store" });
  if (!response.ok) return null;
  return { path: entry.path, content: (await response.text()).slice(0, MAX_FILE_CHARS) };
};

const scanRepo = async (repoRef: RepoRef, installationId?: number) => {
  const installation = await installationContextFor(installationId);
  const token = installation?.token;
  const repoUrl = `https://api.github.com/repos/${encodeURIComponent(repoRef.owner)}/${encodeURIComponent(repoRef.repo)}`;
  const repo = await fetchJson<{
    id: number;
    default_branch: string;
    html_url: string;
    full_name: string;
    private: boolean;
  }>(repoUrl, token);

  if (installation && !installation.repositoryIds.has(repo.id)) {
    throw new Error("This GitHub user connection is not allowed to read that repository.");
  }
  const branch = repo.default_branch;
  const tree = await fetchJson<{
    truncated?: boolean;
    tree: Array<{ path?: string; type?: string; size?: number; sha?: string }>;
  }>(`${repoUrl}/git/trees/${encodeURIComponent(branch)}?recursive=1`, token);

  const entries: TreeEntry[] = tree.tree
    .filter((item): item is { path: string; type: string; size?: number; sha: string } =>
      item.type === "blob" && Boolean(item.path && item.sha) && sourcePath(item.path!),
    )
    .filter((item) => !item.size || item.size <= MAX_FILE_CHARS * 4)
    .map((item) => ({ path: item.path, sha: item.sha, ...(item.size ? { size: item.size } : {}) }))
    .sort((left, right) => priority(left.path) - priority(right.path) || left.path.localeCompare(right.path))
    .slice(0, MAX_FILES);

  const fetched = await mapWithConcurrency(
    entries,
    token ? 10 : 24,
    (entry) => fetchSourceFile({
      repoRef,
      repoUrl,
      branch,
      entry,
      ...(token ? { token } : {}),
    }),
  );

  let totalChars = 0;
  const files: Array<{ path: string; content: string }> = [];
  for (const file of fetched) {
    if (!file || totalChars >= MAX_TOTAL_CHARS) continue;
    const remaining = MAX_TOTAL_CHARS - totalChars;
    const content = file.content.slice(0, remaining);
    totalChars += content.length;
    files.push({ path: file.path, content });
  }

  const report = discoverAIFromSourceSnapshot({
    provider: installationId ? "github-app" : "github-probe",
    label: `${repo.full_name}#${branch}`,
    externalRef: repo.html_url,
    files,
  });

  return {
    ok: true,
    report,
    scan: {
      repository: repo.full_name,
      private: repo.private,
      branch,
      tree_truncated: Boolean(tree.truncated),
      files_considered: entries.length,
      files_read: files.length,
      content_chars_read: totalChars,
      mode: installationId ? "github-app" : "bounded-public-github",
    },
  };
};

const respond = async (value: string, installationId?: number) => {
  const repoRef = parseRepo(value);
  if (!repoRef) {
    return Response.json({
      ok: false,
      code: "invalid_repository",
      message: "Use a GitHub repository in owner/repository form.",
    }, { status: 400 });
  }

  try {
    const result = await scanRepo(repoRef, installationId);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "CRUX could not scan this repository.";
    const status = /not connected|not configured/i.test(message) ? 401 : 502;
    return Response.json({
      ok: false,
      code: "github_discovery_failed",
      message,
    }, { status });
  }
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const installationValue = url.searchParams.get("installation_id");
  const installationId = installationValue ? Number(installationValue) : undefined;
  return respond(
    url.searchParams.get("repo") ?? "",
    Number.isSafeInteger(installationId) && (installationId ?? 0) > 0 ? installationId : undefined,
  );
}

export async function POST(request: Request) {
  let body: { repo?: string; installation_id?: number };
  try {
    body = (await request.json()) as { repo?: string; installation_id?: number };
  } catch {
    return Response.json({ ok: false, code: "invalid_json" }, { status: 400 });
  }
  return respond(
    body.repo ?? "",
    Number.isSafeInteger(body.installation_id) && (body.installation_id ?? 0) > 0
      ? body.installation_id
      : undefined,
  );
}
