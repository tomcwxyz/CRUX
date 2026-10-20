import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { discoverAIFromSourceSnapshot } from "@crux/core";

const ignored = new Set([
  ".git", ".svn", ".hg", "node_modules", "dist", "build", "coverage",
  ".next", ".turbo", ".venv", "venv", "target", "__pycache__",
  "test", "tests", "__tests__", "docs", "doc", "fixtures", "fixture",
]);
const matches = (path: string): boolean =>
  /(?:^|\/)(?:package\.json|pyproject\.toml|requirements(?:-[^/]+)?\.txt)$/i.test(path) ||
  /\.(?:[cm]?[jt]sx?|py|json|ya?ml)$/i.test(path);

const MAX_FILES = 80;
const MAX_TOTAL_CHARS = 2_000_000;
const MAX_FILE_BYTES = 240_000;
const MAX_ENTRIES = 4_000;
const MAX_DEPTH = 12;

export async function discoverLocalSource(directory: string, provider = "local-checkout") {
  const root = resolve(directory);
  const rootStats = await stat(root);
  if (!rootStats.isDirectory()) throw new Error("discover-source requires a directory.");
  const queue: Array<{ directory: string; depth: number }> = [{ directory: root, depth: 0 }];
  const candidates: Array<{ file: string; path: string; size: number }> = [];
  let seen = 0;
  let truncated = false;

  while (queue.length > 0 && seen < MAX_ENTRIES) {
    const next = queue.shift()!;
    const entries = (await readdir(next.directory, { withFileTypes: true }))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (++seen > MAX_ENTRIES) { truncated = true; break; }
      if (entry.isSymbolicLink()) continue;
      const absolute = join(next.directory, entry.name);
      const path = relative(root, absolute).replaceAll("\\", "/");
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name.toLowerCase()) && !entry.name.startsWith(".") && next.depth < MAX_DEPTH) {
          queue.push({ directory: absolute, depth: next.depth + 1 });
        } else if (next.depth >= MAX_DEPTH) truncated = true;
      } else if (entry.isFile() && matches(path) &&
        !/\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(?:test_[^/]+|[^/]+_test)\.py$/i.test(path)) {
        const size = (await stat(absolute)).size;
        if (size <= MAX_FILE_BYTES) candidates.push({ file: absolute, path, size });
      }
    }
  }
  if (queue.length > 0 || seen >= MAX_ENTRIES) truncated = true;

  const priority = (path: string) =>
    /(?:^|\/)package\.json$/.test(path) ? 0 :
    /(?:^|\/)(?:app\/api|ask|chat|agent|extract)(?:\/|$)/i.test(path) ? 1 :
    /(?:^|\/)(?:jobs?|providers?|services?)(?:\/|$)/i.test(path) ? 2 : 10;

  candidates.sort((a, b) => priority(a.path) - priority(b.path) ||
    a.path.localeCompare(b.path));
  if (candidates.length > MAX_FILES) truncated = true;
  let total = 0;
  const files: Array<{ path: string; content: string }> = [];
  for (const item of candidates.slice(0, MAX_FILES)) {
    if (total >= MAX_TOTAL_CHARS) { truncated = true; break; }
    const content = (await readFile(item.file, "utf8")).slice(0, Math.min(60_000, MAX_TOTAL_CHARS - total));
    total += content.length;
    files.push({ path: item.path, content });
  }
  const report = discoverAIFromSourceSnapshot({
    provider, label: root, files,
  });
  report.limitations[0] =
    "Bounded read-only scan of local source/config files. This command does not upload the source code.";
  if (truncated) report.limitations.push(
    "The directory tree or selected source files exceeded the scanner's safety limits.",
  );
  return {
    report,
    scan: {
      root,
      files_considered: Math.min(candidates.length, MAX_FILES),
      files_read: files.length,
      content_chars_read: total,
      tree_truncated: truncated,
    },
  };
}
