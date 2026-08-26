/**
 * Billing Metrics Collector
 *
 * Tracks revenue, subscriptions, and payment success rates.
 */

export class BillingMetrics {
  // Current MRR (Monthly Recurring Revenue) in USD
  private mrrUSD: number = 0;

  // Active subscriptions by plan type
  private subscriptionCounts = new Map<string, number>();

  // Payment tracking
  private paymentSuccesses = new Map<string, number>();
  private paymentFailures = new Map<string, number>();

  /**
   * Update MRR value
   */
  updateMRR(usdAmount: number) {
    this.mrrUSD = usdAmount;

    console.log(`[BILLING] MRR updated to $${usdAmount.toFixed(2)}`);
  }

  /**
   * Get current MRR
   */
  getCurrentMRR(): number {
    return this.mrrUSD;
  }

  /**
   * Record successful payment
   */
  recordSuccessfulPayment(method: string) {
    const count = (this.paymentSuccesses.get(method) || 0) + 1;
    this.paymentSuccesses.set(method, count);

    this.exportToMonitoring('billing.payment_success', {
      payment_method: method,
    }, 1);
  }

  /**
   * Record failed payment
   */
  recordFailedPayment(reason: string) {
    const count = (this.paymentFailures.get(reason) || 0) + 1;
    this.paymentFailures.set(reason, count);

    this.exportToMonitoring('billing.payment_failures', {
      reason: reason,
    }, 1);

    console.warn(`[BILLING] Payment failed: ${reason}`);
  }

  /**
   * Track active subscription
   */
  trackSubscription(planCode: string) {
    const count = (this.subscriptionCounts.get(planCode) || 0) + 1;
    this.subscriptionCounts.set(planCode, count);

    this.exportToMonitoring('billing.active_subscriptions', {
      plan: planCode,
    }, 1);
  }

  /**
   * Calculate payment success rate
   */
  getPaymentSuccessRate(): number {
    let total = 0;
    let successes = 0;

    for (const [, count] of this.paymentSuccesses.entries()) {
      successes += count;
      total += count;
    }

    for (const [, count] of this.paymentFailures.entries()) {
      total += count;
    }

    return total > 0 ? (successes / total) : 0;
  }

  /**
   * Get all subscription breakdown
   */
  getSubscriptionBreakdown(): Array<{
    plan: string;
    count: number;
  }> {
    return Array.from(this.subscriptionCounts.entries()).map(([plan, count]) => ({
      plan,
      count,
    }));
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
    this.mrrUSD = 0;
    this.subscriptionCounts.clear();
    this.paymentSuccesses.clear();
    this.paymentFailures.clear();
  }
}
