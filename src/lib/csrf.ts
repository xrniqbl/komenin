import type { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";

/**
 * CSRF protection for cookie-authenticated route handlers.
 *
 * Next.js server actions have a built-in Origin check, but plain POST route
 * handlers do not. Any handler that mutates state based on the session cookie
 * must call this first. Handlers authenticated by a secret instead (API key,
 * worker/cron secret, Midtrans signature, webhook token) do NOT need it — the
 * secret itself is the CSRF token.
 *
 * Fails closed: an Origin header that does not match the serving host, or an
 * explicit `Sec-Fetch-Site: cross-site`, is rejected with 403. Requests with
 * neither header (curl, server-to-server, same-origin navigations) pass —
 * browsers always attach both to cross-site fetches, so spoofed cross-site
 * browser requests cannot slip through.
 */
export function assertSameOrigin(
  request: NextRequest | Request,
): NextResponse | null {
  const fwdHost = request.headers.get("x-forwarded-host");
  const hostHdr = request.headers.get("host");
  const host = (fwdHost ? fwdHost.split(",")[0].trim() : null) || hostHdr || new URL(request.url).host;

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost !== host) {
      return apiError("INVALID_ORIGIN", 403);
    }
    return null; // Origin matches — allowed
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return apiError("INVALID_ORIGIN", 403);
  }

  return null;
}
