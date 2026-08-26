/**
 * Usage Metrics Collector
 *
 * Tracks workspace quota usage and limits.
 */

export interface QuotaData {
  workspace_id: string;
  quota_type: string;
}

export class UsageMetrics {
  // Track current usage counts
  private usageCounts = new Map<string, number>();
  private limits = new Map<string, number>();

  /**
   * Update quota usage
   */
  updateQuota(workspaceId: string, quotaType: string, current: number, limit: number) {
    const key = `${workspaceId}:${quotaType}`;

    this.usageCounts.set(key, current);
    this.limits.set(key, limit);

    // Export metrics
    this.exportToMonitoring('usage.quota.current', {
      workspace_id: workspaceId,
      quota_type: quotaType,
    }, current);

    this.exportToMonitoring('usage.quota.limit', {
      workspace_id: workspaceId,
      quota_type: quotaType,
    }, limit);
  }

  /**
   * Get usage percentage
   */
  getUsagePercentage(workspaceId: string, quotaType: string): number {
    const key = `${workspaceId}:${quotaType}`;
    const current = this.usageCounts.get(key) || 0;
    const limit = this.limits.get(key) || 0;

    if (limit === 0) return 0;

    return (current / limit) * 100;
  }

  /**
   * Check if quota is exceeded
   */
  isQuotaExceeded(workspaceId: string, quotaType: string): boolean {
    const percentage = this.getUsagePercentage(workspaceId, quotaType);
    return percentage >= 100;
  }

  /**
   * Get all workspace quotas
   */
  getAllWorkspaces(): Array<{
    workspaceId: string;
    quotaType: string;
    current: number;
    limit: number;
    percentage: number;
  }> {
    const result: Array<{
      workspaceId: string;
      quotaType: string;
      current: number;
      limit: number;
      percentage: number;
    }> = [];

    for (const [key, current] of this.usageCounts.entries()) {
      const [workspaceId, quotaType] = key.split(':');
      const limit = this.limits.get(key) || 0;
      const percentage = limit > 0 ? (current / limit) * 100 : 0;

      result.push({
        workspaceId,
        quotaType,
        current,
        limit,
        percentage,
      });
    }

    return result;
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
    this.usageCounts.clear();
    this.limits.clear();
  }
}
