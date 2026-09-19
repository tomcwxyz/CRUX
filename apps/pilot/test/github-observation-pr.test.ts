import { describe, expect, it, vi } from "vitest";
import type { GithubConnection } from "../lib/github-app";
import { createObservationPullRequest } from "../lib/github-observation-pr";

const extractSource = `import type { RepoContext } from '@/lib/repositories/types';

async function run(ctx: any) {
    const metadata: SourceMetadataOutput = pass1Result.value;
    const recs: RecommendationInput[] = pass2Result.value.recommendations;

    return { metadata, recs };
}
`;

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

const connection = (write = true): GithubConnection => ({
  version: 1,
  installations: [
    {
      id: 12,
      repository_ids: [101],
      write_repository_ids: write ? [101] : [],
    },
  ],
  expires_at: Date.now() + 60_000,
});

const repositoryFiles = (url: string) => {
  if (url.includes("src/lib/jobs/handlers/extract.ts")) {
    return jsonResponse({
      sha: "extract-sha",
      encoding: "base64",
      content: Buffer.from(extractSource).toString("base64"),
    });
  }
  if (url.includes(".env.example")) {
    return jsonResponse({
      sha: "env-sha",
      encoding: "base64",
      content: Buffer.from("APP_MODE=local\n").toString("base64"),
    });
  }
  if (
    url.includes("src/lib/crux/observe.ts") ||
    url.includes("src/lib/crux/observe.test.ts")
  ) {
    return jsonResponse({ message: "Not Found" }, 404);
  }
  return null;
};

