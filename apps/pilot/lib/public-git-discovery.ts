import { discoverAIFromSourceSnapshot } from "@crux/core";

// Public, unauthenticated discovery. Do not accept arbitrary fetch targets: a user
// supplied repository URL must match a supported/explicitly configured forge.
export type PublicForge = "gitlab" | "forgejo" | "bitbucket";
export type PublicGitRef = {
  forge: PublicForge;
  host: string;
  path: string;
  project: string;
  url: string;
};

export type PublicGitScan = {
  ok: true;
  report: ReturnType<typeof discoverAIFromSourceSnapshot>;
  scan: {
    repository: string;
    private: false;
    branch: string;
    tree_truncated: boolean;
    files_considered: number;
    files_read: number;
    content_chars_read: number;
    mode: string;
  };
};

type GitTreeFile = { path: string; size?: number };
type GitTree = { files: GitTreeFile[]; truncated: boolean };
type GitRepo = {
  project: string;
  branch: string;
  webUrl: string;
  apiBase: string;
  projectId?: number;
};

const MAX_FILES = 80;
const MAX_TREE_ITEMS = 1_000;
const MAX_PAGES = 10;
const MAX_FILE_CHARS = 60_000;
const MAX_TOTAL_CHARS = 2_000_000;
const MAX_JSON_BYTES = 2_500_000;
const MAX_TEXT_BYTES = 180_000;

const defaultHosts: Record<string, PublicForge> = {
  "gitlab.com": "gitlab",
  "framagit.org": "gitlab",
  "codeberg.org": "forgejo",
  "gitea.com": "forgejo",
  "bitbucket.org": "bitbucket",
};

const configuredHosts = (raw: string): Record<string, PublicForge> => {
  const hosts: Record<string, PublicForge> = { ...defaultHosts };
  for (const entry of raw.split(",")) {
    const [forge, host, extra] = entry.trim().split(":");
    if (!forge && !host) continue;
    if (
      extra !== undefined ||
      (forge !== "gitlab" && forge !== "forgejo") ||
      !host ||
      !/^(?=.{1,253}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(host) ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      throw new Error("CRUX_PUBLIC_GIT_INSTANCES must contain comma-separated gitlab:host or forgejo:host entries.");
    }
    if (defaultHosts[host] && defaultHosts[host] !== forge) {
      throw new Error("A built-in public forge cannot be remapped.");
    }
    hosts[host.toLowerCase()] = forge;
  }
  return hosts;
};

export const parsePublicGitRef = (
  value: string,
  configured = "",
): PublicGitRef | null => {
  let url: URL;
  try { url = new URL(value.trim()); } catch { return null; }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) return null;

  const host = url.hostname.toLowerCase();
  const forge = configuredHosts(configured)[host];
  if (!forge) return null;
  let segments: string[];
  try {
    const raw = url.pathname.split("/").filter(Boolean);
    const end = raw.indexOf("-");
    const relevant = end > 0 && raw[end + 1] ? raw.slice(0, end) : raw;
    segments = relevant.map((part) => decodeURIComponent(part));
  } catch { return null; }
  if (
    segments.length < 2 ||
    (forge !== "gitlab" && segments.length !== 2) ||
    !segments.every((part) => /^[a-z0-9][a-z0-9._-]*$/i.test(part) && part !== "..")
  ) return null;
  const last = segments.length - 1;
  segments[last] = segments[last]!.replace(/\.git$/i, "");
  if (!segments[last] || segments[last] === ".") return null;
  const project = segments.join("/");
  return {
    forge, host, project, path: project,
    url: "https://" + host + "/" + segments.map(encodeURIComponent).join("/"),
  };
};

const isSource = (path: string): boolean =>
  (path === "package.json" ||
    /(?:^|\/)(?:package\.json|pyproject\.toml|requirements(?:-[^/]+)?\.txt)$/i.test(path) ||
    /\.(?:[cm]?[jt]sx?|py|json|ya?ml)$/i.test(path)) &&
  !/(?:^|\/)(?:docs?|tests?|__tests__|fixtures?|coverage|dist|build|node_modules)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(?:test_[^/]+|[^/]+_test)\.py$/i.test(path);

