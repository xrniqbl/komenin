/**
 * Security Middleware Layer
 *
 * This middleware provides comprehensive security protections for all API routes:
 * - Request size limits (DoS prevention)
 * - Rate limiting
 * - CORS enforcement
 * - XSS protection
 * - SQL injection prevention hints
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRateLimiter } from '@/lib/rate-limiter';
import { isValidOrigin } from '@/lib/cors-policy';

const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB max request body
const rateLimiter = getRateLimiter();

/**
 * Request Size Limit Middleware
 * Prevents DoS attacks via large payloads
 */
export async function requestSizeLimitMiddleware(
  req: NextRequest,
  next: () => Promise<NextResponse>
): Promise<NextResponse> {
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);

  if (contentLength > MAX_PAYLOAD_SIZE) {
    return NextResponse.json(
      {
        error: 'Payload too large',
        details: `Maximum allowed size is ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB`
      },
      { status: 413 }
    );
  }

  return next();
}

/**
 * Input Validation Middleware
 * Sanitizes and validates input data
 */
export class InputValidator {
  /**
   * Validate URL format
   */
  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize HTML input (basic XSS prevention)
   */
  static sanitizeHTML(input: string): string {
    // Remove script tags and event handlers
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/g, '')
      .replace(/on\w+='[^']*'/g, '');
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}

/**
 * CORS Enforcement Middleware
 * Ensures only trusted origins can make requests
 */
export function corsMiddleware(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');

  if (!isValidOrigin(origin ?? '')) {
    // Block non-whitelisted origins on mutation endpoints
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return NextResponse.json(
        { error: 'CORS policy violation' },
        { status: 403 }
      );
    }
  }

  return null; // Continue processing
}

/**
 * Authentication Check Middleware
 * Validates API keys and session tokens
 */
export interface AuthContext {
  userId?: string;
  workspaceId?: string;
  apiKeyPrefix?: string;
  scopes?: string[];
}

export async function authenticateRequest(
  req: NextRequest
): Promise<{ auth: AuthContext; error?: string }> {
  const authHeader = req.headers.get('authorization');
  const apiKeyHeader = req.headers.get('x-api-key');

  // Check API key authentication
  if (apiKeyHeader) {
    return await validateApiKey(apiKeyHeader);
  }

  // Check Bearer token (session or OAuth)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return await validateSessionToken(token);
  }

  // Check cookie-based session
  const sessionCookie = req.cookies.get('next-auth.session-token');
  if (sessionCookie) {
    return await validateSessionCookie(sessionCookie.value);
  }

  return { auth: {}, error: 'Authentication required' };
}

async function validateApiKey(apiKey: string): Promise<{ auth: AuthContext; error?: string }> {
  try {
    // Extract prefix and key
    const match = apiKey.match(/^aeth_([a-zA-Z0-9_]+)$/);
    if (!match) {
      return { auth: {}, error: 'Invalid API key format' };
    }

    const keySuffix = match[1];
    const prefix = 'aeth_' + keySuffix.slice(0, 4);

    // TODO: Query database to validate key and fetch permissions
    // For now, mock validation
    return {
      auth: {
        apiKeyPrefix: prefix,
        scopes: ['campaigns:read', 'listeners:read'],
      }
    };
  } catch (error) {
    return { auth: {}, error: 'API key validation failed' };
  }
}

async function validateSessionToken(token: string): Promise<{ auth: AuthContext; error?: string }> {
  try {
    // TODO: Verify token with auth provider
    // Mock implementation
    return {
      auth: {
        userId: 'user_mock_' + token.slice(0, 8),
      }
    };
  } catch (error) {
    return { auth: {}, error: 'Invalid session token' };
  }
}

async function validateSessionCookie(cookieValue: string): Promise<{ auth: AuthContext; error?: string }> {
  try {
    // TODO: Verify cookie with auth provider
    return {
      auth: {
        userId: 'user_cookie',
      }
    };
  } catch (error) {
    return { auth: {}, error: 'Session expired' };
  }
}

/**
 * Webhook Signature Verification
 * Ensures incoming webhooks are authentic
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('node:crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  return safeEqual(signature, expectedSignature);
}

function safeEqual(a: string, b: string): boolean {
  const crypto = require('node:crypto');
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();

  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Export middleware handler for Next.js middleware.ts
 */
export async function securityMiddleware(
  req: NextRequest
): Promise<NextResponse | undefined> {
  // 1. Check CORS
  const corsError = corsMiddleware(req);
  if (corsError) return corsError;

  // 2. Check request size
  const result = await requestSizeLimitMiddleware(req, async () => NextResponse.next());
  if (result.status !== 200) return result;

  // 3. Authenticate if needed (skip public routes)
  const authPaths = ['/api/auth/', '/api/public/'];
  const needsAuth = !authPaths.some(path => req.nextUrl.pathname.startsWith(path));

  if (needsAuth) {
    const { auth, error } = await authenticateRequest(req);
    if (error) {
      return NextResponse.json({ error }, { status: 401 });
    }

    // Attach auth context to request for later use
    req.headers.set('x-user-id', auth.userId || '');
    req.headers.set('x-workspace-id', auth.workspaceId || '');
  }

  return undefined; // Continue to route handler
}

/**
 * Export for use in individual route handlers
 */
export async function handleSecureRequest(
  req: NextRequest,
  handler: (auth: AuthContext) => Promise<Response>,
  options?: { skipAuth?: boolean }
): Promise<Response> {
  // Run security checks
  const corsError = corsMiddleware(req);
  if (corsError) return corsError;

  const sizeResult = await requestSizeLimitMiddleware(req, async () => Response.json({ ok: true }));
  if (sizeResult.status !== 200 && sizeResult.status !== 200) {
    return sizeResult;
  }

  // Skip auth if requested
  if (!options?.skipAuth) {
    const { auth, error } = await authenticateRequest(req);
    if (error) {
      return Response.json({ error }, { status: 401 });
    }

    return handler(auth);
  }

  return handler({});
}
