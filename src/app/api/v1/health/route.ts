/**
 * Health Check API Endpoint v1
 *
 * Provides comprehensive health status for monitoring systems.
 * Supports multiple query parameters for different levels of detail.
 */

import { NextRequest } from 'next/server';
import { healthManager } from '@/lib/health-check';
import { successResponse, errorResponse, NotFoundError } from '@/lib/api-response';
import { metrics } from '@/lib/metrics';

// GET /api/v1/health
// Query params:
//   - full: boolean (optional) - Include non-critical checks
//   - format: json | text (optional) - Response format (default: json)

interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: Record<string, HealthCheck>;
}

interface HealthCheck {
  status: string;
  latencyMs?: number;
  message?: string;
  error?: string;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const fullCheck = url.searchParams.get('full') === 'true';

    // Run health checks
    const result = await healthManager.runAllChecks(!fullCheck);

    // Log metrics
    metrics.request.recordRequest(
      '/api/v1/health',
      'GET',
      result.status === 'healthy' ? 200 : 503,
      Date.now() - startTime
    );

    // Prepare response
    if (result.status === 'healthy') {
      return successResponse({
        ok: true,
        status: 'ok',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: getUptimeString(),
        checks: Object.entries(result.checks).reduce((acc, [name, check]) => ({
          ...acc,
          [name]: {
            status: check.status,
            latencyMs: check.latencyMs,
            ...(check.message && { message: check.message }),
          },
        }), {} as HealthData['checks']),
      }, 'Service is healthy');
    } else {
      return Response.json(result, {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Status': result.status,
        },
      });
    }
  } catch (error) {
    console.error('[HEALTH CHECK] Error:', error);

    metrics.request.recordRequest(
      '/api/v1/health',
      'GET',
      500,
      Date.now() - startTime
    );

    return errorResponse(new InternalServerError('Health check failed'));
  }
}

/**
 * Calculate uptime since server start
 */
function getUptimeString(): string {
  // Get node.js uptime
  const uptimeSeconds = Math.floor(process.uptime());
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

// HEAD endpoint - quick health check without body
export async function HEAD(request: NextRequest) {
  const url = new URL(request.url);
  const fullCheck = url.searchParams.get('full') === 'true';

  try {
    const result = await healthManager.runAllChecks(!fullCheck);

    return new Response(null, {
      status: result.status === 'healthy' ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Status': result.status,
      },
    });
  } catch {
    return new Response(null, {
      status: 500,
    });
  }
}

// POST endpoint - trigger manual health check or restart
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  // Only allow authenticated admin requests
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // TODO: Validate admin token

  if (body.action === 'restart') {
    // Trigger graceful restart
    setTimeout(() => {
      process.exit(0);
    }, 1000);

    return Response.json({
      ok: true,
      message: 'Restart initiated'
    });
  }

  return Response.json(
    { error: 'Unknown action' },
    { status: 400 }
  );
}
