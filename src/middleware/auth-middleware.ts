/**
 * Authentication Middleware
 *
 * Provides unified authentication handling for all API routes.
 * Supports multiple auth methods: Session cookies, Bearer tokens, API keys.
 */

import { NextRequest, NextResponse } from 'next/server';
import { metrics } from '@/lib/metrics';
import { rateLimiter, checkAuthRateLimit } from '@/lib/rate-limiter';
import { APIKeyManager, PermissionValidator } from '@/lib/api-key-manager';
import jwt from 'jsonwebtoken';

// Types for different auth methods
export type AuthMethod = 'session' | 'bearer' | 'api_key';

export interface AuthContext {
  method: AuthMethod;
  userId?: string;
  workspaceId?: string;
  apiKeyPrefix?: string;
  scopes?: string[];
  isAdmin?: boolean;
}

interface AuthOptions {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requiredScopes?: string[];
  skipRateLimit?: boolean;
  allowApiKey?: boolean;
  allowSession?: boolean;
}

const DEFAULT_OPTIONS: Required<AuthOptions> = {
  requireAuth: true,
  requireAdmin: false,
  requiredScopes: [],
  skipRateLimit: false,
  allowApiKey: true,
  allowSession: true,
};

/**
 * Parse and validate session cookie
 */
async function validateSessionCookie(
  sessionToken: string,
  ip: string
): Promise<{ success: boolean; context?: AuthContext; error?: string }> {
  try {
    // TODO: Implement actual session validation with Prisma
    // This is a mock implementation - replace with real logic

    // In production, you would:
    // 1. Query sessions table to validate token
    // 2. Get user details
    // 3. Check workspace memberships for workspaceId

    return {
      success: false,
      error: 'Session validation not implemented',
    };

  } catch (error) {
    console.error('[AUTH] Session validation error:', error);
    return {
      success: false,
      error: 'Session validation failed',
    };
  }
}

/**
 * Validate Bearer token (JWT or OAuth token)
 */
async function validateBearerToken(
  token: string,
  ip: string
): Promise<{ success: boolean; context?: AuthContext; error?: string }> {
  try {
    // TODO: Implement JWT validation
    // For now, mock implementation

    if (!token || token.length < 10) {
      return {
        success: false,
        error: 'Invalid token format',
      };
    }

    return {
      success: false,
      error: 'Bearer token validation not fully implemented',
    };

  } catch (error) {
    console.error('[AUTH] Bearer token validation error:', error);
    return {
      success: false,
      error: 'Token validation failed',
    };
  }
}

/**
 * Validate API key and extract permissions
 */
async function validateAPIKey(
  apiKey: string,
  ip: string
): Promise<{ success: boolean; context?: AuthContext; error?: string }> {
  try {
    // Extract and validate key format
    const suffix = APIKeyManager.extractSuffix(apiKey);
    if (!suffix) {
      return {
        success: false,
        error: 'Invalid API key format',
      };
    }

    // Hash key for database lookup
    const hashedKey = APIKeyManager.hashKey(`${APIKeyManager.PREFIX}${suffix}`);

    // TODO: Query database to validate key and fetch permissions
    // Mock implementation for now:

    return {
      success: true,
      context: {
        method: 'api_key',
        apiKeyPrefix: apiKey.substring(0, 5) + '***',
        scopes: ['campaigns:read'], // Default limited scope
      },
    };

  } catch (error) {
    console.error('[AUTH] API key validation error:', error);
    return {
      success: false,
      error: 'API key validation failed',
    };
  }
}

/**
 * Main authentication handler
 */
