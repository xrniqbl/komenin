/**
 * Health Check System
 *
 * Comprehensive health monitoring for the entire application stack.
 * Tracks database, cache, external services, and system resources.
 */

import { PrismaClient } from '@prisma/client';
import { metrics } from './metrics';

const prisma = new PrismaClient();

// ========================================
// HEALTH STATUS TYPES
// ========================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  checks: Record<string, CheckResult>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export interface CheckResult {
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  error?: string;
  details?: unknown;
}

// ========================================
// HEALTH CHECK DEFINITIONS
// ========================================

interface HealthChecker {
  name: string;
  check: () => Promise<CheckResult>;
  critical: boolean;
}

// ========================================
// DATABASE CHECKER
// ========================================

class DatabaseHealthChecker implements HealthChecker {
  name = 'database';
  critical = true;

  async check(): Promise<CheckResult> {
    const start = Date.now();

    try {
      await prisma.$queryRaw`SELECT 1`;

      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latencyMs: latency,
        message: 'Database connection successful',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: (error as Error).message,
        message: 'Database connection failed',
      };
    }
  }
}

// ========================================
// WORKSPACE COUNT CHECKER
// ========================================

class WorkspaceCountChecker implements HealthChecker {
  name = 'workspace_counts';
  critical = false; // Warning only

  async check(): Promise<CheckResult> {
    try {
      const count = await prisma.workspace.count();

      if (count === 0) {
        return {
          status: 'degraded',
          message: 'No workspaces found - may be misconfigured or new deployment',
          details: { count },
        };
      }

      return {
        status: 'healthy',
        message: 'Workspace count OK',
        details: { count },
      };
    } catch (error) {
      return {
        status: 'degraded',
        error: (error as Error).message,
        message: 'Failed to count workspaces',
      };
    }
  }
}

// ========================================
// SYSTEM MEMORY CHECKER
// ========================================

class MemoryHealthChecker implements HealthChecker {
  name = 'system_memory';
  critical = false;

  async check(): Promise<CheckResult> {
    try {
      if (!process.memoryUsage) {
        return {
          status: 'degraded',
          message: 'Node.js memory API not available',
        };
      }

      const memoryUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memoryUsage.heapUsed / (1024 * 1024));
      const heapTotalMB = Math.round(memoryUsage.heapTotal / (1024 * 1024));

      // Alert if using more than 80% of heap
      const utilization = heapUsedMB / heapTotalMB;

      if (utilization > 0.8) {
        return {
          status: 'degraded',
          message: 'High memory utilization',
          details: {
            heapUsedMB,
            heapTotalMB,
            utilization,
          },
        };
      }

      return {
        status: 'healthy',
        message: 'Memory usage normal',
        details: {
          heapUsedMB,
          heapTotalMB,
          utilization,
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        error: (error as Error).message,
        message: 'Failed to check memory',
      };
    }
  }
}

// ========================================
// EXTERNAL SERVICE CHECKER (Placeholder)
// ========================================

class ExternalServiceChecker implements HealthChecker {
  name = 'external_services';
  critical = false;

  async check(): Promise<CheckResult> {
    try {
      // Placeholder - in production, check payment gateway, email service, etc.
      return {
        status: 'healthy',
        message: 'External services check skipped (placeholder)',
        details: {
          services: [],
          note: 'Configure external service checks as needed',
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        error: (error as Error).message,
        message: 'Failed to check external services',
      };
    }
  }
}

// ========================================
// HEALTH MANAGER
// ========================================

export class HealthManager {
  private checkers: HealthChecker[] = [];
  private lastResult: HealthCheckResult | null = null;

  constructor() {
    this.initializeCheckers();
  }

  private initializeCheckers(): void {
    this.checkers = [
      new DatabaseHealthChecker(),
      new WorkspaceCountChecker(),
      new MemoryHealthChecker(),
      new ExternalServiceChecker(),
    ];
  }

  /**
   * Run all health checks
   */
  async runAllChecks(criticalOnly: boolean = false): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const results: Record<string, CheckResult> = {};
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;

    for (const checker of this.checkers) {
      // Skip non-critical if requested
      if (criticalOnly && !checker.critical) {
        continue;
      }

      const result = await checker.check();
      results[checker.name] = result;

      switch (result.status) {
        case 'healthy':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'unhealthy':
          unhealthy++;
          break;
      }
    }

    const total = healthy + degraded + unhealthy;

    // Determine overall status
    let overallStatus: HealthStatus = 'healthy';
    if (unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (degraded > 0) {
      overallStatus = 'degraded';
    }

    this.lastResult = {
      status: overallStatus,
      timestamp: new Date(startTime),
      checks: results,
      summary: {
        total,
        healthy,
        degraded,
        unhealthy,
      },
    };

    // Export metrics
    metrics.request.recordRequest(
      '/health',
      'GET',
      overallStatus === 'healthy' ? 200 : 503,
      Date.now() - startTime
    );

    console.log('[HEALTH CHECK] Completed:', {
      status: overallStatus,
      healthy,
      degraded,
      unhealthy,
      durationMs: Date.now() - startTime,
    });

    return this.lastResult;
  }

  /**
   * Get last health check result
   */
  getLastResult(): HealthCheckResult | null {
    return this.lastResult;
  }

  /**
   * Add custom health checker
   */
  addChecker(checker: HealthChecker): void {
    this.checkers.push(checker);
  }

  /**
   * Remove checker by name
   */
  removeChecker(name: string): void {
    this.checkers = this.checkers.filter(c => c.name !== name);
  }

  /**
   * Create Express/Fastify compatible middleware
   */
  createMiddleware(): (req: Request, res: Response) => void {
    return async (req: Request, res: Response) => {
      const health = req.query?.health as string;

      if (health === 'full') {
        const result = await this.runAllChecks(false);
        res.json(result);
      } else if (health === 'critical') {
        const result = await this.runAllChecks(true);
        res.json(result);
      } else {
        const result = await this.runAllChecks(true);

        if (result.status === 'healthy') {
          res.status(200).json({ status: 'ok' });
        } else {
          res.status(503).json({
            status: 'error',
            message: 'Service unavailable'
          });
        }
      }
    };
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

export const healthManager = new HealthManager();

// Export types
export type { HealthCheckResult, CheckResult, HealthChecker };

// Next.js route handler example
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const health = url.searchParams.get('health');

  try {
    const result = await healthManager.runAllChecks(health === 'critical');

    if (result.status === 'healthy') {
      return Response.json({ status: 'ok', ...result }, { status: 200 });
    } else {
      return Response.json(result, { status: 503 });
    }
  } catch (error) {
    console.error('[HEALTH ROUTE] Error:', error);
    return Response.json(
      { status: 'error', message: 'Health check failed' },
      { status: 500 }
    );
  }
}
