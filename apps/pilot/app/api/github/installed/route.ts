import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // GitHub's setup redirect includes installation_id, but CRUX deliberately
  // does not trust it. Re-run user authorisation and derive accessible
  // installations from the resulting user access token instead.
  return NextResponse.redirect(new URL("/api/github/connect?after=install", url.origin));
}
