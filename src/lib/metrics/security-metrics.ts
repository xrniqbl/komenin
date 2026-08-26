/**
 * Security Metrics Collector
 *
 * Tracks authentication failures, suspicious activities, and security events.
 */

import { safeEqual } from '../security';

export interface SecurityEvent {
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  user_id?: string;
}

export class SecurityMetrics {
  // Track failed login attempts by user
  private failedLogins = new Map<string, number>();
  private recentAttempts = new Map<string, Date[]>();

  /**
   * Record failed login attempt
   */
  recordFailedLogin(userId: string, reason: string) {
    // Increment counter
    this.failedLogins.set(
      userId,
      (this.failedLogins.get(userId) || 0) + 1
    );

    // Track recent attempts for brute force detection
    const timestamps = this.recentAttempts.get(userId) || [];
    const now = new Date();
    timestamps.push(now);

    // Keep only last 5 minutes
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const filtered = timestamps.filter(ts => ts > fiveMinutesAgo);
    this.recentAttempts.set(userId, filtered);

    // Export metric
    this.exportToMonitoring('security.failed_auth', {
      user_id: userId,
      failure_reason: reason,
    }, 1);

    // Alert on potential brute force
    if (filtered.length > 10) {
      this.recordSuspiciousActivity('brute_force_attempt', 'high');
    }

    console.warn(`[SECURITY] Failed login for ${userId}: ${reason} (${filtered.length}/5min)`);
  }

  /**
   * Reset login attempt counter on successful login
   */
  resetFailedLogin(userId: string) {
    this.failedLogins.delete(userId);
    this.recentAttempts.delete(userId);
  }

  /**
   * Get recent attempt count (last 5 minutes)
   */
  getRecentAttemptCount(userId: string): number {
    const timestamps = this.recentAttempts.get(userId);
    return timestamps ? timestamps.length : 0;
  }

  /**
   * Track suspicious activity
   */
  private suspiciousEvents: SecurityEvent[] = [];

  recordSuspiciousActivity(eventType: string, severity: 'low' | 'medium' | 'high' | 'critical') {
    const event: SecurityEvent = {
      event_type: eventType,
      severity,
      timestamp: new Date(),
    };

    this.suspiciousEvents.push(event);

    // Keep last 1000 events
    if (this.suspiciousEvents.length > 1000) {
      this.suspiciousEvents.shift();
    }

    this.exportToMonitoring('security.suspicious_events', {
      event_type: eventType,
      severity: severity,
    }, 1);

    console.error(`[SECURITY ALERT] ${severity.toUpperCase()}: ${eventType}`);
  }

  /**
   * Get recent suspicious events
   */
  getRecentEvents(severityFilter?: 'low' | 'medium' | 'high' | 'critical'): SecurityEvent[] {
    if (!severityFilter) {
      return this.suspiciousEvents;
    }

    return this.suspiciousEvents.filter(e => e.severity === severityFilter);
  }

  /**
   * Check if an IP is rate-limited
   */
  private rateLimitedIPs = new Map<string, number>();
  private rateLimitWindow = 60 * 1000; // 1 minute
  private maxRequests = 100;

  checkRateLimit(ip: string): boolean {
    const timestamp = Date.now();
    const requests = this.rateLimitedIPs.get(ip) || 0;

    if (requests >= this.maxRequests) {
      return true; // Rate limited
    }

    this.rateLimitedIPs.set(ip, requests + 1);

    // Cleanup old entries
    setTimeout(() => {
      const current = this.rateLimitedIPs.get(ip) || 0;
      if (current > 0) {
        this.rateLimitedIPs.set(ip, current - 1);
      }
    }, this.rateLimitWindow);

    return false;
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
   * Reset all metrics (for testing)
   */
  reset() {
    this.failedLogins.clear();
    this.recentAttempts.clear();
    this.suspiciousEvents = [];
    this.rateLimitedIPs.clear();
  }
}
