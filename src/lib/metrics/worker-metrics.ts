/**
 * Worker Metrics Collector
 *
 * Tracks background job performance, success rates, and queue depth.
 */

export interface JobStats {
  job_name: string;
  status: 'success' | 'failed' | 'cancelled';
}

/**
 * Bounded label values for the worker.jobs.errors metric. Raw error messages
 * must never become metric labels — each variation would create a new
 * time-series (unbounded cardinality).
 */
export type WorkerErrorType =
  | 'quota'
  | 'preflight'
  | 'connector'
  | 'billing'
  | 'auth'
  | 'unknown';

/** Bucket a free-form job failure message into a bounded error_type label. */
export function classifyWorkerError(message: string): WorkerErrorType {
  const m = message.toLowerCase();
  if (m.includes('quota') || m.includes('limit')) return 'quota';
  if (m.includes('preflight') || m.includes('blocked')) return 'preflight';
  if (m.includes('billing') || m.includes('payment') || m.includes('refund')) {
    return 'billing';
  }
  if (m.includes('unauthorized') || m.includes('auth') || m.includes('token')) {
    return 'auth';
  }
  if (
    m.includes('connector') ||
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('timeout') ||
    m.includes('503') ||
    m.includes('failed')
  ) {
    return 'connector';
  }
  return 'unknown';
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

    console.log(`[WORKER] OK ${jobName} completed in ${durationMs}ms`);
  }

  /**
   * Record failed job execution. `errorType` accepts a raw message and is
   * classified into a bounded label before export.
   */
  onJobFailure(jobName: string, durationMs: number, errorType: string) {
    this.trackJob(jobName, 'failed', durationMs);

    this.exportToMonitoring('worker.jobs_total', {
      job_name: jobName,
      status: 'failed',
    }, 1);

    this.exportToMonitoring('worker.jobs.errors', {
      job_name: jobName,
      error_type: classifyWorkerError(errorType),
    }, 1);

    console.error(`[WORKER] FAIL ${jobName} failed after ${durationMs}ms - ${errorType}`);
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

/** Shared singleton so every cron invocation reports into one collector. */
let sharedWorkerMetrics: WorkerMetrics | null = null;

export function getWorkerMetrics(): WorkerMetrics {
  if (!sharedWorkerMetrics) {
    sharedWorkerMetrics = new WorkerMetrics();
  }
  return sharedWorkerMetrics;
}
