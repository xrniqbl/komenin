import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { authConfig } from "@/lib/auth.config";
import { splitLocalePath } from "@/lib/i18n/paths";
import { extractClientIp } from "@/lib/rate-limit";
import {
  EDGE_API_THROTTLE,
  consumeEdgeThrottle,
  isScannerProbe,
  isThrottledApiPath,
  logScannerProbe,
} from "@/lib/scanner-guard";

// Edge-compatible auth wrapper (no Prisma adapter).
const { auth } = NextAuth(authConfig);

const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB

function generateCSPNonce(): string {
  // Web Crypto — the proxy runs on the Edge runtime where node:crypto is unavailable.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function buildCSP(nonce: string, isProduction: boolean, includeMidtrans: boolean): string {
  // Snap loader + its iframe popup — only included on checkout routes.
  const midtransScript = includeMidtrans
    ? isProduction
      ? " https://app.midtrans.com"
      : " https://app.sandbox.midtrans.com"
    : "";

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Next.js inline bootstrap scripts carry the nonce via the request header
    // set below; 'strict-dynamic' lets those scripts load their own chunks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${midtransScript}`,
    // No nonce here on purpose: a nonce would make the browser ignore
    // 'unsafe-inline' (CSP spec), and the app legitimately uses inline
    // style attributes (React style={{...}} props).
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Midtrans Snap opens an iframe popup at its host (checkout only)
    ...(includeMidtrans ? [`frame-src ${midtransScript.trim()}`] : []),
    // Explicit allowlist — a wildcard `https:` would let any injected script
    // exfiltrate data to arbitrary hosts, defeating CSP as a second layer.
    "connect-src 'self' https://api.midtrans.com https://api.sandbox.midtrans.com wss:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

function isProtectedPath(effectivePath: string): boolean {
  return (
    effectivePath === "/app" ||
    effectivePath.startsWith("/app/") ||
    effectivePath === "/admin" ||
    effectivePath.startsWith("/admin/") ||
    effectivePath === "/invite" ||
    effectivePath.startsWith("/invite/") ||
    effectivePath === "/onboarding"
  );
}

function isAuthPagePath(effectivePath: string): boolean {
  return (
    effectivePath === "/login" ||
    effectivePath.startsWith("/login/") ||
    effectivePath === "/signup" ||
    effectivePath.startsWith("/signup/")
  );
}

function isPrivateAreaPath(effectivePath: string): boolean {
  return isProtectedPath(effectivePath);
}

/**
 * Shared response finalizer: locale rewrite + per-request CSP headers.
 * Used by both the anonymous fast path (no session cookie) and the
 * authenticated path below so public pages share one behavior.
 */
function finalizeResponse(
  req: NextRequest,
  pathLocale: "en" | "id",
  unprefixedPath: string,
  effectivePath: string,
): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";
  const cspNonce = generateCSPNonce();
  const isCheckoutRoute = effectivePath.startsWith("/app/checkout");

  // Next.js reads the CSP request header and stamps nonce="…" onto its inline
  // bootstrap scripts; setting it only on the response never reaches script
  // generation, which would break every inline script in production.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", cspNonce);
  if (isProduction) {
    requestHeaders.set("Content-Security-Policy", buildCSP(cspNonce, true, isCheckoutRoute));
  }
  if (pathLocale === "id") {
    // getLocale() reads this; falls back to the cookie when absent.
    requestHeaders.set("x-komenin-locale", "id");
  }

  // Headers below are NOT duplicated from next.config.mjs / vercel.json —
  // those layers already send the static baseline (XFO, nosniff, HSTS, …).
  // The proxy adds the per-request and path-conditional ones only.
  const securityHeaders: Record<string, string> = {};
  if (isProduction) {
    securityHeaders["Content-Security-Policy"] = buildCSP(cspNonce, true, isCheckoutRoute);
  } else {
    // Staging/preview get the same policy in report-only mode: violations are
    // observable without breaking the app, so prod CSP never ships untested.
    securityHeaders["Content-Security-Policy-Report-Only"] = buildCSP(
      cspNonce,
      false,
      isCheckoutRoute,
    );
  }

  // Authenticated areas must never be cached by intermediaries — a cached
  // page would serve one user's CSP nonce to another (breaking CSP or
  // leaking it) and expose private dashboards.
  if (isPrivateAreaPath(effectivePath)) {
    securityHeaders["Cache-Control"] = "private, no-store";
    securityHeaders["X-Robots-Tag"] = "noindex, nofollow";
  }

  const response =
    pathLocale === "id"
      ? NextResponse.rewrite(new URL(unprefixedPath, req.nextUrl.origin), {
          request: { headers: requestHeaders },
        })
      : NextResponse.next({ request: { headers: requestHeaders } });

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

function payloadTooLarge(req: NextRequest): NextResponse | null {
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_PAYLOAD_SIZE) {
    return NextResponse.json(
      {
        error: "Payload too large",
        details: `Maximum allowed size is ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB`,
      },
      { status: 413 },
    );
  }
  return null;
}

