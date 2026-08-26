/**
 * API Key Management System
 *
 * Secure generation, validation, and management of API keys for workspaces.
 * Provides granular permission scopes and rotation support.
 */

import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ========================================
// API KEY SCOPES
// ========================================

export type APIScope =
  | 'campaigns:read'
  | 'campaigns:write'
  | 'campaigns:delete'
  | 'listeners:read'
  | 'listeners:write'
  | 'leads:read'
  | 'leads:write'
  | 'posts:read'
  | 'posts:write'
  | 'comments:read'
  | 'comments:write'
  | 'billing:read'
  | 'admin:*';

interface ScopeDefinition {
  description: string;
  requiresAdmin?: boolean;
}

export const SCOPE_DEFINITIONS: Record<APIScope, ScopeDefinition> = {
  'campaigns:read': { description: 'Read access to campaigns' },
  'campaigns:write': { description: 'Create and update campaigns', requiresAdmin: true },
  'campaigns:delete': { description: 'Delete campaigns', requiresAdmin: true },
  'listeners:read': { description: 'Read access to listeners' },
  'listeners:write': { description: 'Create and update listeners' },
  'leads:read': { description: 'Read access to leads' },
  'leads:write': { description: 'Create and update leads' },
  'posts:read': { description: 'Read access to social posts' },
  'posts:write': { description: 'Publish social posts' },
  'comments:read': { description: 'Read access to comments' },
  'comments:write': { description: 'Post comments' },
  'billing:read': { description: 'View billing information', requiresAdmin: true },
  'admin:*': { description: 'Full administrative access', requiresAdmin: true },
};

// ========================================
// KEY GENERATION
// ========================================

export class APIKeyManager {
  static readonly PREFIX = 'aeth_';
  static readonly KEY_LENGTH = 32; // bytes
  static readonly NAME_MAX_LENGTH = 100;

  /**
   * Generate a new API key with optional expiration
   */
  static generateKey(
    name: string,
    scopes: APIScope[],
    expiresAt?: Date
  ): {
    rawKey: string;
    prefix: string;
    suffix: string;
  } {
    // Validate input
    if (!name || name.length < 3) {
      throw new Error('API key name must be at least 3 characters');
    }

    if (name.length > this.NAME_MAX_LENGTH) {
      throw new Error(`API key name must be less than ${this.NAME_MAX_LENGTH} characters`);
    }

    // Generate random bytes
    const rawBytes = crypto.randomBytes(this.KEY_LENGTH);
    const suffix = rawBytes.toString('base64url');

    // Combine with prefix
    return {
      rawKey: `${this.PREFIX}${suffix}`,
      prefix: this.PREFIX,
      suffix,
    };
  }

  /**
   * Extract suffix from full key for validation
   */
  static extractSuffix(key: string): string | null {
    if (!key.startsWith(this.PREFIX)) {
      return null;
    }

    const suffix = key.slice(this.PREFIX.length);
    if (suffix.length !== this.KEY_LENGTH * 2 / 3) {
      return null; // Invalid length
    }

    return suffix;
  }

  /**
   * Hash API key for storage (one-way)
   */
  static hashKey(sanitizedKey: string): string {
    const buffer = Buffer.from(sanitizedKey, 'utf8');
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Verify API key format before database lookup
   */
  static isValidFormat(key: string): boolean {
    if (!key || !key.startsWith(this.PREFIX)) return false;

    const suffix = this.extractSuffix(key);
    return suffix !== null && /^[A-Za-z0-9_-]+$/.test(suffix);
  }
}

// ========================================
// PERMISSION VALIDATION
// ========================================

interface PermissionContext {
  apiKeyId: string;
  workspaceId: string;
  requestedScopes: APIScope[];
  userId?: string;
  action?: string;
  resource?: string;
}

export class PermissionValidator {
  /**
   * Check if user has required scopes
   */
  static async validatePermissions(
    context: PermissionContext
  ): Promise<{
    valid: boolean;
    missingScopes?: APIScope[];
    error?: string;
  }> {
    try {
      // Fetch API key from database
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: context.apiKeyId },
        include: { workspace: true },
      });

      if (!apiKey) {
        return {
          valid: false,
          error: 'Invalid API key',
        };
      }

      // Verify workspace match
      if (apiKey.workspaceId !== context.workspaceId) {
        return {
          valid: false,
          error: 'API key does not belong to this workspace',
        };
      }

      // Check if key is active
      if (!apiKey.isActive) {
        return {
          valid: false,
          error: 'API key is disabled',
        };
      }

