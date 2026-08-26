/**
 * API Key Management API v1
 *
 * Create, list, revoke API keys for workspace access.
 *
 * Endpoints:
 *   GET    /api/v1/api-keys          - List all API keys (workspace admin only)
 *   POST   /api/v1/api-keys          - Create new API key
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

// Utility imports
import { successResponse, errorResponse, handlePromise, BadRequestError, NotFoundError, ConflictError } from '@/lib/api-response';
import { validateInput } from '@/lib/validation';
import { APIKeyManager, PermissionValidator } from '@/lib/api-key-manager';
import { checkAuthRateLimit } from '@/lib/rate-limiter';
import { metrics } from '@/lib/metrics';

// Zod schemas
const createApiKeySchema = z.object({
  name: z.string().min(3).max(100),
  scopes: z.array(z.enum([
    'campaigns:read',
    'campaigns:write',
    'campaigns:delete',
    'listeners:read',
    'listeners:write',
    'leads:read',
    'leads:write',
    'posts:read',
    'posts:write',
    'comments:read',
    'comments:write',
    'billing:read',
    'admin:*',
  ])),
  expiresAt: z.string().optional(), // ISO date string
});

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // Rate limiting
  const rateCheck = checkAuthRateLimit(`api-keys:list:${ip}`);
  if (!rateCheck.allowed) {
    return errorResponse(new TooManyRequestsError('Too many requests'));
  }

  // TODO: Add authentication middleware integration
  // For now, mock auth context
  const mockWorkspaceId = 'ws_test_123';

  try {
    // Fetch API keys for workspace
    const apiKeyList = await prisma.apiKey.findMany({
      where: {
        workspaceId: mockWorkspaceId,
        isActive: true,
      },
      include: {
        _count: {
          select: { lastUsedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Sanitize output - remove hashed key and internal fields
    const sanitizedKeys = apiKeyList.map(key => ({
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes as string[],
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt?.toISOString() || null,
      expiresAt: key.expiresAt?.toISOString() || null,
      createdAt: key.createdAt.toISOString(),
    }));

    return successResponse({
      ok: true,
      data: sanitizedKeys,
      message: `${sanitizedKeys.length} API keys found`,
    });

  } catch (error) {
    console.error('[API KEYS LIST] Error:', error);
    metrics.request.recordRequest('/api/v1/api-keys', 'GET', 500, Date.now() - startTime);
    return errorResponse(new InternalServerError('Failed to fetch API keys'));
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // Strict rate limiting for creation
  const rateCheck = checkAuthRateLimit(`api-keys:create:${ip}`);
  if (!rateCheck.allowed && rateCheck.remaining === 0) {
    return errorResponse(new TooManyRequestsError(
      `Too many attempts. Retry after ${new Date(rateCheck.resetAt)}`
    ));
  }

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(new BadRequestError('Invalid JSON'));
  }

  // Validate input
  const validation = validateInput(body, createApiKeySchema);
  if (!validation.valid) {
    return errorResponse(new BadRequestError(validation.errors?.join(', ')));
  }

  // TODO: Full authentication & authorization checks

  const mockUserId = 'user_mock_123';
  const mockWorkspaceId = 'ws_test_123';

  try {
    // Check if any key with same name exists
    const existingKey = await prisma.apiKey.findFirst({
      where: {
        workspaceId: mockWorkspaceId,
        name: validation.data!.name,
      },
    });

    if (existingKey) {
      return errorResponse(new ConflictError('A key with this name already exists'));
    }

    // Generate API key
    const { rawKey, prefix, suffix } = APIKeyManager.generateKey(
      validation.data!.name,
      validation.data!.scopes,
      validation.data!.expiresAt ? new Date(validation.data!.expiresAt) : undefined
    );

    // Hash key for storage
    const hashedKey = APIKeyManager.hashKey(rawKey);

    // Create API key record
    const apiKey = await prisma.apiKey.create({
      data: {
        workspaceId: mockWorkspaceId,
        name: validation.data!.name,
        prefix,
        hashedKey,
        scopes: validation.data!.scopes,
        isActive: true,
        expiresAt: validation.data!.expiresAt ? new Date(validation.data!.expiresAt) : null,
        createdBy: mockUserId,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        isActive: true,
        createdAt: true,
        expiresAt: true,
        _count: {
          select: { lastUsedAt: true },
        },
      },
    });

    // IMPORTANT: Return raw key immediately (user cannot retrieve it later!)
    metrics.recordRequest('/api/v1/api-keys', 'POST', 201, Date.now() - startTime);

    return successResponse({
      ok: true,
      message: 'API key created successfully',
      data: {
        ...apiKey,
        rawKey, // Only returned once!
        warning: 'Store this key securely. It cannot be retrieved again.',
      },
    });

  } catch (error) {
    console.error('[CREATE API KEY] Error:', error);
    metrics.request.recordRequest('/api/v1/api-keys', 'POST', 500, Date.now() - startTime);

    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return errorResponse(new ConflictError('A key with this name already exists'));
      }
    }

    return errorResponse(new InternalServerError('Failed to create API key'));
  }
}

// DELETE /api/v1/api-keys/:id
export async function DELETE(
  request: NextRequest,
  context: Context
): Promise<Response> {
  if (!context.params?.id) {
    return errorResponse(new NotFoundError('API key ID required'));
  }

  const apiKeyId = context.params.id;

  // TODO: Add authentication & workspace ownership verification

  try {
    // Soft delete - set inactive instead of hard delete
    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        isActive: false,
      },
    });

    return successResponse({
      ok: true,
      message: 'API key revoked successfully',
    });

  } catch (error) {
    console.error('[DELETE API KEY] Error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return errorResponse(new NotFoundError('API key not found'));
    }

    return errorResponse(new InternalServerError('Failed to revoke API key'));
  }
}

interface Context {
  params?: Record<string, string>;
}

// PATCH /api/v1/api-keys/:id
export async function PATCH(
  request: NextRequest,
  context: Context
): Promise<Response> {
  if (!context.params?.id) {
    return errorResponse(new NotFoundError('API key ID required'));
  }

  const apiKeyId = context.params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(new BadRequestError('Invalid JSON'));
  }

  // Allowed update fields
  const allowedFields = ['name'];

  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  // Also allow scope updates
  if (body.scopes && Array.isArray(body.scopes)) {
    const validation = validateInput(
      { scopes: body.scopes },
      z.object({
        scopes: z.array(z.enum([
          'campaigns:read',
          'campaigns:write',
          'listeners:read',
          'leads:read',
          'leads:write',
          'posts:read',
          'comments:read',
          'admin:*',
        ])).min(1),
      })
    );

    if (validation.valid) {
      updateData.scopes = body.scopes;
    } else {
      return errorResponse(new BadRequestError('Invalid scopes'));
    }
  }

  if (Object.keys(updateData).length === 0) {
    return errorResponse(new BadRequestError('No valid fields to update'));
  }

  try {
    // Verify key exists
    const existingKey = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!existingKey) {
      return errorResponse(new NotFoundError('API key not found'));
    }

    // Update key
    const updatedKey = await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: updateData,
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return successResponse({
      ok: true,
      message: 'API key updated successfully',
      data: updatedKey,
    });

  } catch (error) {
    console.error('[UPDATE API KEY] Error:', error);
    return errorResponse(new InternalServerError('Failed to update API key'));
  }
}
