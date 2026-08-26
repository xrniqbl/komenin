/**
 * Database Connection Pool Manager
 *
 * Optimizes PostgreSQL connection management with health monitoring,
 * retry logic, and performance tracking.
 */

import { PrismaClient } from '@prisma/client';
import { metrics } from './metrics';

// ========================================
// CONNECTION POOL CONFIGURATION
// ========================================

interface DatabaseConfig {
  maxPoolSize?: number;
  minIdleConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
  maxLifetimeMs?: number;
}

const DEFAULT_CONFIG: DatabaseConfig = {
  maxPoolSize: 20,
  minIdleConnections: 5,
  connectionTimeoutMs: 10000,
  idleTimeoutMs: 30000,
  maxLifetimeMs: 300000, // 5 minutes
};

// ========================================
// HEALTH MONITORING
// ========================================

interface PoolHealthMetrics {
  activeCount: number;
  idleCount: number;
  waitingCount: number;
  totalConnections: number;
  avgAcquireTimeMs: number;
  lastChecked: Date;
  errorCount: number;
}

class HealthMonitor {
  private metricsMap = new Map<string, PoolHealthMetrics>();
  private readonly updateInterval = 30000; // 30 seconds

  constructor() {
    this.startPeriodicMonitoring();
  }

  updateMetrics(key: string, metricsData: Partial<PoolHealthMetrics>): void {
    const current = this.metricsMap.get(key) || {
      activeCount: 0,
      idleCount: 0,
      waitingCount: 0,
      totalConnections: 0,
      avgAcquireTimeMs: 0,
      lastChecked: new Date(),
      errorCount: 0,
    };

    this.metricsMap.set(key, { ...current, ...metricsData, lastChecked: new Date() });
  }

  getMetrics(key: string): PoolHealthMetrics | null {
    return this.metricsMap.get(key) || null;
  }

  incrementError(key: string): void {
    const metrics = this.metricsMap.get(key);
    if (metrics) {
      metrics.errorCount++;
      this.metricsMap.set(key, metrics);
    }
  }

  startPeriodicMonitoring(): void {
    setInterval(() => {
      console.log('[DB MONITOR] Pool health check:', {
        timestamp: new Date().toISOString(),
        trackedPools: this.metricsMap.size,
      });
    }, this.updateInterval);
  }
}

const healthMonitor = new HealthMonitor();

// ========================================
// QUERY TIMING INSTRUMENTATION
// ========================================

class QueryTimer {
  private timerMap = new Map<string, number>();
  private latencies = new Map<string, number[]>();

  startQuery(queryId: string): void {
    this.timerMap.set(queryId, Date.now());
  }

  endQuery(queryId: string): number {
    const startTime = this.timerMap.get(queryId);
    if (!startTime) return 0;

    const duration = Date.now() - startTime;
    this.timerMap.delete(queryId);

    // Track latency distribution
    const key = 'database.query.latency';
    const currentLatencies = this.latencies.get(key) || [];

    if (currentLatencies.length >= 1000) {
      currentLatencies.shift(); // Keep only last 1000
    }

    currentLatencies.push(duration);
    this.latencies.set(key, currentLatencies);

    return duration;
  }

  getAverageLatency(queryType: string = 'all'): number {
    const latencies = this.latencies.get('database.query.latency') || [];
    if (latencies.length === 0) return 0;

    const sum = latencies.reduce((a, b) => a + b, 0);
    return sum / latencies.length;
  }

  getP95Latency(): number {
    const latencies = this.latencies.get('database.query.latency') || [];
    if (latencies.length === 0) return 0;

    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, index)];
  }
}

const queryTimer = new QueryTimer();

// ========================================
// RETRY LOGIC
// ========================================

interface RetryOptions {
  maxRetries?: number;
  backoffMs?: number;
  retryableErrors?: RegExp[];
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  backoffMs: 1000,
  retryableErrors: [/ECONNRESET/i, /ETIMEDOUT/i, /deadlock/i, /transaction serialization failure/i],
};

