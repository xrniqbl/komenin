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

export class RequestMetrics {
  // In-memory counters for development/testing
  private counters = new Map<string, { count: number; totalLatency: number }>();

  /**
   * Record a completed request
   */
  recordRequest(endpoint: string, method: string, statusCode: number, latencyMs: number) {
    const key = `${method}:${endpoint}`;

    if (!this.counters.has(key)) {
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

    for (const [key, data] of this.counters.entries()) {
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
    labels: Record<string, string>,
    value: number
  ) {
    // Build label string
    const labelsStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    console.log(`[METRICS] ${metricName}{${labelsStr}} ${value}`);

    // TODO: Send to actual monitoring service
    // Example for Datadog:
    // datadogClient.distribution(metricName, value, labels).send();
  }

  /**
   * Reset counters (for testing)
   */
  reset() {
    this.counters.clear();
    this.errorCounts.clear();
  }
}
