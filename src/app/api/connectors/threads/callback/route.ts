import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
  return NextResponse.redirect(new URL("/app/settings/publisher?oauth=threads_connected", request.url));
}
