import { NextResponse } from "next/server";
import { signIn } from "@/lib/auth";
import { verifySsoTicket } from "@/lib/sso-ticket";
import { cookies } from "next/headers";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-cookie";

export const runtime = "nodejs";

/**
 * Exchange a short-lived SSO ticket for an Auth.js session (Credentials provider).
 * GET /api/auth/sso/complete?ticket=...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticket = searchParams.get("ticket") || "";
  // Pre-check only — NOT consumed here. The nonce is burned inside the
  // credentials provider (src/lib/auth.ts), which re-verifies the ticket
  // when Auth.js performs the actual sign-in.
  const payload = verifySsoTicket(ticket);
  if (!payload) {
    return NextResponse.redirect(new URL("/login?sso=invalid", request.url));
  }

  // Land user in the SSO workspace.
  const jar = await cookies();
  jar.set(ACTIVE_WORKSPACE_COOKIE, payload.workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Auth.js will verify ticket again inside the credentials provider.
  await signIn("sso-ticket", {
    ticket,
    redirectTo: "/app",
  });

  // signIn redirects; fallback:
  return NextResponse.redirect(new URL("/app", request.url));
}
