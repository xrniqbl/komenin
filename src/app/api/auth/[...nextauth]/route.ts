import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

// The credentials (email OTP) callback is the one auth surface with no
// IP-level brake — the per-code 5-attempt cap is the only limit. Throttle all
// Auth.js POSTs (sign-in begin, callback, signout) per IP: 30/min is far
// above human login traffic but caps OTP guessing. GET is untouched because
// client session polling would blow through any shared-IP budget.
export async function POST(req: NextRequest) {
  // failClosed: this throttle guards OTP/code guessing — during a limiter
  // outage requests must be denied, never let through unprotected.
  const rate = await consumeRateLimit({
    key: getRequestRateKey(req, "auth:post"),
    limit: 30,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return handlers.POST(req);
}

export const { GET } = handlers;