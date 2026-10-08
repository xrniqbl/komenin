import { NextResponse } from "next/server";
import { signIn } from "@/lib/auth";
import { apiError } from "@/lib/api-errors";
import { jsonErrorFromUnknown } from "@/lib/api-route";
import { verifySsoTicket } from "@/lib/sso-ticket";
import { cookies } from "next/headers";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-cookie";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Exchange a short-lived SSO ticket for an Auth.js session (Credentials provider).
 * GET /api/auth/sso/complete?ticket=...
 */
export async function GET(request: Request) {
  // Per-IP rate limit (auth-adjacent, fail-closed).
  const ipRate = await consumeRateLimit({
    key: getRequestRateKey(request, "auth:sso:complete:ip"),
    limit: 20,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!ipRate.ok) {
    return apiError("RATE_LIMITED", 429);
  }

  const { searchParams } = new URL(request.url);
  const ticket = searchParams.get("ticket") || "";

  try {
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
  } catch (error) {
    // signIn throws NEXT_REDIRECT on success (Auth.js redirects to
    // redirectTo) — rethrow so Next.js can perform the redirect.
    const { isRedirectError } = await import(
      "next/dist/client/components/redirect-error"
    );
    if (isRedirectError(error)) throw error;
    return jsonErrorFromUnknown(error, "SSO sign-in failed", 500);
  }
}