export async function authenticateRequest(
  request: NextRequest,
  options: AuthOptions = {}
): Promise<{
  authenticated: boolean;
  context?: AuthContext;
  error?: string;
}> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

  // Rate limiting check (unless explicitly skipped)
  if (!config.skipRateLimit && !config.allowApiKey) {
    const limitResult = checkAuthRateLimit(`auth:${ip}`);
    if (!limitResult.allowed) {
      return {
        authenticated: false,
        error: `Too many attempts. Retry after ${new Date(limitResult.resetAt)}`,
      };
    }
  }

  let authResult: ReturnType<typeof validateAPIKey> | null = null;

  // Try API Key authentication first (if allowed)
  if (config.allowApiKey) {
    const apiKey = request.headers.get('x-api-key');
    const authHeader = request.headers.get('authorization');

    if (apiKey && !apiKey.startsWith('Bearer')) {
      authResult = await validateAPIKey(apiKey, ip);
      if (authResult.success && authResult.context) {
        // Verify admin requirement
        if (config.requireAdmin && !authResult.context.isAdmin) {
          authResult.success = false;
          authResult.error = 'Admin privileges required';
        }

        // Verify required scopes
        if (config.requiredScopes.length > 0 && authResult.success) {
          const permissionCheck = await PermissionValidator.validatePermissions({
            apiKeyId: 'mock_api_key_id', // TODO: Get from validated context
            workspaceId: authResult.context.workspaceId || 'mock_workspace',
            requestedScopes: config.requiredScopes,
          });

          if (!permissionCheck.valid) {
            authResult.success = false;
            authResult.error = permissionCheck.error;
          }
        }

        if (authResult.success) {
          return {
            authenticated: true,
            context: authResult.context,
          };
        }
      }

      if (authResult.success) return { authenticated: false, error: authResult.error };
    }
  }

  // Try Bearer token authentication
  if (authHeader?.startsWith('Bearer ')) {
    const bearerToken = authHeader.slice(7);
    const result = await validateBearerToken(bearerToken, ip);
    if (result.success) {
      if (config.requireAdmin && !result.context?.isAdmin) {
        return {
          authenticated: false,
          error: 'Admin privileges required',
        };
      }
      return { authenticated: true, context: result.context };
    }
  }

  // Try session cookie authentication
  if (config.allowSession) {
    const sessionCookie = request.cookies.get('next-auth.session-token');
    if (sessionCookie) {
      const result = await validateSessionCookie(sessionCookie.value, ip);
      if (result.success) {
        if (config.requireAdmin && !result.context?.isAdmin) {
          return {
            authenticated: false,
            error: 'Admin privileges required',
          };
        }
        return { authenticated: true, context: result.context };
      }
    }
  }

  // All methods failed
  return {
    authenticated: false,
    error: 'Authentication required',
  };
}

/**
 * Create authentication middleware wrapper
 */
export function createAuthMiddleware(options: AuthOptions = {}) {
  return async (request: NextRequest) => {
    const authResult = await authenticateRequest(request, options);

    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Attach auth context to request for later use
    request.headers.set('x-user-id', authResult.context?.userId || '');
    request.headers.set('x-workspace-id', authResult.context?.workspaceId || '');

    return NextResponse.next();
  };
}

/**
 * Quick helper to check if request has any authentication
 */
export function hasAnyAuth(request: NextRequest): boolean {
  return (
    !!request.headers.get('x-api-key') ||
    !!request.headers.get('authorization')?.startsWith('Bearer ') ||
    !!request.cookies.get('next-auth.session-token')
  );
}

/**
 * Extract user ID from request headers (set by auth middleware)
 */
export function getUserIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-user-id');
}

/**
 * Extract workspace ID from request headers
 */
export function getWorkspaceIdFromRequest(request: NextRequest): string | null {
  return request.headers.get('x-workspace-id');
}

/**
 * Admin-only route guard
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | undefined> {
  const authResult = await authenticateRequest(request, {
    requireAuth: true,
    requireAdmin: true,
  });

  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error || 'Admin access required' },
      { status: 403 }
    );
  }

  return undefined; // Continue processing
}

/**
 * Scope-based route guard
 */
export async function requireScopes(
  request: NextRequest,
  requiredScopes: string[]
): Promise<NextResponse | undefined> {
  const authResult = await authenticateRequest(request, {
    requireAuth: true,
    requiredScopes,
    allowApiKey: true,
  });

  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: authResult.error || 'Authentication required' },
      { status: 401 }
    );
  }

  return undefined; // Continue processing
}

export default {
  authenticateRequest,
  hasAnyAuth,
  getUserIdFromRequest,
  getWorkspaceIdFromRequest,
  requireAdmin,
  requireScopes,
  createAuthMiddleware,
};
