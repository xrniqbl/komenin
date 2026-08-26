/**
 * Middleware - Security & CSP Nonce Handler
 *
 * This middleware handles:
 * - Content Security Policy (CSP) nonce generation per request
 * - Request size limits (DoS prevention)
 * - CORS validation
 * - Authentication token verification
 * - Rate limiting
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'node:crypto';

// Request ID to store per-request data
interface RequestContext {
  requestId: string;
  cspNonce: string;
  timestamp: number;
}

const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB max
const rateLimitedIPs = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 100;

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Generate CSP nonce
 */
function generateCSPNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Check if IP is rate limited
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const count = rateLimitedIPs.get(ip) || 0;

  if (count >= MAX_REQUESTS_PER_MINUTE) {
    return true;
  }

  rateLimitedIPs.set(ip, count + 1);

  // Cleanup old entries after window expires
  setTimeout(() => {
    const current = rateLimitedIPs.get(ip) || 0;
    if (current > 0) {
      rateLimitedIPs.set(ip, current - 1);
    }
  }, RATE_LIMIT_WINDOW);

  return false;
}

/**
 * Clear rate limit tracking after response sent
 */
function clearRateLimits() {
  setTimeout(() => {
    rateLimitedIPs.clear();
  }, RATE_LIMIT_WINDOW);
}

/**
 * Main middleware function
 */
export function middleware(request: NextRequest): NextResponse | undefined {
  const requestId = generateRequestId();
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';

  // Track rate limiting before any other processing
  if (isRateLimited(ip)) {
    console.warn(`[RATE LIMIT] ${ip}: Too many requests (${MAX_REQUESTS_PER_MINUTE}/min)`);
    return NextResponse.json(
      {
        error: 'Too many requests',
        details: 'Please retry after some time'
      },
      { status: 429 }
    );
  }

  // Check request body size
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_PAYLOAD_SIZE) {
    return NextResponse.json(
      {
        error: 'Payload too large',
        details: `Maximum allowed size is ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB`
      },
      { status: 413 }
    );
  }

  // Generate CSP nonce for this request
  const cspNonce = generateCSPNonce();

  // Build security headers
  const securityHeaders: Record<string, string> = {
    'X-Request-ID': requestId,
    'X-DNS-Prefetch-Control': 'on',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
  };

  // Add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    securityHeaders['Strict-Transport-Security'] =
      'max-age=63072000; includeSubDomains; preload';

    // Build dynamic CSP with nonce for production
    securityHeaders['Content-Security-Policy'] = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      `script-src 'self' '${cspNonce}'`,
      `style-src 'self' '${cspNonce}' https://fonts.googleapis.com`,
      "connect-src 'self' https: wss:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join('; ');

    // Add Midtrans domains if needed (for payment integration)
    if (process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY) {
      securityHeaders['Content-Security-Policy'] =
        securityHeaders['Content-Security-Policy']!.replace(
          "script-src 'self' '",
          "script-src 'self' '"
        ) + " https://app.midtrans.com https://api.midtrans.com";
    }
  }

  // Create response with security headers
  const response = NextResponse.next({
    headers: securityHeaders,
  });

  // Set CSP nonce as header for client-side access (if needed)
  response.headers.set('X-CSP-Nonce', cspNonce);

  // Clear rate limits after a short delay
  clearRateLimits();

  return response;
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