// Auth.js session cookie names (see @auth/core defaultCookies):
// `authjs.session-token` locally, `__Secure-authjs.session-token` on HTTPS,
// plus `.0`, `.1`, … chunks when the JWT is large.
function hasSessionCookie(req: NextRequest): boolean {
  try {
    return req.cookies.getAll().some((cookie) => cookie.name.includes("authjs.session-token"));
  } catch {
    // Fail closed: fall through to full verification when cookies unreadable.
    return true;
  }
}

const authenticatedHandler = auth((req) => {
  const { pathname } = req.nextUrl;

  const tooLarge = payloadTooLarge(req);
  if (tooLarge) return tooLarge;

  // Path-based locale: /id/<public path> serves the same single-copy route
  // tree with the Indonesian locale flagged for SEO metadata + rendering.
  const { locale: pathLocale, path: unprefixedPath } = splitLocalePath(pathname);
  const effectivePath = pathLocale === "id" ? unprefixedPath : pathname;

  const isLoggedIn = !!req.auth?.user?.id;

  if (isProtectedPath(effectivePath) && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPagePath(effectivePath) && isLoggedIn) {
    return NextResponse.redirect(new URL("/app", req.nextUrl.origin));
  }

  return finalizeResponse(req, pathLocale, unprefixedPath, effectivePath);
});

// extractClientIp is Edge-safe (header parsing only, no Node imports), but
// guard anyway so one malformed header can never take the proxy path down.
function safeEdgeClientIp(req: NextRequest): string {
  try {
    return extractClientIp(req);
  } catch {
    return "unknown";
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Scanner trap: automated probes for leaked files, admin consoles, and
  // injection payloads get a bare 404 — never a 403/500 that confirms the
  // path exists. Logged for alerting; legitimate browsers never hit these.
  if (isScannerProbe(pathname, search)) {
    logScannerProbe({
      pathname,
      search,
      ip: safeEdgeClientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 2. Edge throttle for /api/* (worker/cron/health excluded): a cheap
  // per-instance fixed window that 429s floods before they reach handlers.
  // Durable Upstash enforcement still lives inside the route handlers.
  if (isThrottledApiPath(pathname)) {
    const verdict = consumeEdgeThrottle(safeEdgeClientIp(req));
    if (!verdict.allowed) {
      const retryAfter = Math.max(
        1,
        Math.ceil((verdict.resetAt - Date.now()) / 1000),
      );
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.min(retryAfter, 60)),
            "X-RateLimit-Limit": String(EDGE_API_THROTTLE.limit),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }
  }
  // Fast path for anonymous traffic (the common case on public marketing,
  // docs, and pricing pages): without a session cookie there is no JWT to
  // verify, so skip the Auth.js session lookup entirely and save 20–100ms
  // of TTFB on the pages where LCP matters most.
  if (!hasSessionCookie(req)) {
    const tooLarge = payloadTooLarge(req);
    if (tooLarge) return tooLarge;

    const { locale: pathLocale, path: unprefixedPath } = splitLocalePath(pathname);
    const effectivePath = pathLocale === "id" ? unprefixedPath : pathname;

    // Anonymous users hitting protected routes still bounce to /login.
    // (Anonymous users on /login|/signup render directly — no redirect needed.)
    if (isProtectedPath(effectivePath)) {
      const url = new URL("/login", req.nextUrl.origin);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    return finalizeResponse(req, pathLocale, unprefixedPath, effectivePath);
  }

  return (authenticatedHandler as (req: NextRequest) => Promise<Response>)(req);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon / icons / brand art / PWA manifest (static assets)
     * - robots.txt, sitemap.xml, llms.txt (crawler files)
     *
     * NOTE: /security.txt and /.well-known/security.txt intentionally STAY
     * matched so the scanner trap + edge throttle in proxy() still run;
     * isScannerProbe() returns false for them so they serve normally.
     */
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|apple-touch-icon.png|brand/|manifest.webmanifest|robots.txt|sitemap.xml|llms.txt).*)",
  ],
};