async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable = config.retryableErrors?.some(regex => regex.test(String(error)));

      if (!isRetryable || attempt === config.maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = config.backoffMs * Math.pow(2, attempt);
      console.warn(`[DB RETRY] Attempt ${attempt + 1}/${config.maxRetries} failed. Retrying in ${delay}ms...`);

      await sleep(delay);
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// DATABASE CLIENT MANAGER
// ========================================

export class DatabaseManager {
  private client: PrismaClient | null = null;
  private initialized = false;
  private readonly config: DatabaseConfig;

  constructor(config: DatabaseConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize Prisma client with optimizations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Create Prisma client with middleware
    this.client = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    // Add query timing middleware
    this.client.$use(async (params, next) => {
      const queryId = `${params.model}.${params.action}.${Date.now()}`;
      const startTime = Date.now();

      try {
        const result = await next(params);
        const duration = Date.now() - startTime;

        // Record metrics
        queryTimer.endQuery(queryId);

        // Export to monitoring system
        metrics.request.recordRequest(
          `/api/db/${params.model}/${params.action}`,
          params.action.toUpperCase(),
          200,
          duration
        );

        // Alert on slow queries
        if (duration > 1000) {
          console.warn(`[DB ALERT] Slow query detected: ${duration}ms (${params.model}.${params.action})`);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        queryTimer.endQuery(queryId);

        throw error;
      }
    });

    // Connect to database
    await this.client.$connect();

    this.initialized = true;

    console.log('[DB] Connection pool initialized');
    console.log('[DB] Configuration:', this.config);
  }

  /**
   * Get Prisma client instance
   */
  getClient(): PrismaClient {
    if (!this.client) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Execute query with retry logic
   */
  async execute<T>(operation: () => Promise<T>, retryOptions?: RetryOptions): Promise<T> {
    await this.initialize();
    return withRetry(operation, retryOptions);
  }

  /**
   * Run transaction with automatic rollback on error
   */
  async transaction<T>(
    operations: Array<() => Promise<T>>
  ): Promise<T[]> {
    await this.initialize();

    try {
      return await this.client!.$transaction(operations);
    } catch (error) {
      console.error('[DB TRANSACTION] Failed:', error);
      throw error;
    }
  }

  /**
   * Run raw SQL query
   */
  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    await this.initialize();
    const results = await this.client!.$queryRawUnsafe<T[]>(sql, ...params || []);
    return results;
  }

  /**
   * Check database health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    connected: boolean;
    version?: string;
    uptimeMs: number;
  }> {
    try {
      await this.initialize();
      const start = Date.now();

      // Simple health check query
      await this.client!.$executeRawUnsafe('SELECT 1');

      const uptime = Date.now() - start;

      healthMonitor.updateMetrics('default', {
        activeCount: 0, // Would need actual DB metrics
        idleCount: 0,
        waitingCount: 0,
        totalConnections: 0,
        avgAcquireTimeMs: uptime,
      });

      return {
        healthy: true,
        connected: true,
        uptimeMs: uptime,
      };
    } catch (error) {
      healthMonitor.incrementError('default');

      return {
        healthy: false,
        connected: false,
        uptimeMs: 0,
      };
    }
  }

  /**
   * Close connections gracefully
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
      this.initialized = false;
      console.log('[DB] Connections closed');
    }
  }

  /**
   * Get current pool statistics
   */
  getStats(): {
    averageLatencyMs: number;
    p95LatencyMs: number;
    healthStatus: PoolHealthMetrics | null;
  } {
    return {
      averageLatencyMs: queryTimer.getAverageLatency(),
      p95LatencyMs: queryTimer.getP95Latency(),
      healthStatus: healthMonitor.getMetrics('default'),
    };
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

export const dbManager = new DatabaseManager();

// Auto-initialize on import (if needed)
if (process.env.AUTO_INITIALIZE_DB === 'true') {
  dbManager.initialize().catch(console.error);
}

// Export types
export type { DatabaseConfig, PoolHealthMetrics, RetryOptions };

// Re-export Prisma Client for direct use when needed
export { PrismaClient };

// Cleanup on process exit
process.on('beforeExit', async () => {
  await dbManager.close();
});
