/**
 * Middleware — security headers + CSP nonce
 *
 * Responsibilities:
 * - Per-request CSP nonce propagated to Next.js via the `x-nonce` request
 *   header so framework inline scripts work under strict CSP
 * - HSTS + hardening headers (frame-ancestors, nosniff, referrer, permissions)
 * - Request payload size guard
 *
 * Deliberately NOT here (handled elsewhere, and broken when done in
 * middleware): full rate limiting lives in `@/lib/rate-limit` per route
 * (durable, Upstash-backed); page caching is controlled by Next.js defaults
 * per route segment — a blanket `no-store` here would kill marketing-page
 * caching and Core Web Vitals.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import crypto from "node:crypto";

const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB

function generateCSPNonce(): string {
  return crypto.randomBytes(16).toString("base64");
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
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
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

export function middleware(request: NextRequest): NextResponse | undefined {
  // Payload size guard (defence in depth — platforms also cap body size)
  const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_PAYLOAD_SIZE) {
    return NextResponse.json(
      {
        error: "Payload too large",
        details: `Maximum allowed size is ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB`,
      },
      { status: 413 },
    );
  }

  const isProduction = process.env.NODE_ENV === "production";
  const cspNonce = generateCSPNonce();
  const isCheckoutRoute = request.nextUrl.pathname.startsWith("/app/checkout");

  // Propagate the nonce to Next.js as a REQUEST header: the framework reads
  // it and stamps nonce="" onto its inline bootstrap scripts. Setting it only
  // on the response (as before) never reached script generation, which made
  // production CSP break every inline script.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", cspNonce);

  const securityHeaders: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "on",
  };

  // Authenticated areas must never be cached by intermediaries — a cached
  // page would serve one user's CSP nonce to another (breaking CSP or
  // leaking it) and expose private dashboards.
  const isPrivateArea =
    request.nextUrl.pathname.startsWith("/app/") ||
    request.nextUrl.pathname.startsWith("/admin/") ||
    request.nextUrl.pathname.startsWith("/invite/") ||
    request.nextUrl.pathname.startsWith("/onboarding");
  if (isPrivateArea) {
    securityHeaders["Cache-Control"] = "private, no-store";
    securityHeaders["X-Robots-Tag"] = "noindex, nofollow";
  }

  if (isProduction) {
    securityHeaders["Strict-Transport-Security"] =
      "max-age=63072000; includeSubDomains; preload";
    securityHeaders["Content-Security-Policy"] = buildCSP(
      cspNonce,
      true,
      isCheckoutRoute,
    );
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
