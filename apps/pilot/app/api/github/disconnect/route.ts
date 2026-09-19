import { cookies } from "next/headers";
import { GITHUB_CONNECTION_COOKIE } from "../../../../lib/github-app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(GITHUB_CONNECTION_COOKIE);
  return Response.json({ ok: true });
}