describe("GitHub observation pull request transaction", () => {
  it("blocks before write-token minting when the authorising user lacks write access", async () => {
    const mintToken = vi.fn(async () => "read-token");
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/repos/tomcwxyz/open-recs-local")) {
        return jsonResponse({
          id: 101,
          full_name: "tomcwxyz/open-recs-local",
          default_branch: "master",
          html_url: "https://github.com/tomcwxyz/open-recs-local",
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const result = await createObservationPullRequest({
      repository: "tomcwxyz/open-recs-local",
      installationId: 12,
      connection: connection(false),
      adapterId: "open-recs-source-extract",
      systemVersionRef: "system-version:open-recs:0.1",
      fetchImpl,
      mintToken,
    });

    expect(result).toMatchObject({
      status: "blocked",
      code: "user_write_not_allowed",
    });
    expect(mintToken).toHaveBeenCalledTimes(1);
    expect(mintToken).toHaveBeenCalledWith(12, { contents: "read" });
  });

  it("fails closed if the App cannot mint the explicit write-capability token", async () => {
    const mintToken = vi.fn(
      async (
        _installationId: number,
        permissions: Record<string, "read" | "write">,
      ) => {
        if (permissions.contents === "write") {
          throw new Error("permission denied");
        }
        return "read-token";
      },
    );

    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url.endsWith("/repos/tomcwxyz/open-recs-local")) {
          return jsonResponse({
            id: 101,
            full_name: "tomcwxyz/open-recs-local",
            default_branch: "master",
            html_url: "https://github.com/tomcwxyz/open-recs-local",
          });
        }
        if (url.endsWith("/git/ref/heads/master")) {
          return jsonResponse({ object: { sha: "base123" } });
        }
        const file = repositoryFiles(url);
        if (file) return file;
        if (
          method === "GET" &&
          url.endsWith("/git/ref/heads/crux/observe-source-extract")
        ) {
          return jsonResponse({ message: "Not Found" }, 404);
        }
        throw new Error(`Unexpected fetch: ${method} ${url}`);
      },
    ) as unknown as typeof fetch;

    const result = await createObservationPullRequest({
      repository: "tomcwxyz/open-recs-local",
      installationId: 12,
      connection: connection(true),
      adapterId: "open-recs-source-extract",
      systemVersionRef: "system-version:open-recs:0.1",
      fetchImpl,
      mintToken,
    });

    expect(result).toMatchObject({
      status: "blocked",
      code: "app_write_permission_unavailable",
    });
    expect(
      mintToken.mock.calls.some(
        ([, permissions]) =>
          permissions.contents === "write" &&
          permissions.pull_requests === "write",
      ),
    ).toBe(true);
    expect(
      fetchImpl.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);
  });

  it("returns an existing open review instead of duplicating its branch", async () => {
    const mintToken = vi.fn(async () => "read-token");
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url.endsWith("/repos/tomcwxyz/open-recs-local")) {
          return jsonResponse({
            id: 101,
            full_name: "tomcwxyz/open-recs-local",
            default_branch: "master",
            html_url: "https://github.com/tomcwxyz/open-recs-local",
          });
        }
        if (url.endsWith("/git/ref/heads/master")) {
          return jsonResponse({ object: { sha: "base123" } });
        }
        const file = repositoryFiles(url);
        if (file) return file;
        if (
          method === "GET" &&
          url.endsWith("/git/ref/heads/crux/observe-source-extract")
        ) {
          return jsonResponse({ object: { sha: "existing-review-sha" } });
        }
        if (
          method === "GET" &&
          url.includes("/pulls?") &&
          url.includes("state=open")
        ) {
          return jsonResponse([
            {
              number: 25,
              html_url: "https://github.com/tomcwxyz/open-recs-local/pull/25",
              state: "open",
            },
          ]);
        }
        throw new Error(`Unexpected fetch: ${method} ${url}`);
      },
    ) as unknown as typeof fetch;

    const result = await createObservationPullRequest({
      repository: "tomcwxyz/open-recs-local",
      installationId: 12,
      connection: connection(true),
      adapterId: "open-recs-source-extract",
      systemVersionRef: "system-version:open-recs:0.1",
      fetchImpl,
      mintToken,
    });

    expect(result).toEqual({
      status: "existing_review",
      repository: "tomcwxyz/open-recs-local",
      branch: "crux/observe-source-extract",
      pull_request_number: 25,
      pull_request_url: "https://github.com/tomcwxyz/open-recs-local/pull/25",
    });
    expect(mintToken).toHaveBeenCalledTimes(1);
    expect(
      fetchImpl.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);
  });

  it("creates one immutable review commit and opens a draft PR", async () => {
    const mintToken = vi.fn(
      async (
        _installationId: number,
        permissions: Record<string, "read" | "write">,
      ) => (permissions.contents === "write" ? "write-token" : "read-token"),
    );
    let blobIndex = 0;
    const postBodies: Array<{ url: string; body: unknown }> = [];

    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        const parsedBody =
          typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

        if (method === "POST") postBodies.push({ url, body: parsedBody });

        if (url.endsWith("/repos/tomcwxyz/open-recs-local")) {
          return jsonResponse({
            id: 101,
            full_name: "tomcwxyz/open-recs-local",
            default_branch: "master",
            html_url: "https://github.com/tomcwxyz/open-recs-local",
          });
        }
        if (url.endsWith("/git/ref/heads/master")) {
          return jsonResponse({ object: { sha: "base123" } });
        }
        const file = repositoryFiles(url);
        if (file) return file;
        if (
          method === "GET" &&
          url.endsWith("/git/ref/heads/crux/observe-source-extract")
        ) {
          return jsonResponse({ message: "Not Found" }, 404);
        }
        if (method === "GET" && url.endsWith("/git/commits/base123")) {
          return jsonResponse({ tree: { sha: "base-tree" } });
        }
        if (method === "POST" && url.endsWith("/git/blobs")) {
          blobIndex += 1;
          return jsonResponse({ sha: `blob-${blobIndex}` }, 201);
        }
        if (method === "POST" && url.endsWith("/git/trees")) {
          return jsonResponse({ sha: "tree-new" }, 201);
        }
        if (method === "POST" && url.endsWith("/git/commits")) {
          return jsonResponse({ sha: "commit-new" }, 201);
        }
        if (method === "POST" && url.endsWith("/git/refs")) {
          return jsonResponse({ ref: "refs/heads/crux/observe-source-extract" }, 201);
        }
        if (method === "POST" && url.endsWith("/pulls")) {
          return jsonResponse(
            {
              number: 42,
              html_url: "https://github.com/tomcwxyz/open-recs-local/pull/42",
              state: "open",
            },
            201,
          );
        }
        throw new Error(`Unexpected fetch: ${method} ${url}`);
      },
    ) as unknown as typeof fetch;

    const result = await createObservationPullRequest({
      repository: "tomcwxyz/open-recs-local",
      installationId: 12,
      connection: connection(true),
      adapterId: "open-recs-source-extract",
      systemVersionRef: "system-version:open-recs:0.1",
      fetchImpl,
      mintToken,
    });

    expect(result).toEqual({
      status: "created",
      repository: "tomcwxyz/open-recs-local",
      base_branch: "master",
      base_sha: "base123",
      branch: "crux/observe-source-extract",
      commit_sha: "commit-new",
      pull_request_number: 42,
      pull_request_url: "https://github.com/tomcwxyz/open-recs-local/pull/42",
    });

    expect(blobIndex).toBe(4);
    const commitCall = postBodies.find(({ url }) => url.endsWith("/git/commits"));
    expect(commitCall?.body).toMatchObject({
      message: "Observe source.extract with bounded CRUX metadata",
      tree: "tree-new",
      parents: ["base123"],
    });
    const prCall = postBodies.find(({ url }) => url.endsWith("/pulls"));
    expect(prCall?.body).toMatchObject({
      head: "crux/observe-source-extract",
      base: "master",
      draft: true,
    });
  });
});
