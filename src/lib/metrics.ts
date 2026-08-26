/**
 * Metrics & Observability Module
 *
 * Provides comprehensive metrics collection for Aether's observability stack.
 * Tracks application health, performance, business metrics, and security events.
 *
 * Supports both Prometheus-compatible export and SaaS integrations (Datadog, Sentry).
 */

import { RequestMetrics } from './metrics/request-metrics';
import { WorkerMetrics } from './metrics/worker-metrics';
import { UsageMetrics } from './metrics/usage-metrics';
import { PlatformMetrics } from './metrics/platform-metrics';
import { BillingMetrics } from './metrics/billing-metrics';
import { SecurityMetrics } from './metrics/security-metrics';

/**
 * Main metrics manager - singleton instance
 */
export class MetricsManager {
  private static instance: MetricsManager;

  // Individual metric collectors
  readonly request: RequestMetrics;
  readonly worker: WorkerMetrics;
  readonly usage: UsageMetrics;
  readonly platform: PlatformMetrics;
  readonly billing: BillingMetrics;
  readonly security: SecurityMetrics;

  // Global metrics
  private startupTime: Date = new Date();
  private requestCount = new Map<string, number>();

  private constructor() {
    this.request = new RequestMetrics();
    this.worker = new WorkerMetrics();
    this.usage = new UsageMetrics();
    this.platform = new PlatformMetrics();
    this.billing = new BillingMetrics();
    this.security = new SecurityMetrics();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MetricsManager {
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager();
    }
    return MetricsManager.instance;
  }

  /**
   * Record a request to an endpoint
   */
  recordRequest(options: {
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
  }) {
    const { endpoint, method, statusCode, latencyMs } = options;

    // Global tracking
    const key = `${method}:${endpoint}`;
    this.requestCount.set(key, (this.requestCount.get(key) || 0) + 1);

    // Pass to specialized collector
    this.request.recordRequest(endpoint, method, statusCode, latencyMs);

    // Log debug info in development
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_METRICS === 'true') {
      console.log(`[METRIC] ${method} ${endpoint} ${statusCode} (${latencyMs}ms)`);
    }
  }

  /**
   * Track worker job completion/failure
   */
  recordJob(
    jobName: string,
    status: 'success' | 'failed' | 'cancelled',
    durationMs: number,
    errorType?: string
  ) {
    if (status === 'success') {
      this.worker.onJobComplete(jobName, durationMs);
    } else {
      this.worker.onJobFailure(jobName, durationMs, errorType || 'unknown');
    }
  }

  /**
   * Update workspace quota usage
   */
  updateQuota(workspaceId: string, quotaType: string, current: number, limit: number) {
    this.usage.updateQuota(workspaceId, quotaType, current, limit);

    // Alert if approaching limit (> 80%)
    if (limit > 0 && (current / limit) > 0.8) {
      this.security.recordSuspiciousActivity('quota_warning', 'low');
      console.warn(`[ALERT] Workspace ${workspaceId} using ${(current/limit*100).toFixed(0)}% of ${quotaType} quota`);
    }
  }

  /**
   * Track social platform health score
   */
  trackPlatformHealth(externalId: string, platform: 'instagram' | 'threads' | 'tiktok', score: number) {
    this.platform.onPlatformStatus(externalId, platform, score);

    // Critical alert if unhealthy
    if (score < 50) {
      this.security.recordSuspiciousActivity('platform_degraded', 'medium');
      console.error(`[ALERT] Platform ${platform} account ${externalId} has low health score: ${score}%`);
    }
  }

  /**
   * Record API error from platform
   */
  recordPlatformError(platform: 'instagram' | 'threads' | 'tiktok', errorType: string) {
    this.platform.recordAPIError(platform, errorType);
  }

  /**
   * Track successful payment
   */
  recordPaymentSuccess(method: string, amountUSD: number) {
    this.billing.recordSuccessfulPayment(method);

    // Update MRR (simplified - should be more sophisticated)
    const currentMRR = this.billing.getCurrentMRR();
    this.billing.updateMRR(currentMRR + amountUSD);
  }

  /**
   * Track failed payment
   */
  recordPaymentFailure(reason: string) {
    this.billing.recordFailedPayment(reason);
  }

  /**
   * Record failed authentication attempt
   */
  recordFailedLogin(userId: string, reason: string) {
    this.security.recordFailedLogin(userId, reason);

    // Alert on potential brute force attack
    const recentAttempts = this.security.getRecentAttemptCount(userId);
    if (recentAttempts > 10) {
      this.security.recordSuspiciousActivity('brute_force_attempt', 'high');
      console.error(`[SECURITY ALERT] Possible brute force attack on user ${userId}: ${recentAttempts} attempts`);
    }
  }

  /**
   * Export all metrics in Prometheus format
   */
  exportPrometheusFormat(): string {
    const lines: string[] = [];

    // Add custom global metrics
    lines.push('# HELP app_requests_total Total requests tracked');
    lines.push('# TYPE app_requests_total counter');

    for (const [key, count] of this.requestCount.entries()) {
      lines.push(`app_requests_total{route="${key}"} ${count}`);
    }

    // Defer to specialized collectors for their metrics
    // In production, this would call .collect() on each collector

    return lines.join('\n');
  }

  /**
   * Get system uptime
   */
  getUptime(): string {
    const now = new Date();
    const diff = now.getTime() - this.startupTime.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${days}d ${hours}h ${minutes}m`;
  }

  /**
   * Reset metrics (for testing)
   */
  reset() {
    this.requestCount.clear();
    // Note: Would need to add reset methods to each collector
  }
}

// Export singleton instance
export const metrics = MetricsManager.getInstance();

/**
 * Export types
 */
export type MetricCollector = typeof metrics;

// Re-export individual collectors for standalone use
export { RequestMetrics } from './metrics/request-metrics';
export { WorkerMetrics } from './metrics/worker-metrics';
export { UsageMetrics } from './metrics/usage-metrics';
export { PlatformMetrics } from './metrics/platform-metrics';
export { BillingMetrics } from './metrics/billing-metrics';
export { SecurityMetrics } from './metrics/security-metrics';
