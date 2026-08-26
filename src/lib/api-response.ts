/**
 * API Response Utilities
 *
 * Standardized response handling for consistent, secure API responses.
 */

import { NextResponse } from 'next/server';

// ========================================
// HTTP STATUS CONSTANTS
// ========================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ========================================
// ERROR CLASSES
// ========================================

export class APIError extends Error {
  public status: number;
  public code: string;
  public details?: unknown;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: unknown
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'APIError';
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      status: this.status,
      ...(this.details !== undefined && this.details !== null
        ? { details: this.details as object }
        : {}),
    };
  }
}

export class BadRequestError extends APIError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details?: unknown) {
    super(message, HTTP_STATUS.BAD_REQUEST, code, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends APIError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED', details?: unknown) {
    super(message, HTTP_STATUS.UNAUTHORIZED, code, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends APIError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN', details?: unknown) {
    super(message, HTTP_STATUS.FORBIDDEN, code, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends APIError {
  constructor(message = 'Not found', code = 'NOT_FOUND', details?: unknown) {
    super(message, HTTP_STATUS.NOT_FOUND, code, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends APIError {
  constructor(message = 'Conflict', code = 'CONFLICT', details?: unknown) {
    super(message, HTTP_STATUS.CONFLICT, code, details);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends APIError {
  constructor(message = 'Too many requests', code = 'RATE_LIMITED', details?: unknown) {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, code, details);
    this.name = 'TooManyRequestsError';
  }
}

export class InternalServerError extends APIError {
  constructor(message = 'Internal server error', code = 'INTERNAL_ERROR', details?: unknown) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, code, details);
    this.name = 'InternalServerError';
  }
}

// ========================================
// RESPONSE HELPERS
// ========================================

interface ApiResponseOptions {
  data?: unknown;
  error?: string | APIError;
  status?: number;
  headers?: Record<string, string>;
  message?: string;
}

/**
 * Create successful response
 */
export function successResponse<T>(data: T, message?: string, extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  const body = {
    ok: true,
    message,
    data,
  };

  return NextResponse.json(body, { status: HTTP_STATUS.OK, headers });
}

/**
 * Created response (for POST operations)
 */
export function createdResponse<T>(data: T, location?: string, extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (location) {
    headers['Location'] = location;
  }

  const body = {
    ok: true,
    message: 'Resource created successfully',
    data,
  };

  return NextResponse.json(body, { status: HTTP_STATUS.CREATED, headers });
}

/**
 * No content response (for DELETE/UPDATE that don't return data)
 */
export function noContentResponse(extraHeaders?: Record<string, string>): NextResponse<null> {
  return NextResponse.json(null, {
    status: HTTP_STATUS.NO_CONTENT,
    headers: extraHeaders,
  });
}

/**
 * Error response
 */
export function errorResponse(
  error: string | APIError,
  extraHeaders?: Record<string, string>
): NextResponse<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  let errorBody;

  if (error instanceof APIError) {
    errorBody = error.toJSON();
  } else {
    errorBody = {
      error,
      code: 'UNKNOWN_ERROR',
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    };
  }

  return NextResponse.json(errorBody, {
    status: error instanceof APIError ? error.status : HTTP_STATUS.INTERNAL_SERVER_ERROR,
    headers,
  });
}

/**
 * Handle promise rejection consistently
 */
export async function handlePromise<T>(
  promise: Promise<T>,
  successHandler: (data: T) => NextResponse | Promise<NextResponse>,
  errorHandler: (error: Error) => NextResponse = (error: Error) => {
    console.error('Unhandled error:', error);
    return errorResponse('An unexpected error occurred');
  }
): Promise<NextResponse> {
  try {
    const data = await promise;
    return await successHandler(data);
  } catch (error) {
    // Check if it's an APIError
    if (error instanceof APIError) {
      return errorResponse(error);
    }

    // Check if it's a known error type
    const name = (error as Error).name;
    if (name === 'ZodError' || name === 'ParseError') {
      return errorResponse(new BadRequestError('Invalid input'));
    }

    if (name === 'PrismaClientKnownRequestError') {
      return errorResponse(new InternalServerError('Database error occurred'));
    }

    // Unknown error
    return errorHandler(error as Error);
  }
}

// ========================================
// PAGINATION HELPERS
// ========================================

interface PaginatedResponse<T> {
  ok: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function getPaginationParams(params: Record<string, string | string[]>): PaginationParams {
  const page = parseInt((params.page as string) || '1', 10);
  const limit = parseInt((params.limit as string) || '20', 10);

  return {
    page: Math.max(1, page),
    limit: Math.min(Math.max(1, limit), 100), // Max 100 items per page
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  paginationParams: PaginationParams,
  total: number
): PaginatedResponse<T> {
  const limit = paginationParams.limit ?? 20;
  const page = paginationParams.page ?? 1;
  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;

  return {
    ok: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore,
    },
  };
}

// ========================================
// METADATA
// ========================================

interface RequestMetadata {
  requestId?: string;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
}

export function extractRequestMetadata(request: Request): RequestMetadata {
  return {
    requestId: request.headers.get('x-request-id') || undefined,
    timestamp: new Date(),
    userAgent: request.headers.get('user-agent') || undefined,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
  };
}

// ========================================
// EXPORT DEFAULT
// ========================================

export default {
  success: successResponse,
  created: createdResponse,
  noContent: noContentResponse,
  error: errorResponse,
  handlePromise,
  createPaginatedResponse,
  getPaginationParams,
};

// Export remaining types (PaginationParams is already exported at declaration)
export type { PaginatedResponse };
