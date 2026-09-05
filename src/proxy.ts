import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";
import { splitLocalePath } from "@/lib/i18n/paths";

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

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Payload size guard (defence in depth — platforms also cap body size)
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

  // Path-based locale: /id/<public path> serves the same single-copy route
  // tree with the Indonesian locale flagged for SEO metadata + rendering.
  const { locale: pathLocale, path: unprefixedPath } = splitLocalePath(pathname);
  const effectivePath = pathLocale === "id" ? unprefixedPath : pathname;

  const isLoggedIn = !!req.auth;
  const isProtected =
    effectivePath === "/app" ||
    effectivePath.startsWith("/app/") ||
    effectivePath === "/admin" ||
    effectivePath.startsWith("/admin/") ||
    effectivePath === "/invite" ||
    effectivePath.startsWith("/invite/") ||
    effectivePath === "/onboarding";
  const isAuthPage =
    effectivePath === "/login" ||
    effectivePath.startsWith("/login/") ||
    effectivePath === "/signup" ||
    effectivePath.startsWith("/signup/");

  if (isProtected && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/app", req.nextUrl.origin));
  }

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
  }

  // Authenticated areas must never be cached by intermediaries — a cached
  // page would serve one user's CSP nonce to another (breaking CSP or
  // leaking it) and expose private dashboards.
  const isPrivateArea =
    effectivePath === "/app" ||
    effectivePath.startsWith("/app/") ||
    effectivePath === "/admin" ||
    effectivePath.startsWith("/admin/") ||
    effectivePath === "/invite" ||
    effectivePath.startsWith("/invite/") ||
    effectivePath.startsWith("/onboarding");
  if (isPrivateArea) {
    securityHeaders["Cache-Control"] = "private, no-store";
    securityHeaders["X-Robots-Tag"] = "noindex, nofollow";
  }

  const response = pathLocale === "id"
    ? NextResponse.rewrite(new URL(unprefixedPath, req.nextUrl.origin), {
        request: { headers: requestHeaders },
      })
    : NextResponse.next({ request: { headers: requestHeaders } });

  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  return response;
});

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
