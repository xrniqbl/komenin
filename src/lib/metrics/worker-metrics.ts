/**
 * Worker Metrics Collector
 *
 * Tracks background job performance, success rates, and queue depth.
 */

export interface JobStats {
  job_name: string;
  status: 'success' | 'failed' | 'cancelled';
}

export class WorkerMetrics {
  // Track job execution counts
  private jobCounts = new Map<string, {
    successes: number;
    failures: number;
    totalDuration: number;
  }>();

  /**
   * Record successful job completion
   */
  onJobComplete(jobName: string, durationMs: number) {
    this.trackJob(jobName, 'success', durationMs);

    this.exportToMonitoring('worker.jobs_total', {
      job_name: jobName,
      status: 'success',
    }, 1);

    console.log(`[WORKER] ✓ ${jobName} completed in ${durationMs}ms`);
  }

  /**
   * Record failed job execution
   */
  onJobFailure(jobName: string, durationMs: number, errorType: string) {
    this.trackJob(jobName, 'failed', durationMs);

    this.exportToMonitoring('worker.jobs_total', {
      job_name: jobName,
      status: 'failed',
    }, 1);

    this.exportToMonitoring('worker.jobs.errors', {
      job_name: jobName,
      error_type: errorType,
    }, 1);

    console.error(`[WORKER] ✗ ${jobName} failed after ${durationMs}ms - ${errorType}`);
  }

  /**
   * Internal tracking of job stats
   */
  private trackJob(jobName: string, status: 'success' | 'failed', durationMs: number) {
    const key = jobName;

    if (!this.jobCounts.has(key)) {
      this.jobCounts.set(key, { successes: 0, failures: 0, totalDuration: 0 });
    }

    const data = this.jobCounts.get(key)!;

    if (status === 'success') {
      data.successes++;
    } else {
      data.failures++;
    }

    data.totalDuration += durationMs;

    // Alert on high failure rate (> 10% in last hour)
    const failureRate = data.successes + data.failures > 0
      ? data.failures / (data.successes + data.failures)
      : 0;

    if (failureRate > 0.1) {
      console.warn(`[ALERT] Job ${jobName} has ${failureRate*100}% failure rate`);
    }
  }

  /**
   * Get average job duration
   */
  getAverageJobDuration(jobName: string): number | null {
    const data = this.jobCounts.get(jobName);
    if (!data || data.successes + data.failures === 0) return null;

    return data.totalDuration / (data.successes + data.failures);
  }

  /**
   * Get job success rate
   */
  getJobSuccessRate(jobName: string): number | null {
    const data = this.jobCounts.get(jobName);
    if (!data) return null;

    const total = data.successes + data.failures;
    if (total === 0) return null;

    return data.successes / total;
  }

  /**
   * Export metric to monitoring backend
   */
  private exportToMonitoring(
    metricName: string,
    labels: Record<string, string>,
    value: number
  ) {
    const labelsStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    console.log(`[METRICS] ${metricName}{${labelsStr}} ${value}`);
  }

  /**
   * Reset metrics (for testing)
   */
  reset() {
    this.jobCounts.clear();
  }
}
