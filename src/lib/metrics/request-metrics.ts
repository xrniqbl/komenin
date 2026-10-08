/**
 * Request Metrics Collector
 *
 * Tracks HTTP request performance and error rates across all endpoints.
 */

export interface MetricOptions {
  endpoint: string;
  method: string;
  status_code: number;
}

// Upper bound on distinct method:endpoint keys held in memory, so unbounded
// path cardinality (e.g. ids in URLs) cannot leak memory.
const MAX_COUNTER_KEYS = 1000;

export class RequestMetrics {
  // In-memory counters for development/testing
  private counters = new Map<string, { count: number; totalLatency: number }>();

  /**
   * Record a completed request
   */
  recordRequest(endpoint: string, method: string, statusCode: number, latencyMs: number) {
    const key = `${method}:${endpoint}`;

    if (!this.counters.has(key)) {
      if (this.counters.size >= MAX_COUNTER_KEYS) {
        // Drop the oldest key (Map preserves insertion order).
        const oldest = this.counters.keys().next().value;
        if (oldest !== undefined) this.counters.delete(oldest);
      }
      this.counters.set(key, { count: 0, totalLatency: 0 });
    }

    const data = this.counters.get(key)!;
    data.count++;
    data.totalLatency += latencyMs;

    // Export to external monitoring system if configured
    this.exportToMonitoring('app.requests_total', {
      endpoint,
      method,
      status_code: statusCode,
    }, 1);

    // Export latency histogram
    this.exportToMonitoring('app.requests.latency_ms', { endpoint }, latencyMs);

    // Alert on high error rate
    if (statusCode >= 500) {
      this.recordError(endpoint, statusCode);
    }
  }

  /**
   * Track specific error type
   */
  private errorCounts = new Map<string, number>();

  private recordError(endpoint: string, statusCode: number) {
    const errorKey = `error:${statusCode}`;
    this.errorCounts.set(
      errorKey,
      (this.errorCounts.get(errorKey) || 0) + 1
    );

    this.exportToMonitoring('app.errors.http', {
      endpoint,
      status_code: statusCode,
    }, 1);
  }

  /**
   * Get latency statistics for an endpoint
   */
  getLatencyStats(endpoint: string, method: string): {
    avgLatency: number;
    requestCount: number;
  } | null {
    const key = `${method}:${endpoint}`;
    const data = this.counters.get(key);

    if (!data) return null;

    return {
      avgLatency: data.totalLatency / data.count,
      requestCount: data.count,
    };
  }

  /**
   * Get overall error rate
   */
  getErrorRate(): number {
    let totalRequests = 0;
    let totalErrors = 0;

    for (const data of this.counters.values()) {
      totalRequests += data.count;
    }

    for (const [, count] of this.errorCounts.entries()) {
      totalErrors += count;
    }

    return totalRequests > 0 ? (totalErrors / totalRequests) : 0;
  }

  /**
   * Export metric to monitoring backend
   * In production, this would send to Prometheus/Datadog/etc.
   */
  private exportToMonitoring(
    metricName: string,
    labels: Record<string, string | number>,
    value: number
  ) {
    // Quiet by default in production; opt in with METRICS_LOG=1 (e.g. when
    // a log-based collector scrapes stdout).
    const shouldLog =
      process.env.METRICS_LOG === '1' || process.env.NODE_ENV !== 'production';
    if (!shouldLog) return;

    // Build label string
    const labelsStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    console.log(`[METRICS] ${metricName}{${labelsStr}} ${value}`);

    // To ship to a real monitoring service (Datadog/Prometheus), forward
    // (metricName, value, labels) to its client here.
  }

  /**
   * Reset counters (for testing)
   */
  reset() {
    this.counters.clear();
    this.errorCounts.clear();
  }
}
