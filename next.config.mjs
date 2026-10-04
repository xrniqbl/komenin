import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

// Generate nonce for CSP
function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

// Store nonces per request (in production, this would be request-scoped)
// For production, CSP will be handled by middleware with per-request nonces
// In dev, we can use a static nonce
const devNonce = generateNonce();

const contentSecurityPolicy = isProd
  ? // Production: will be set dynamically in middleware
    ""
  : // Development: use static nonce for simplicity. CSP nonce sources REQUIRE
    // the `nonce-` prefix ('nonce-xxx'); without it the browser ignores the
    // source and the nonce never matches — dev would silently run unprotected.
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      `script-src 'self' 'nonce-${devNonce}'`,
      `style-src 'self' 'nonce-${devNonce}' https://fonts.googleapis.com`,
      "connect-src 'self' https: wss:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join("; ");

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: __dirname,
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "@base-ui/react"],
  },
  async headers() {
    /** @type {{ key: string, value: string }[]} */
    const securityHeaders = [
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=()",
      },
      {
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin",
      },
      // CSP will be set dynamically in middleware for production
      ...(isProd ? [] : [{
        key: "Content-Security-Policy",
        value: contentSecurityPolicy,
      }]),
    ];

    if (isProd) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // Long-lived immutable cache for versioned brand art + PWA icons.
      // OG images (/opengraph-image, /twitter-image) stay dynamic — Next
      // serves those route images with its own short-lived caching.
      {
        source: "/brand/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/favicon.svg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
      {
        source: "/apple-touch-icon.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
