import { parsePublicGitRef, scanPublicGit } from "../../../lib/public-git-discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { repo?: unknown };
  try {
    body = (await request.json()) as { repo?: unknown };
  } catch {
    return Response.json({ ok: false, code: "invalid_json", message: "Provide a repository URL." }, { status: 400 });
  }
  const ref = typeof body.repo === "string"
    ? parsePublicGitRef(body.repo, process.env.CRUX_PUBLIC_GIT_INSTANCES ?? "")
    : null;
  if (!ref) {
    return Response.json({
      ok: false,
      code: "invalid_repository",
      message: "Use a public Framagit, GitLab, Codeberg, Gitea or Bitbucket repository URL. Other self-hosted GitLab/Forgejo instances require an administrator allow-list.",
    }, { status: 400 });
  }
  try {
    return Response.json(await scanPublicGit(ref));
  } catch (error) {
    return Response.json({
      ok: false,
      code: "git_discovery_failed",
      message: error instanceof Error ? error.message : "CRUX could not inspect the repository.",
    }, { status: 502 });
  }
}
