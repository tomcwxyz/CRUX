import { describe, expect, it, vi } from "vitest";
import { parsePublicGitRef, scanPublicGit } from "../lib/public-git-discovery";

const payload = (value: unknown, headers?: Record<string, string>) =>
  new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json", ...headers } });
const text = (value: string) =>
  new Response(value, { status: 200, headers: { "content-type": "text/plain" } });

describe("public Git repository URL parsing", () => {
  it("recognises Framagit as GitLab, including nested groups", () => {
    const result = parsePublicGitRef("https://framagit.org/example/subgroup/my-project.git");
    expect(result).toMatchObject({
      forge: "gitlab",
      host: "framagit.org",
      project: "example/subgroup/my-project",
    });
  });
  it("recognises GitLab, Codeberg, Gitea and Bitbucket", () => {
    expect(parsePublicGitRef("https://gitlab.com/group/project")?.forge).toBe("gitlab");
    expect(parsePublicGitRef("https://codeberg.org/group/project")?.forge).toBe("forgejo");
    expect(parsePublicGitRef("https://gitea.com/group/project")?.forge).toBe("forgejo");
    expect(parsePublicGitRef("https://bitbucket.org/team/project")?.forge).toBe("bitbucket");
  });
  it("permits only explicitly configured self-hosted forges", () => {
    expect(parsePublicGitRef("https://git.example.org/team/app")).toBeNull();
    expect(parsePublicGitRef("https://git.example.org/team/app", "gitlab:git.example.org")?.forge).toBe("gitlab");
  });
  it.each([
    "http://framagit.org/example/project",
    "https://framagit.org.evil.test/owner/repo",
    "https://localhost/owner/repo",
    "https://framagit.org@127.0.0.1/owner/repo",
    "https://user:secret@framagit.org/owner/repo",
    "https://framagit.org:8443/owner/repo",
    "https://framagit.org/owner/repo?url=https://localhost/",
    "https://framagit.org/owner/../other",
    "https://framagit.org/one",
  ])("rejects unsafe or unsupported URL %s", (value) => {
    expect(parsePublicGitRef(value)).toBeNull();
  });
});

describe("bounded public source adapters", () => {
  it("scans a Framagit repository via the GitLab API and honours paging", async () => {
    const fetcher = vi.fn(async (target: string | URL | Request) => {
      const url = String(target);
      if (url.includes("/projects/example%2Ftest")) return payload({
        id: 33, path_with_namespace: "example/test", web_url: "https://framagit.org/example/test",
        default_branch: "main", visibility: "public",
      });
      if (url.includes("/projects/33/repository/tree") && !url.includes("page_token=")) {
        return payload([{ path: "package.json", type: "blob" }], {
          link: '<https://framagit.org/api/v4/projects/33/repository/tree?pagination=keyset&page_token=next>; rel="next"',
        });
      }
      if (url.includes("page_token=next")) return payload([
        { path: "src/app/api/chat/route.ts", type: "blob" },
        { path: "docs/secret.ts", type: "blob" },
      ]);
      if (url.includes("package.json/raw")) return text('{"dependencies":{"ai":"^7"}}');
      if (url.includes("route.ts/raw")) return text("export const POST = () => streamText({ model, prompt });");
      throw new Error("unexpected URL: " + url);
    }) as unknown as typeof fetch;
    const ref = parsePublicGitRef("https://framagit.org/example/test")!;
    const outcome = await scanPublicGit(ref, fetcher);
    expect(outcome.scan.mode).toBe("bounded-public-gitlab");
    expect(outcome.scan.files_read).toBe(2);
    expect(outcome.report.source.provider).toBe("gitlab-public");
    expect(outcome.report.signals.some((signal) => signal.kind === "model_call")).toBe(true);
    expect(outcome.report.signals.every((signal) => signal.evidence.every((item) => !item.path?.includes("docs")))).toBe(true);
  });

  it("scans Codeberg using Forgejo's tree and contents API", async () => {
    const fetcher = vi.fn(async (target: string | URL | Request) => {
      const url = String(target);
      if (url.endsWith("/api/v1/repos/team/tool")) return payload({
        full_name: "team/tool", html_url: "https://codeberg.org/team/tool",
        default_branch: "main", private: false,
      });
      if (url.includes("/git/trees/")) return payload({
        tree: [{ path: "src/ask/orchestrator.py", type: "blob" }], truncated: false,
      });
      if (url.includes("/contents/")) return payload({
        encoding: "base64",
        content: Buffer.from("from anthropic import Anthropic\nclient.messages.create(model='example', messages=[])").toString("base64"),
      });
      throw new Error("unexpected URL: " + url);
    }) as unknown as typeof fetch;
    const result = await scanPublicGit(parsePublicGitRef("https://codeberg.org/team/tool")!, fetcher);
    expect(result.scan.files_read).toBe(1);
    expect(result.report.source.provider).toBe("forgejo-public");
    expect(result.report.signals.some((signal) => signal.kind === "model_call")).toBe(true);
  });

  it("scans Bitbucket's paginated source listing and raw files", async () => {
    const fetcher = vi.fn(async (target: string | URL | Request) => {
      const url = String(target);
      if (url.endsWith("/2.0/repositories/team/tool")) return payload({
        full_name: "team/tool", is_private: false, mainbranch: { name: "main" },
        links: { html: { href: "https://bitbucket.org/team/tool" } },
      });
      if (url.includes("max_depth=")) return payload({
        values: [{ type: "commit_file", path: "src/ask/orchestrator.py", size: 200 }],
      });
      if (url.includes("/src/main/")) return text("from anthropic import Anthropic\nclient.messages.create(model='example', messages=[])");
      throw new Error("unexpected URL: " + url);
    }) as unknown as typeof fetch;
    const outcome = await scanPublicGit(parsePublicGitRef("https://bitbucket.org/team/tool")!, fetcher);
    expect(outcome.scan.files_read).toBe(1);
    expect(outcome.report.source.provider).toBe("bitbucket-public");
  });

  it("rejects private repositories without trying to read their files", async () => {
    const fetcher = vi.fn(async () => payload({
      id: 33, path_with_namespace: "example/private", web_url: "https://framagit.org/example/private",
      default_branch: "main", visibility: "private",
    })) as unknown as typeof fetch;
    await expect(scanPublicGit(parsePublicGitRef("https://framagit.org/example/private")!, fetcher))
      .rejects.toThrow("not public");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
