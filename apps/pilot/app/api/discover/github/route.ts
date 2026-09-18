import { discoverAIFromSourceSnapshot } from "@crux/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 80;
const MAX_FILE_CHARS = 60_000;
const MAX_TOTAL_CHARS = 2_000_000;

type RepoRef = { owner: string; repo: string };

const parseRepo = (value: string): RepoRef | null => {
  const trimmed = value.trim().replace(/\.git$/, "");
  const urlMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:[/?#].*)?$/i);
  if (urlMatch?.[1] && urlMatch[2]) return { owner: urlMatch[1], repo: urlMatch[2] };

  const shortMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch?.[1] && shortMatch[2]) return { owner: shortMatch[1], repo: shortMatch[2] };
  return null;
};

const githubHeaders = () => ({
  Accept: "application/vnd.github+json",
  "User-Agent": "crux-discovery-pilot",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

const sourcePath = (path: string) =>
  path === "package.json" ||
  (/\.(?:[cm]?[jt]sx?|json|ya?ml)$/i.test(path) &&
    !/(?:^|\/)(?:docs?|tests?|__tests__|fixtures?|coverage|dist|build|node_modules)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(path));

const priority = (path: string) => {
  if (path === "package.json") return 0;
  if (/\/app\/api\//i.test(path)) return 1;
  if (/\/jobs?\//i.test(path)) return 2;
  if (/\/providers?\//i.test(path)) return 3;
  if (/\/services?\//i.test(path)) return 4;
  if (/\/lib\//i.test(path)) return 5;
  return 10;
};

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    const message = response.status === 404
      ? "Repository or branch was not found, or the repository is not public."
      : `GitHub returned ${response.status} while CRUX was reading the repository.`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

const scanPublicRepo = async (repoRef: RepoRef) => {
  const repoUrl = `https://api.github.com/repos/${encodeURIComponent(repoRef.owner)}/${encodeURIComponent(repoRef.repo)}`;
  const repo = await fetchJson<{ default_branch: string; html_url: string; full_name: string }>(repoUrl);
  const branch = repo.default_branch;
  const tree = await fetchJson<{
    truncated?: boolean;
    tree: Array<{ path?: string; type?: string; size?: number }>;
  }>(`${repoUrl}/git/trees/${encodeURIComponent(branch)}?recursive=1`);

  const paths = tree.tree
    .filter((item) => item.type === "blob" && item.path && sourcePath(item.path))
    .filter((item) => !item.size || item.size <= MAX_FILE_CHARS * 4)
    .map((item) => item.path!)
    .sort((left, right) => priority(left) - priority(right) || left.localeCompare(right))
    .slice(0, MAX_FILES);

  const fetched = await Promise.all(
    paths.map(async (path) => {
      const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(repoRef.owner)}/${encodeURIComponent(repoRef.repo)}/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
      const response = await fetch(rawUrl, { cache: "no-store" });
      if (!response.ok) return null;
      return { path, content: (await response.text()).slice(0, MAX_FILE_CHARS) };
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
    provider: "github-probe",
    label: `${repo.full_name}#${branch}`,
    externalRef: repo.html_url,
    files,
  });

  return {
    ok: true,
    report,
    scan: {
      repository: repo.full_name,
      branch,
      tree_truncated: Boolean(tree.truncated),
      files_considered: paths.length,
      files_read: files.length,
      content_chars_read: totalChars,
      mode: "bounded-public-github",
    },
  };
};

const respond = async (value: string) => {
  const repoRef = parseRepo(value);
  if (!repoRef) {
    return Response.json({
      ok: false,
      code: "invalid_repository",
      message: "Use a public GitHub URL or owner/repository name.",
    }, { status: 400 });
  }

  try {
    const result = await scanPublicRepo(repoRef);
    return Response.json(result);
  } catch (error) {
    return Response.json({
      ok: false,
      code: "github_discovery_failed",
      message: error instanceof Error ? error.message : "CRUX could not scan this repository.",
    }, { status: 502 });
  }
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  return respond(url.searchParams.get("repo") ?? "");
}

export async function POST(request: Request) {
  let body: { repo?: string };
  try {
    body = (await request.json()) as { repo?: string };
  } catch {
    return Response.json({ ok: false, code: "invalid_json" }, { status: 400 });
  }
  return respond(body.repo ?? "");
}