const priority = (path: string): number => {
  if (/(?:^|\/)(?:package\.json|pyproject\.toml|requirements\.txt)$/.test(path)) return 0;
  if (/\/app\/api\/|(?:^|\/)(?:ask|chat|agent|extract|search)(?:\/|$)/i.test(path)) return 1;
  if (/\/jobs?\//i.test(path)) return 2;
  if (/\/providers?\//i.test(path)) return 3;
  if (/\/services?\//i.test(path)) return 4;
  if (/\/lib\//i.test(path)) return 5;
  return 10;
};

const fileEntries = (tree: GitTree): GitTreeFile[] =>
  tree.files
    .filter((item) => isSource(item.path) && (!item.size || item.size <= MAX_FILE_CHARS * 4))
    .sort((a, b) => priority(a.path) - priority(b.path) || a.path.localeCompare(b.path))
    .slice(0, MAX_FILES);

const encodedPath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

const boundedBody = async (response: Response, limit: number): Promise<string> => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The forge returned an empty response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("The forge returned an unexpectedly large response.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const read = async (url: string, limit: number, fetcher: typeof fetch): Promise<{
  body: string;
  headers: Headers;
}> => {
  const response = await fetcher(url, {
    method: "GET",
    headers: { Accept: "application/json, text/plain", "User-Agent": "crux-public-discovery" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error("This public repository could not be read. Private repositories need an authorised connection.");
    }
    throw new Error("The repository provider returned HTTP " + response.status + ".");
  }
  return { body: await boundedBody(response, limit), headers: response.headers };
};

const json = async <T>(url: string, fetcher: typeof fetch): Promise<{
  value: T;
  headers: Headers;
}> => {
  const result = await read(url, MAX_JSON_BYTES, fetcher);
  return { value: JSON.parse(result.body) as T, headers: result.headers };
};

const safeNextPage = (current: string, headers: Headers): string | null => {
  const match = headers.get("link")?.match(/<([^>]+)>\s*;\s*rel=["']?next["']?/i);
  if (!match?.[1]) return null;
  const next = new URL(match[1], current);
  const previous = new URL(current);
  if (
    next.protocol !== "https:" ||
    next.host !== previous.host ||
    next.pathname !== previous.pathname ||
    next.username ||
    next.password
  ) throw new Error("The forge returned an invalid pagination link.");
  return next.toString();
};

async function gitlab(ref: PublicGitRef, fetcher: typeof fetch): Promise<{
  repo: GitRepo;
  tree: GitTree;
  file: (path: string) => Promise<string | null>;
}> {
  const api = "https://" + ref.host + "/api/v4/projects/";
  const metadata = (await json<{
    id: number;
    path_with_namespace: string;
    web_url: string;
    default_branch: string | null;
    visibility: string;
  }>(api + encodeURIComponent(ref.project), fetcher)).value;
  if (metadata.visibility !== "public" || !metadata.default_branch) {
    throw new Error("This GitLab repository is not public or has no default branch.");
  }
  const base = api + encodeURIComponent(String(metadata.id));
  const branch = metadata.default_branch;
  const start = base + "/repository/tree?recursive=true&per_page=100&pagination=keyset&ref=" + encodeURIComponent(branch);
  let current: string | null = start;
  const files: GitTreeFile[] = [];
  let pages = 0;
  while (current && pages < MAX_PAGES && files.length < MAX_TREE_ITEMS) {
    const result: { value: Array<{ type: string; path: string; size?: number }>; headers: Headers } =
      await json<Array<{ type: string; path: string; size?: number }>>(current, fetcher);
    pages++;
    for (const entry of result.value) {
      if (entry.type === "blob" && files.length < MAX_TREE_ITEMS) {
        files.push({ path: entry.path, ...(entry.size ? { size: entry.size } : {}) });
      }
    }
    current = safeNextPage(current, result.headers);
  }
  return {
    repo: { project: metadata.path_with_namespace, branch, webUrl: metadata.web_url, apiBase: base, projectId: metadata.id },
    tree: { files, truncated: Boolean(current) },
    file: async (path: string) => {
      const url = base + "/repository/files/" + encodeURIComponent(path) + "/raw?ref=" + encodeURIComponent(branch);
      try { return (await read(url, MAX_TEXT_BYTES, fetcher)).body.slice(0, MAX_FILE_CHARS); }
      catch { return null; }
    },
  };
}

async function forgejo(ref: PublicGitRef, fetcher: typeof fetch): Promise<{
  repo: GitRepo;
  tree: GitTree;
  file: (path: string) => Promise<string | null>;
}> {
  const base = "https://" + ref.host + "/api/v1/repos/" + encodedPath(ref.path);
  const repo = (await json<{
    full_name: string; html_url: string; default_branch: string; private: boolean;
  }>(base, fetcher)).value;
  if (repo.private || !repo.default_branch) {
    throw new Error("This repository is not public or has no default branch.");
  }
  const files: GitTreeFile[] = [];
  let page = 1;
  let truncated = true;
  while (truncated && page <= MAX_PAGES && files.length < MAX_TREE_ITEMS) {
    const url = base + "/git/trees/" + encodeURIComponent(repo.default_branch) +
      "?recursive=true&per_page=100&page=" + page;
    const result = (await json<{
      tree: Array<{ path: string; type: string; size?: number }>;
      truncated: boolean;
    }>(url, fetcher)).value;
    for (const entry of result.tree) {
      if (entry.type === "blob" && files.length < MAX_TREE_ITEMS) {
        files.push({ path: entry.path, ...(entry.size ? { size: entry.size } : {}) });
      }
    }
    truncated = Boolean(result.truncated);
    page++;
  }
  return {
    repo: { project: repo.full_name, branch: repo.default_branch, webUrl: repo.html_url, apiBase: base },
    tree: { files, truncated },
    file: async (path: string) => {
      const url = base + "/contents/" + encodedPath(path) + "?ref=" + encodeURIComponent(repo.default_branch);
      try {
        const result = (await json<{ encoding?: string; content?: string }>(url, fetcher)).value;
        if (result.encoding !== "base64" || !result.content) return null;
        return Buffer.from(result.content.replace(/\n/g, ""), "base64").toString("utf8").slice(0, MAX_FILE_CHARS);
      } catch { return null; }
    },
  };
}

async function bitbucket(ref: PublicGitRef, fetcher: typeof fetch): Promise<{
  repo: GitRepo;
  tree: GitTree;
  file: (path: string) => Promise<string | null>;
}> {
  const base = "https://api.bitbucket.org/2.0/repositories/" + encodedPath(ref.path);
  const metadata = (await json<{
    full_name: string; is_private: boolean; links?: { html?: { href: string } };
    mainbranch?: { name: string };
  }>(base, fetcher)).value;
  if (metadata.is_private || !metadata.mainbranch?.name) {
    throw new Error("This repository is not public or has no default branch.");
  }
  const branch = metadata.mainbranch.name;
  const sourceBase = base + "/src/" + encodeURIComponent(branch) + "/";
  let current: string | null = sourceBase + "?max_depth=8&pagelen=100";
  let pages = 0;
  const files: GitTreeFile[] = [];
  while (current && pages < MAX_PAGES && files.length < MAX_TREE_ITEMS) {
    const result: { value: { values: Array<{ path: string; type: string; size?: number }>; next?: string } } =
      await json<{ values: Array<{ path: string; type: string; size?: number }>; next?: string }>(current, fetcher);
    pages++;
    for (const entry of result.value.values) {
      if (entry.type === "commit_file" && files.length < MAX_TREE_ITEMS) {
        files.push({ path: entry.path, ...(entry.size ? { size: entry.size } : {}) });
      }
    }
    const next: string | null = result.value.next ?? null;
    if (next) {
      const nextUrl = new URL(next);
      if (nextUrl.protocol !== "https:" || nextUrl.host !== "api.bitbucket.org" ||
          nextUrl.pathname !== new URL(sourceBase).pathname || nextUrl.username || nextUrl.password) {
        throw new Error("Bitbucket returned an invalid pagination link.");
      }
    }
    current = next;
  }
  return {
    repo: { project: metadata.full_name, branch, webUrl: metadata.links?.html?.href ?? ref.url, apiBase: base },
    tree: { files, truncated: Boolean(current) },
    file: async (path: string) => {
      try {
        return (await read(sourceBase + encodedPath(path), MAX_TEXT_BYTES, fetcher)).body.slice(0, MAX_FILE_CHARS);
      } catch { return null; }
    },
  };
}

export const scanPublicGit = async (
  ref: PublicGitRef,
  fetcher: typeof fetch = fetch,
): Promise<PublicGitScan> => {
  const acquired = ref.forge === "gitlab"
    ? await gitlab(ref, fetcher)
    : ref.forge === "forgejo"
      ? await forgejo(ref, fetcher)
      : await bitbucket(ref, fetcher);
  const entries = fileEntries(acquired.tree);
  const results: Array<{ path: string; content: string } | null> = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(8, entries.length) }, async () => {
    while (next < entries.length) {
      const index = next++;
      const entry = entries[index]!;
      const content = await acquired.file(entry.path);
      results[index] = content === null ? null : { path: entry.path, content };
    }
  });
  await Promise.all(workers);
  const files: Array<{ path: string; content: string }> = [];
  let total = 0;
  for (const result of results) {
    if (!result || total >= MAX_TOTAL_CHARS) continue;
    const content = result.content.slice(0, MAX_TOTAL_CHARS - total);
    total += content.length;
    files.push({ path: result.path, content });
  }
  const label = acquired.repo.project + "#" + acquired.repo.branch;
  const report = discoverAIFromSourceSnapshot({
    provider: ref.forge + "-public",
    label,
    externalRef: acquired.repo.webUrl,
    files,
  });
  report.limitations[0] =
    "This hosted probe reads a bounded subset of public source/config files; it does not inspect deployed runtime behaviour.";
  if (acquired.tree.truncated) {
    report.limitations.push("The repository tree was truncated by the provider or CRUX safety limits.");
  }
  return {
    ok: true,
    report,
    scan: {
      repository: acquired.repo.project,
      private: false,
      branch: acquired.repo.branch,
      tree_truncated: acquired.tree.truncated,
      files_considered: entries.length,
      files_read: files.length,
      content_chars_read: total,
      mode: "bounded-public-" + ref.forge,
    },
  };
};
