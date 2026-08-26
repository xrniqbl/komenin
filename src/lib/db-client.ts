/**
 * Database Client Factory
 *
 * Creates optimized Prisma clients with connection pooling,
 * query monitoring, and automatic retry logic.
 */

import { PrismaClient } from '@prisma/client';
import { dbManager } from './database-pool';
import { metrics } from './metrics';

// Singleton instance
let prismaClient: PrismaClient | null = null;

/**
 * Get Prisma client instance with optimizations
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    // Initialize new client
    prismaClient = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // Add instrumentation middleware
    prismaClient.$use(async (params, next) => {
      const startTime = Date.now();

      try {
        const result = await next(params);
        const duration = Date.now() - startTime;

        // Record metrics
        metrics.request.recordRequest(
          `/api/db/${params.model}/${params.action}`,
          params.action.toUpperCase(),
          200,
          duration
        );

        // Alert on slow queries
        if (duration > 1000) {
          console.warn(`[DB ALERT] Slow query: ${duration}ms - ${params.model}.${params.action}`);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        metrics.request.recordRequest(
          `/api/db/${params.model}/${params.action}`,
          params.action.toUpperCase(),
          500,
          duration
        );

        throw error;
      }
    });
  }

  return prismaClient;
}

/**
 * Close database connections gracefully
 */
export async function closeDatabaseConnections(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
    console.log('[DB] Connections closed gracefully');
  }
}

/**
 * Reconnect database if disconnected
 */
export async function reconnectDatabase(): Promise<void> {
  await closeDatabaseConnections();

  try {
    const client = getPrismaClient();
    await client.$connect();
    console.log('[DB] Database reconnected successfully');
  } catch (error) {
    console.error('[DB] Failed to reconnect:', error);
    throw error;
  }
}

/**
 * Execute query with transaction support
 */
export async function executeWithTransaction<T>(
  operation: (client: PrismaClient) => Promise<T>
): Promise<T> {
  const client = getPrismaClient();

  return dbManager.transaction(() => operation(client));
}

/**
 * Execute raw query with timing
 */
export async function executeRawQuery<T>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = getPrismaClient();

  const start = Date.now();
  const results = await client.$queryRawUnsafe<T[]>(sql, ...(params || []));
  const duration = Date.now() - start;

  metrics.recordRequest('/api/db/raw', 'QUERY', 200, duration);

  return results;
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = Date.now();

  try {
    const client = getPrismaClient();
    await client.$queryRaw`SELECT 1`;

    const latency = Date.now() - start;

    return {
      healthy: true,
      latencyMs: latency,
      message: `Database healthy (${latency}ms)`,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - start,
      message: 'Database connection failed',
      error: (error as Error).message,
    };
  }
}

export default {
  getPrismaClient,
  closeDatabaseConnections,
  reconnectDatabase,
  executeWithTransaction,
  executeRawQuery,
  checkDatabaseHealth,
};