      // Check expiration
      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        return {
          valid: false,
          error: 'API key has expired',
        };
      }

      // If admin scope, allow everything
      if (apiKey.scopes.includes('admin:*')) {
        return { valid: true };
      }

      // Check each requested scope
      const missingScopes: APIScope[] = [];
      const requiredScopes = context.requestedScopes;

      for (const scope of requiredScopes) {
        const hasScope = apiKey.scopes.some(apiScope =>
          apiScope === scope ||
          apiScope === '*' ||
          this.scopeMatches(apiScope, scope)
        );

        if (!hasScope) {
          missingScopes.push(scope);
        }
      }

      if (missingScopes.length > 0) {
        return {
          valid: false,
          missingScopes,
          error: `Missing scopes: ${missingScopes.join(', ')}`,
        };
      }

      // Log successful permission check
      await this.logPermissionCheck(context, apiKey.id, true, null);

      return { valid: true };

    } catch (error) {
      console.error('Permission validation error:', error);

      // Log failed check
      await this.logPermissionCheck(context, context.apiKeyId, false, error);

      return {
        valid: false,
        error: 'Permission validation failed',
      };
    }
  }

  /**
   * Check if two scopes match
   */
  private static scopeMatches(grantedScope: string, requestedScope: string): boolean {
    const [grantedResource, grantedAction] = grantedScope.split(':');
    const [requestedResource, requestedAction] = requestedScope.split(':');

    if (!grantedResource || !requestedResource) return false;
    if (grantedResource !== requestedResource) return false;
    if (grantedAction === '*') return true;
    if (grantedAction === requestedAction) return true;

    return false;
  }

  /**
   * Log permission check attempt for auditing
   */
  private static async logPermissionCheck(
    context: PermissionContext,
    apiKeyId: string,
    success: boolean,
    error: Error | null
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          workspaceId: context.workspaceId,
          actorUserId: context.userId || undefined,
          action: success ? 'api_key_permission_granted' : 'api_key_permission_denied',
          resourceType: 'api_key',
          resourceId: apiKeyId,
          metadata: {
            requested_scopes: context.requestedScopes,
            action: context.action,
            resource: context.resource,
            error: error?.message,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (logError) {
      console.error('Failed to log permission check:', logError);
    }
  }
}

// ========================================
// MIDDLEWARE INTEGRATION
// ========================================

/**
 * Middleware decorator for API route handlers
 * Automatically validates API key and permissions
 */
export interface AuthenticatedRequest extends Request {
  auth?: {
    apiKeyId: string;
    apiKeyPrefix: string;
    scopes: APIScope[];
    workspaceId: string;
  };
}

export async function authenticateAPIKey(
  request: AuthenticatedRequest
): Promise<{
  authenticated: boolean;
  apiKeyId?: string;
  apiKeyPrefix?: string;
  scopes?: APIScope[];
  workspaceId?: string;
  error?: string;
}> {
  const apiKeyHeader = request.headers.get('x-api-key');
  const authorizationHeader = request.headers.get('authorization');

  let apiKey: string | null = null;

  // Check both header options
  if (apiKeyHeader && !apiKeyHeader.startsWith('Bearer ')) {
    apiKey = apiKeyHeader;
  } else if (authorizationHeader?.startsWith('Bearer ')) {
    apiKey = authorizationHeader.slice(7);
  }

  if (!apiKey) {
    return {
      authenticated: false,
      error: 'API key required',
    };
  }

  // Validate format
  if (!APIKeyManager.isValidFormat(apiKey)) {
    return {
      authenticated: false,
      error: 'Invalid API key format',
    };
  }

  try {
    // Extract suffix and hash for DB lookup
    const suffix = APIKeyManager.extractSuffix(apiKey)!;
    const hashedKey = APIKeyManager.hashKey(`${APIKeyManager.PREFIX}${suffix}`);

    // Find API key in database
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        isActive: true,
        OR: [
          { prefixed: apiKey },
          { hashedKey }, // For compatibility with old systems
        ],
      },
      include: { workspace: true },
    });

    if (!apiKeyRecord) {
      return {
        authenticated: false,
        error: 'API key not found or inactive',
      };
    }

    // Check expiration
    if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
      return {
        authenticated: false,
        error: 'API key has expired',
      };
    }

    // Store auth info on request
    request.auth = {
      apiKeyId: apiKeyRecord.id,
      apiKeyPrefix: apiKeyRecord.prefix,
      scopes: apiKeyRecord.scopes as APIScope[],
      workspaceId: apiKeyRecord.workspaceId,
    };

    return {
      authenticated: true,
      apiKeyId: apiKeyRecord.id,
      apiKeyPrefix: apiKeyRecord.prefix,
      scopes: apiKeyRecord.scopes as APIScope[],
      workspaceId: apiKeyRecord.workspaceId,
    };

  } catch (error) {
    console.error('API key authentication error:', error);
    return {
      authenticated: false,
      error: 'Authentication system error',
    };
  }
}

// ========================================
// EXPORTS
// ========================================

export default {
  generateKey: APIKeyManager.generateKey,
  isValidFormat: APIKeyManager.isValidFormat,
  hashKey: APIKeyManager.hashKey,
  validatePermissions: PermissionValidator.validatePermissions,
  authenticateAPIKey,
  SCOPE_DEFINITIONS,
};

export type { PermissionContext };
