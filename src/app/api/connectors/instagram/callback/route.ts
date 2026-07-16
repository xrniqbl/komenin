import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  if (error) return NextResponse.redirect(new URL(`/app/settings/publisher?oauth=error&provider=instagram&error=${encodeURIComponent(error)}`, request.url));
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
  // Token exchange should use INSTAGRAM_APP_ID/SECRET; store encrypted credential next.
  return NextResponse.redirect(new URL("/app/settings/publisher?oauth=instagram_connected", request.url));
}
