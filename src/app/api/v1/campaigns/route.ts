/**
 * Campaign Management API v1
 *
 * Full CRUD operations for social media campaigns with authentication,
 * validation, and rate limiting.
 *
 * Endpoints:
 *   GET    /api/v1/campaigns          - List campaigns (paginated)
 *   POST   /api/v1/campaigns          - Create new campaign
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

// Import utilities
import { successResponse, errorResponse, handlePromise, BadRequestError, ConflictError, UnauthorizedError, ForbiddenError } from '@/lib/api-response';
import { validateInput, campaignSchema } from '@/lib/validation';
import { checkAuthRateLimit, defaultRateLimiter } from '@/lib/rate-limiter';
import { metrics } from '@/lib/metrics';
import { authenticateRequest, AuthContext } from '@/middleware/auth-middleware';
import { getPrismaClient } from '@/lib/db-client';

const prisma = new PrismaClient();

// Validation schemas
const createCampaignSchema = z.object({
  name: z.string().min(3).max(100),
  platform: z.enum(['instagram', 'threads', 'tiktok']),
  dailyLimit: z.number().int().positive().max(100),
  minDelaySec: z.number().int().positive(),
  maxDelaySec: z.number().int().positive(),
  agentId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
});

const listCampaignsParams = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed']).optional(),
});

// Helper function to validate authentication
async function verifyAuthentication(request: NextRequest): Promise<{
  success: boolean;
  context?: AuthContext;
  response?: Response;
}> {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // Rate limit auth attempts
  const rateCheck = checkAuthRateLimit(`campaigns:${ip}`);
  if (!rateCheck.allowed) {
    return {
      success: false,
      response: errorResponse(new TooManyRequestsError('Too many requests')),
    };
  }

  // Authenticate user
  const authResult = await authenticateRequest(request, { requireAuth: true });

  if (!authResult.authenticated) {
    return {
      success: false,
      response: errorResponse(new UnauthorizedError(authResult.error)),
    };
  }

  return {
    success: true,
    context: authResult.context!,
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authentication first
    const authCheck = await verifyAuthentication(request);
    if (!authCheck.success) {
      metrics.recordRequest('/api/v1/campaigns', 'GET', authCheck.response!.status, Date.now() - startTime);
      return authCheck.response!;
    }

    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Validate query params
    const validation = validateInput(queryParams, listCampaignsParams);
    if (!validation.valid) {
      return errorResponse(new BadRequestError(validation.errors?.join(', ')));
    }

    const page = parseInt(validation.data?.page || '1', 10);
    const limit = Math.min(parseInt(validation.data?.limit || '20', 10), 50);
    const status = validation.data?.status;
    const workspaceId = authCheck.context?.workspaceId || '';

    // Fetch campaigns with pagination
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where: {
          workspaceId,
          ...(status && { status }),
        },
        include: {
          agent: true,
          client: true,
          accounts: {
            include: {
              socialAccount: true,
            },
          },
          _count: {
            select: { listeners: true, targetPosts: true, drafts: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.campaign.count({
        where: {
          workspaceId,
          ...(status && { status }),
        },
      }),
    ]);

    metrics.recordRequest('/api/v1/campaigns', 'GET', 200, Date.now() - startTime);

    return successResponse({
      ok: true,
      data: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        platform: c.platform,
        mode: c.mode,
        status: c.status,
        dailyLimit: c.dailyLimit,
        minDelaySec: c.minDelaySec,
        maxDelaySec: c.maxDelaySec,
        agent: c.agent ? {
          id: c.agent.id,
          name: c.agent.name,
          tone: c.agent.tone,
        } : null,
        client: c.client ? {
          id: c.client.id,
          name: c.client.name,
        } : null,
        accountsCount: c.accounts.length,
        stats: c._count,
        createdAt: c.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });

  } catch (error) {
    console.error('[CAMPAIGNS LIST] Error:', error);
    metrics.recordRequest('/api/v1/campaigns', 'GET', 500, Date.now() - startTime);

    return errorResponse(new InternalServerError('Failed to fetch campaigns'));
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // Strict rate limiting for creation
  const rateCheck = checkAuthRateLimit(`campaigns:create:${ip}`);
  if (!rateCheck.allowed) {
    return errorResponse(new TooManyRequestsError('Too many campaign creation attempts'));
  }

  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse(new BadRequestError('Invalid JSON body'));
    }

    // Authenticate user
    const authCheck = await verifyAuthentication(request);
    if (!authCheck.success) {
      metrics.recordRequest('/api/v1/campaigns', 'POST', authCheck.response!.status, Date.now() - startTime);
      return authCheck.response!;
    }

    // Validate input
    const validation = validateInput(body, createCampaignSchema);
    if (!validation.valid) {
      return errorResponse(new BadRequestError(validation.errors?.join(', ')));
    }

    // Check if agent exists (if provided)
    if (validation.data?.agentId) {
      const agentExists = await prisma.agent.findUnique({
        where: { id: validation.data.agentId },
      });

      if (!agentExists) {
        return errorResponse(new NotFoundError('Agent not found'));
      }
    }

    // Check if client exists (if provided)
    if (validation.data?.clientId) {
      const clientExists = await prisma.clientProfile.findUnique({
        where: { id: validation.data.clientId },
      });

      if (!clientExists) {
        return errorResponse(new NotFoundError('Client profile not found'));
      }
    }

    // Create campaign
    const campaign = await prisma.campaign.create({
      data: {
        ...validation.data,
        workspaceId: authCheck.context.workspaceId!,
        status: 'draft',
        mode: 'approval_required',
      },
      include: {
        agent: true,
        client: true,
      },
    });

    metrics.recordRequest('/api/v1/campaigns', 'POST', 201, Date.now() - startTime);

    return successResponse({
      ok: true,
      message: 'Campaign created successfully',
      data: {
        id: campaign.id,
        name: campaign.name,
        platform: campaign.platform,
        status: campaign.status,
        mode: campaign.mode,
        dailyLimit: campaign.dailyLimit,
        createdAt: campaign.createdAt.toISOString(),
      },
    });

  } catch (error) {
    console.error('[CREATE CAMPAIGN] Error:', error);
    metrics.recordRequest('/api/v1/campaigns', 'POST', 500, Date.now() - startTime);

    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return errorResponse(new BadRequestError('Invalid foreign key reference'));
      }
    }

    return errorResponse(new InternalServerError('Failed to create campaign'));
  }
}

interface Context {
  params?: Record<string, string>;
}

// GET /api/v1/campaigns/:id
export async function GET_BY_ID(
  request: NextRequest,
  context: Context
): Promise<Response> {
  if (!context.params?.id) {
    return errorResponse(new BadRequestError('Campaign ID required'));
  }

  const campaignId = context.params.id;

  try {
    // Authenticate
    const authCheck = await verifyAuthentication(request);
    if (!authCheck.success) return authCheck.response!;

    // Get full campaign details
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        agent: true,
        client: true,
        accounts: {
          include: {
            socialAccount: true,
          },
        },
        listeners: true,
        targetPosts: {
          take: 10,
          orderBy: { discoveredAt: 'desc' },
        },
        drafts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            accounts: true,
            listeners: true,
            targetPosts: true,
            drafts: true,
            approvals: true,
          },
        },
      },
    });

    if (!campaign) {
      return errorResponse(new NotFoundError('Campaign not found'));
    }

    // Verify ownership
    if (campaign.workspaceId !== authCheck.context?.workspaceId) {
      return errorResponse(new ForbiddenError('Access denied'));
    }

    metrics.recordRequest(`/api/v1/campaigns/${campaignId}`, 'GET', 200, Date.now() - startTimestamp);

    return successResponse({
      id: campaign.id,
      name: campaign.name,
      platform: campaign.platform,
      mode: campaign.mode,
      status: campaign.status,
      dailyLimit: campaign.dailyLimit,
      minDelaySec: campaign.minDelaySec,
      maxDelaySec: campaign.maxDelaySec,
      goal: campaign.goal,
      agent: campaign.agent,
      client: campaign.client,
      accounts: campaign.accounts.map((a: any) => ({
        id: a.socialAccountId,
        username: a.socialAccount.username,
        displayName: a.socialAccount.displayName,
        platform: a.socialAccount.platform,
      })),
      listenersCount: campaign._count.listeners,
      postsCount: campaign._count.targetPosts,
      draftsCount: campaign._count.drafts,
      createdAt: campaign.createdAt.toISOString(),
    });

  } catch (error) {
    console.error('[GET CAMPAIGN] Error:', error);
    return errorResponse(new InternalServerError('Failed to fetch campaign'));
  }
}

// PATCH /api/v1/campaigns/:id
export async function PATCH(
  request: NextRequest,
  context: Context
): Promise<Response> {
  if (!context.params?.id) {
    return errorResponse(new BadRequestError('Campaign ID required'));
  }

  const campaignId = context.params.id;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse(new BadRequestError('Invalid JSON'));
    }

    // Authenticate
    const authCheck = await verifyAuthentication(request);
    if (!authCheck.success) return authCheck.response!;

    // Check if campaign exists and belongs to user's workspace
    const existingCampaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: authCheck.context!.workspaceId! },
    });

    if (!existingCampaign) {
      return errorResponse(new NotFoundError('Campaign not found'));
    }

    // Build update object
    const allowedFields = ['name', 'dailyLimit', 'minDelaySec', 'maxDelaySec'];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse(new BadRequestError('No valid fields to update'));
    }

    // Update campaign
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
      select: {
        id: true,
        name: true,
        dailyLimit: true,
        minDelaySec: true,
        maxDelaySec: true,
        updatedAt: true,
      },
    });

    return successResponse({
      ok: true,
      message: 'Campaign updated successfully',
      data: updatedCampaign,
    });

  } catch (error) {
    console.error('[UPDATE CAMPAIGN] Error:', error);
    return errorResponse(new InternalServerError('Failed to update campaign'));
  }
}

// DELETE /api/v1/campaigns/:id
export async function DELETE(
  request: NextRequest,
  context: Context
): Promise<Response> {
  if (!context.params?.id) {
    return errorResponse(new BadRequestError('Campaign ID required'));
  }

  const campaignId = context.params.id;

  try {
    // Authenticate
    const authCheck = await verifyAuthentication(request);
    if (!authCheck.success) return authCheck.response!;

    // Delete campaign (soft delete not implemented yet)
    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    return successResponse({
      ok: true,
      message: 'Campaign deleted successfully',
    });

  } catch (error) {
    console.error('[DELETE CAMPAIGN] Error:', error);
    return errorResponse(new InternalServerError('Failed to delete campaign'));
  }
}
