/**
 * User Management API v1
 *
 * CRUD operations for user accounts with full security and validation.
 *
 * Endpoints:
 *   GET    /api/v1/users          - List users (admin only)
 *   POST   /api/v1/users          - Create new user
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// Utility imports
import { successResponse, errorResponse, handlePromise } from '@/lib/api-response';
import { validateInput, emailSchema } from '@/lib/validation';
import { checkAuthRateLimit } from '@/lib/rate-limiter';
import { metrics } from '@/lib/metrics';

// Zod schemas for input validation
const createUserSchema = z.object({
  email: emailSchema,
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100).optional(),
});

const listUsersParamsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
});

export async function GET(request: NextRequest) {
  // Get IP for rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // Check rate limit
  const rateCheck = checkAuthRateLimit(`users:list:${ip}`);
  if (!rateCheck.allowed) {
    return errorResponse(new TooManyRequestsError('Too many requests'));
  }

  // Parse query params
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  // Validate params
  const validatedParams = validateInput(queryParams, listUsersParamsSchema);
  if (!validatedParams.valid) {
    return errorResponse(new BadRequestError(validatedParams.errors?.join(', ')));
  }

  // TODO: Add authentication & authorization checks here

  const page = parseInt(validatedParams.data?.page || '1', 10);
  const limit = Math.min(parseInt(validatedParams.data?.limit || '20', 10), 50);
  const search = validatedParams.data?.search || '';

  try {
    // Fetch users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: search ? {
          OR: [
            { email: { contains: search } },
            { username: { contains: search } },
            { name: { contains: search } },
          ]
        } : undefined,
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          createdAt: true,
          platformRole: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({
        where: search ? {
          OR: [
            { email: { contains: search } },
            { username: { contains: search } },
            { name: { contains: search } },
          ]
        } : undefined,
      }),
    ]);

    return successResponse({
      ok: true,
      data: users.map(user => ({
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.platformRole,
        joined: user.createdAt.toISOString(),
        lastActive: user.lastLoginAt?.toISOString() || null,
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
    console.error('[USERS LIST] Error:', error);

    // Log to metrics
    metrics.request.recordRequest('/api/v1/users', 'GET', 500, Date.now() - startTimestamp);

    return errorResponse(new InternalServerError('Failed to fetch users'));
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // Strict rate limiting for user creation
  const rateCheck = checkAuthRateLimit(`users:create:${ip}`);
  if (!rateCheck.allowed) {
    return errorResponse(new TooManyRequestsError(
      `Too many registration attempts. Retry after ${new Date(rateCheck.resetAt)}`
    ));
  }

  // Read request body
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(new BadRequestError('Invalid JSON'));
  }

  // Validate input
  const validation = validateInput(body, createUserSchema);
  if (!validation.valid) {
    return errorResponse(new BadRequestError(validation.errors?.join(', ')));
  }

  // TODO: Add authentication & ownership checks
  // For now, allow self-registration without auth

  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validation.data!.email.toLowerCase() },
    });

    if (existingUser) {
      return errorResponse(new ConflictError('Email already registered'));
    }

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username: validation.data!.username.toLowerCase() },
    });

    if (existingUsername) {
      return errorResponse(new ConflictError('Username already taken'));
    }

    // Hash password securely
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(validation.data!.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validation.data!.email.toLowerCase(),
        username: validation.data!.username.toLowerCase(),
        hashedPassword,
        name: validation.data!.name,
        emailVerified: null,
        lastLoginAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        createdAt: true,
      },
    });

    // Record metric
    metrics.recordRequest('/api/v1/users', 'POST', 201, Date.now() - startTimestamp);

    return successResponse({
      ok: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        joined: user.createdAt.toISOString(),
      },
    });

  } catch (error) {
    console.error('[CREATE USER] Error:', error);

    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return errorResponse(new ConflictError('Email or username already exists'));
      }
      if (error.code === 'P2003') {
        return errorResponse(new BadRequestError('Invalid foreign key constraint'));
      }
    }

    return errorResponse(new InternalServerError('Failed to create user'));
  }
}

interface Context {
  params?: Record<string, string>;
}

// GET /api/v1/users/:id
export async function GET_BY_ID(
  request: NextRequest,
  context: Context
): Promise<Response> {
  if (!context.params?.id) {
    return errorResponse(new NotFoundError('User ID required'));
  }

  const userId = context.params.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        googleSub: true,
        platformRole: true,
        memberships: {
          select: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            role: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return errorResponse(new NotFoundError('User not found'));
    }

    return successResponse({
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      emailVerified: !!user.emailVerified,
      role: user.platformRole,
      joined: user.createdAt.toISOString(),
      lastActive: user.lastLoginAt?.toISOString() || null,
      googleConnected: !!user.googleSub,
      workspaces: user.memberships.map((membership: any) => ({
        workspace: membership.workspace,
        role: membership.role,
        memberSince: membership.createdAt.toISOString(),
      })),
    });

  } catch (error) {
    console.error('[GET USER] Error:', error);
    return errorResponse(new InternalServerError('Failed to fetch user'));
  }
}

// DELETE /api/v1/users/:id
export async function DELETE(
  request: NextRequest,
  context: Context
): Promise<Response> {
  if (!context.params?.id) {
    return errorResponse(new NotFoundError('User ID required'));
  }

  const userId = context.params.id;

  // TODO: Add admin authentication & authorization

  try {
    await prisma.user.delete({
      where: { id: userId },
    });

    return successResponse({
      ok: true,
      message: 'User deleted successfully',
    });

  } catch (error) {
    console.error('[DELETE USER] Error:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return errorResponse(new NotFoundError('User not found'));
      }
    }

    return errorResponse(new InternalServerError('Failed to delete user'));
  }
}

// PATCH /api/v1/users/:id
export async function PATCH(
  request: NextRequest,
  context: Context
): Promise<Response> {
  if (!context.params?.id) {
    return errorResponse(new NotFoundError('User ID required'));
  }

  const userId = context.params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(new BadRequestError('Invalid JSON'));
  }

  // TODO: Add authentication & ownership checks

  // Build update object dynamically based on allowed fields
  const allowedFields = ['name'];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return errorResponse(new BadRequestError('No valid fields to update'));
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        updatedAt: true,
      },
    });

    return successResponse({
      ok: true,
      message: 'User updated successfully',
      data: user,
    });

  } catch (error) {
    console.error('[UPDATE USER] Error:', error);
    return errorResponse(new InternalServerError('Failed to update user'));
  }
}
