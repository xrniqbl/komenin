/**
 * Platform Metrics Collector
 *
 * Tracks social platform health, API errors, and daily activity.
 */

export type Platform = 'instagram' | 'threads' | 'tiktok';

export class PlatformMetrics {
  // Health scores per account
  private healthScores = new Map<string, number>();

  // API error counts by platform and type
  private apiErrors = new Map<string, number>();

  // Daily activity counters
  private dailyActivity = new Map<string, { posts: number; comments: number; discovers: number }>();

  /**
   * Record platform health score
   */
  onPlatformStatus(externalId: string, platform: Platform, healthScore: number) {
    const key = `${platform}:${externalId}`;
    this.healthScores.set(key, healthScore);

    this.exportToMonitoring('platform.health_score', {
      platform,
      username: externalId,
    }, healthScore);

    console.log(`[PLATFORM] ${platform} ${externalId}: health=${healthScore}%`);
  }

  /**
   * Get current health score for an account
   */
  getHealthScore(platform: Platform, externalId: string): number | null {
    const key = `${platform}:${externalId}`;
    return this.healthScores.get(key) || null;
  }

  /**
   * Record API error from platform
   */
  recordAPIError(platform: Platform, errorType: string) {
    const key = `${platform}:${errorType}`;
    const count = (this.apiErrors.get(key) || 0) + 1;
    this.apiErrors.set(key, count);

    this.exportToMonitoring('platform.api_errors', {
      platform,
      error_type: errorType,
    }, 1);

    // Alert on rate limit errors
    if (errorType.includes('rate_limit')) {
      console.warn(`[ALERT] ${platform} rate limit approaching: ${count}/hour`);
    }
  }

  /**
   * Record daily activity
   */
  recordDailyActivity(platform: Platform, action: 'posts' | 'comments' | 'discovers') {
    const today = new Date().toISOString().split('T')[0];
    const key = `${today}:${platform}`;

    const activity = this.dailyActivity.get(key) || { posts: 0, comments: 0, discovers: 0 };
    (activity[action as keyof typeof activity])++;

    this.dailyActivity.set(key, activity);

    this.exportToMonitoring('platform.daily_activity', {
      platform,
      action,
    }, 1);
  }

  /**
   * Get total daily actions for a platform
   */
  getTotalActionsToday(platform: Platform): number {
    const today = new Date().toISOString().split('T')[0];
    const key = `${today}:${platform}`;
    const activity = this.dailyActivity.get(key);

    return activity ? activity.posts + activity.comments : 0;
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
    this.healthScores.clear();
    this.apiErrors.clear();
    this.dailyActivity.clear();
  }
}
