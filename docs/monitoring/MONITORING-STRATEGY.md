# Aether Monitoring & Observability Strategy

## Overview

Observability is critical for production-grade systems. This document defines what metrics we track, how we alert, and the tools we use to monitor Aether's health, performance, and security.

## Pillars of Observability

### 1. Metrics (Quantitative)

Numerical data over time - tells us **"what happened"**

**Examples:**
- Request rate: `200 requests/sec`
- Error rate: `0.5%`
- Latency p95: `150ms`
- Active sessions: `1,234`
- Job queue depth: `45 jobs`

### 2. Logs (Qualitative)

Time-stamped events with context - tells us **"why it happened"**

**Examples:**
- `[INFO] User authenticated successfully - userId: abc123`
- `[ERROR] Instagram API timeout - externalId: post_456`
- `[WARN] Rate limit approaching - IP: 192.168.1.100`

### 3. Traces (Distributed)

End-to-end request flow across services - tells us **"where it broke"**

**Examples:**
- Request `req-789` spans: `web → worker → database`
- Spans show latency per component
- Identifies bottleneck locations

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Aether Stack                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Next.js   │    │   Worker    │    │   Database  │      │
│  │    App      │    │            │    │  (Postgres) │      │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘      │
│         |                  |                   |              │
│         v                  v                   v              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              OpenTelemetry SDK                       │     │
│  │  • Metrics Exporter                                  │     │
│  │  • Log Aggregator                                    │     │
│  │  • Trace Propagation                                 │     │
│  └─────────────────────────────────────────────────────┘     │
│                           |                                   │
│                           v                                   │
│  ┌─────────────────────────────────────────────────────┐     │
│  │              Observability Backend                   │     │
│  │  Option 1: Prometheus + Grafana (self-hosted)        │     │
│  │  Option 2: Datadog/Sentry (SaaS)                     │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Metrics to Track

### A. Application Health Metrics

#### 1. Request Metrics

```typescript
// src/lib/metrics/request-metrics.ts
import * as Metrics from '@metrics/core';

export class RequestMetrics {
  // Total requests
  private requestCount = Metrics.counter('app.requests_total', {
    endpoint: true,
    method: true,
    status_code: true,
  });
  
  // Latency histogram
  private requestLatency = Metrics.histogram('app.requests.latency_ms', {
    endpoint: true,
    buckets: [50, 100, 200, 500, 1000, 2000], // ms
  });
  
  // Errors
  private errorCount = Metrics.counter('app.errors_total', {
    type: true,
    endpoint: true,
  });
  
  recordRequest(endpoint: string, method: string, statusCode: number, latencyMs: number) {
    this.requestCount.increment({ endpoint, method, status_code: statusCode });
    this.requestLatency.observe(latencyMs, { endpoint });
    
    if (statusCode >= 400) {
      this.errorCount.increment({ type: 'http_error', endpoint });
    }
  }
}
```

**Dashboard Panel**:
- `/api/posts/list` RPS (requests/second)
- P95 latency by endpoint
- Error rate % over last hour
- Slowest endpoints (p99)

#### 2. Worker Performance

```typescript
// src/lib/metrics/worker-metrics.ts
export class WorkerMetrics {
  private jobCount = Metrics.counter('worker.jobs_total', {
    job_name: true,
    status: true, // success, failed, cancelled
  });
  
  private jobDuration = Metrics.histogram('worker.jobs.duration_ms', {
    job_name: true,
    status: true,
  });
  
  private queueDepth = Metrics.gauge('worker.queue_depth', {
    queue: true,
  });
  
  onJobComplete(jobName: string, durationMs: number) {
    this.jobCount.increment({ job_name: jobName, status: 'success' });
    this.jobDuration.observe(durationMs, { job_name: jobName, status: 'success' });
  }
  
  onJobFailure(jobName: string, durationMs: number, errorType: string) {
    this.jobCount.increment({ 
      job_name: jobName, 
      status: 'failed',
      error_type: errorType
    });
    this.jobDuration.observe(durationMs, { job_name: jobName, status: 'failed' });
  }
}
```

**Critical Alerts**:
- ❗ Job failure rate > 5% in 5 minutes → investigate immediately
- ❗ Queue depth > 100 items continuously for 10 minutes → scale workers
- ❗ Average job duration exceeds SLA by 2x → optimize or increase resources

### B. Business Metrics

#### 1. Usage Quotas & Limits

```typescript
// src/lib/metrics/usage-metrics.ts
export class UsageMetrics {
  private quotaUsage = Metrics.gauge('usage.quota.current', {
    workspace_id: true,
    quota_type: true, // sends, publishes, generates, skill_runs
  });
  
  private quotaLimit = Metrics.gauge('usage.quota.limit', {
    workspace_id: true,
    quota_type: true,
  });
  
  updateQuota(workspaceId: string, quotaType: string, current: number, limit: number) {
    this.quotaUsage.set({ workspace_id: workspaceId, quota_type: quotaType }, current);
    this.quotaLimit.set({ workspace_id: workspaceId, quota_type: quotaType }, limit);
  }
}
```

**Dashboard Panels**:
- Workspaces using > 80% of quota (at-risk customers)
- Monthly send/publish counts over time
- Average usage across all workspaces
- Plan upgrade opportunities (high-usage free plans)

#### 2. Social Platform Health

```typescript
// src/lib/metrics/platform-metrics.ts
export class PlatformMetrics {
  private platformHealth = Metrics.gauge('platform.health_score', {
    platform: true, // instagram, threads, tiktok
    username: true,
  });
  
  private apiErrors = Metrics.counter('platform.api_errors', {
    platform: true,
    error_type: true, // rate_limit, auth_error, network_error
  });
  
  private dailyActivity = Metrics.counter('platform.daily_activity', {
    platform: true,
    action: true, // posts, comments, discoveries
  });
  
  onPlatformStatus(externalId: string, platform: Platform, healthScore: number) {
    this.platformHealth.set(
      { platform, username: externalId },
      healthScore
    );
  }
  
  recordAPIError(platform: Platform, errorType: string) {
    this.apiErrors.increment({ platform, error_type: errorType });
  }
}
```

**Alert Thresholds**:
- ❗ Any account health score < 50 → send alert to ops team
- ❗ Instagram rate limits > 10/hour → throttle posting activity
- ❗ Threads/TikTok connection failures → check OAuth tokens

#### 3. Billing Revenue Metrics

```typescript
// src/lib/metrics/billing-metrics.ts
export class BillingMetrics {
  private mrr = Metrics.gauge('billing.mrr_usd');
  
  private activeSubscriptions = Metrics.gauge('billing.active_subscriptions', {
    plan: true,
  });
  
  private paymentSuccessRate = Metrics.counter('billing.payment_success', {
    payment_method: true,
  });
  
  private paymentFailures = Metrics.counter('billing.payment_failures', {
    reason: true, // card_expired, insufficient_funds, fraud
  });
  
  updateMRR(usdAmount: number) {
    this.mrr.set(usdAmount);
  }
  
  recordSuccessfulPayment(method: string) {
    this.paymentSuccessRate.increment({ payment_method: method });
  }
  
  recordFailedPayment(reason: string) {
    this.paymentFailures.increment({ reason });
  }
}
```

**Executive Dashboard**:
- MRR trend (month-over-month growth %)
- Churn rate (% subscriptions canceled)
- Average Revenue Per User (ARPU)
- Payment success rate by method (Midtrans vs others)

### C. Security Metrics

```typescript
// src/lib/metrics/security-metrics.ts
export class SecurityMetrics {
  private failedAuthAttempts = Metrics.counter('security.failed_auth', {
    user_id: true,
    failure_reason: true, // invalid_password, expired_token, forbidden
  });
  
  private rateLimitViolations = Metrics.counter('security.rate_limits', {
    ip: true,
    endpoint: true,
  });
  
  private suspiciousActivity = Metrics.counter('security.suspicious_events', {
    event_type: true, // brute_force, sql_injection_attempt, xss_attempt
    severity: true, // low, medium, high, critical
  });
  
  private decryptionAttempts = Metrics.counter('security.encryption.access', {
    user_id: true,
    resource_type: true,
    allowed: true,
  });
  
  recordFailedLogin(userId: string, reason: string) {
    this.failedAuthAttempts.increment({ 
      user_id: userId, 
      failure_reason: reason 
    });
    
    // Alert if same user has > 10 failed attempts in 5 minutes
    if (this.getRecentAttemptCount(userId) > 10) {
      triggerAlert('brute_force_attempt', { userId, timestamp: new Date() });
    }
  }
  
  async recordSuspiciousActivity(eventType: string, severity: string) {
    this.suspiciousActivity.increment({ 
      event_type: eventType, 
      severity 
    });
    
    if (severity === 'critical') {
      await notifySecurityTeam(`🚨 Critical security event: ${eventType}`);
    }
  }
}
```

**Real-time Security Dashboard**:
- Live failed login attempts (map view by country)
- Active rate-limit violations
- Recent suspicious activities (last 1 hour)
- Authentication success/failure rates

### D. Infrastructure Metrics

#### 1. Database Health

```typescript
// src/lib/metrics/database-metrics.ts
import { Prisma } from '@prisma/client/runtime/library';

export class DatabaseMetrics {
  private queryLatency = Metrics.histogram('database.query.latency_ms', {
    operation: true, // select, insert, update, delete
    model: true,
    index: true, // whether indexed query
  });
  
  private connectionPool = Metrics.gauge('database.pool.usage', {
    status: true, // active, idle, waiting
  });
  
  private lockWaitTime = Metrics.histogram('database.lock.wait_ms', {
    table: true,
    lock_type: true,
  });
  
  // Instrument Prisma client
  instrumentPrisma(prisma: PrismaClient) {
    prisma.$use(async (params, next) => {
      const start = Date.now();
      
      try {
        const result = await next(params);
        const latency = Date.now() - start;
        
        this.queryLatency.observe(latency, {
          operation: params.model ? 'other' : 'raw',
          model: params.model || 'unknown',
          index: !params.action.includes('raw'),
        });
        
        return result;
      } catch (error) {
        const latency = Date.now() - start;
        
        this.queryLatency.observe(latency, {
          operation: 'error',
          model: params.model || 'unknown',
        });
        
        throw error;
      }
    });
  }
}
```

**Database Dashboard**:
- Query latency distribution (p50, p95, p99)
- Connection pool utilization %
- Long-running queries (> 1 second)
- Lock contention count

#### 2. Cache Performance (Future - Redis)

```typescript
// src/lib/metrics/cache-metrics.ts
export class CacheMetrics {
  private cacheHits = Metrics.counter('cache.hits_total', {
    cache: true, // posts, users, credentials
  });
  
  private cacheMisses = Metrics.counter('cache.misses_total', {
    cache: true,
  });
  
  private evictionRate = Metrics.counter('cache.evictions_total', {
    reason: true, // memory_pressure, ttl_expired, manual_clear,
  });
  
  recordHit(cache: string) {
    this.cacheHits.increment({ cache });
  }
  
  recordMiss(cache: string) {
    this.cacheMisses.increment({ cache });
  }
  
  recordEviction(cache: string, reason: string) {
    this.evictionRate.increment({ cache, reason });
  }
}
```

**Target Cache Hit Rate**: > 80% for posts/user data, > 95% for credentials

---

## Alerting Strategy

### Alert Severity Levels

| Level | Name | Response Time | Who to Notify | When to Page |
|---|---|---|---|---|
| 🔴 | Critical | Immediate (< 5 min) | On-call engineer | Yes |
| 🟠 | High | Within 30 min | On-call engineer | Yes |
| 🟡 | Medium | Within 4 hours | Ops team Slack channel | No |
| 🟢 | Low | Next business day | Email digest | No |

### Critical Alerts (P1 - Page Immediately)

```yaml
# alerts/critical-alerts.yaml

name: postgres_connection_failed
description: "Database connection pool exhausted"
threshold: 
  metric: database.pool.active_connections
  condition: "> 95%"
  duration: 1m
notify:
  channels:
    - pagerduty: aether-oncall
    - slack: #ops-critical
    - sms: on-call-phone
    
name: worker_queue_backlog
description: "Worker jobs backing up > 500 items for 5 minutes"
threshold:
  metric: worker.queue_depth
  condition: "> 500"
  duration: 5m
notify:
  channels:
    - pagerduty: aether-oncall
    - slack: #ops-critical
    
name: payment_processing_failure
description: "Payment processing failing > 10% of transactions"
threshold:
  metric: billing.payment_success_rate
  condition: "< 90%"
  duration: 5m
notify:
  channels:
    - pagerduty: aether-payment-team
    - slack: #ops-critical
    
name: social_platform_outage
description: "Instagram/Threads API completely unreachable"
threshold:
  metric: platform.api_availability
  condition: "< 50%"
  duration: 2m
notify:
  channels:
    - pagerduty: aether-platform-team
    - slack: #platform-alerts
```

### Warning Alerts (P2 - Acknowledge Within 30 min)

```yaml
name: high_error_rate
description: "HTTP 5xx error rate elevated"
threshold:
  metric: app.errors_total / app.requests_total
  condition: "> 2%"
  duration: 5m
notify:
  channels:
    - slack: #ops-warnings
    
name: disk_space_low
description: "Server disk space below 20%"
threshold:
  metric: filesystem.disk.used_percent
  condition: "> 80%"
  duration: 5m
notify:
  channels:
    - slack: #ops-warnings
    
name: encryption_key_version_mismatch
description: "Records detected with outdated encryption key version"
threshold:
  metric: records.outdated_encryption
  condition: "> 100"
  duration: 1h
notify:
  channels:
    - slack: #security-alerts
```

### Info Alerts (P3 - Monitor Daily)

```yaml
name: quota_approaching_limit
description: "Workspaces approaching monthly send limits"
threshold:
  metric: usage.quota_usage_percent
  condition: "> 80%"
  duration: 24h
notify:
  channels:
    - email: customer-success-team
    
name: slow_query_detected
description: "Queries exceeding 1-second latency"
threshold:
  metric: database.query.latency_ms.p99
  condition: "> 1000"
  duration: 10m
notify:
  channels:
    - slack: #ops-insights
```

---

## Dashboard Layout

### Executive Dashboard (High-Level Business Metrics)

**URL**: `grafana.dashboards/aether/executive`

**Panels**:
1. **Revenue**: MRR, ARR, Monthly New Subscriptions
2. **User Growth**: Active Workspace Count, Total Users
3. **Health**: Overall System Uptime %, Error Rate
4. **Billing**: Payment Success Rate, Refund Rate
5. **Platform Status**: Instagram/Threads/TikTok Availability

**Audience**: CEO, Product Leads, Sales

### Operations Dashboard (Real-Time Operational Metrics)

**URL**: `grafana.dashboards/aether/operations`

**Panels**:
1. **Live Request Graph**: RPS by endpoint (last 15 minutes)
2. **Error Heatmap**: HTTP errors by status code & endpoint
3. **Worker Queue Depth**: Current backlog per job type
4. **Active Sessions**: Real-time count across regions
5. **Database Connections**: Pool usage over time
6. **Social Platform Scores**: Health scores for connected accounts
7. **Security Events**: Failed logins, rate limits, suspicious activity

**Audience**: DevOps, On-Call Engineers

### Developer Dashboard (Code-Level Debugging)

**URL**: `grafana.dashboards/aether/developers`

**Panels**:
1. **Distributed Traces**: Last 100 trace IDs with spans
2. **Function Latency**: P50/P95/P99 by function name
3. **Memory Usage**: Heap size, GC frequency
4. **CPU Utilization**: Per-container breakdown
5. **Cache Performance**: Hit/miss ratio, eviction rate
6. **SQL Query Timeline**: Slow queries with EXPLAIN output snippets

**Audience**: Backend Developers, SRE

---

## Logging Strategy

### Log Levels

```typescript
enum LogLevel {
  DEBUG = 'debug',    // Detailed diagnostic info (development only)
  INFO = 'info',      // Normal operational messages
  WARN = 'warn',      // Unexpected but handled issues
  ERROR = 'error',    // Failures requiring attention
  FATAL = 'fatal',    // Critical failures stopping execution
}
```

### Structured Logging Format

```json
{
  "timestamp": "2026-08-24T10:30:00Z",
  "level": "ERROR",
  "service": "aether-app",
  "trace_id": "abc123-def456",
  "span_id": "ghi789",
  "message": "Failed to publish Instagram post",
  "context": {
    "user_id": "usr_xyz789",
    "workspace_id": "ws_abc123",
    "post_external_id": "ig_post_456",
    "error_code": "INSTAGRAM_RATE_LIMIT_EXCEEDED",
    "retry_count": 2
  },
  "stack_trace": "Error: Rate limit exceeded...\n  at publishPost (src/services/social-service.ts:42)\n  ..."
}
```

### Correlation IDs

Every request gets a unique trace ID propagated throughout the stack:

```typescript
// In middleware
export function TRACE_ID_MIDDLEWARE(req: Request) {
  const traceId = crypto.randomUUID();
  
  req.headers.set('x-trace-id', traceId);
  
  // Attach to all downstream calls
  const dbLogger = logger.child({ trace_id: traceId });
  const apiClient = axios.create({ headers: { 'x-trace-id': traceId } });
  
  return traceId;
}
```

### Log Retention Policy

| Environment | Retention Period | Storage Type | Cost Consideration |
|---|---|---|---|
| Production | 90 days | Hot storage | Sentry Enterprise ($9/user/month) |
| Production | 1 year | Cold archive | S3 Glacier Deep Archive |
| Staging | 30 days | Local storage | Minimal cost |
| Development | 7 days | In-memory | None |

**Data Sanitization**: Strip PII before long-term retention:

```typescript
function sanitizeForLogging(record: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['email', 'phone', 'credit_card', 'password', 'api_key'];
  
  const sanitized = { ...record };
  
  sensitiveKeys.forEach(key => {
    if (key in sanitized) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  return sanitized;
}
```

---

## Incident Response Procedures

### Incident Severity Triage

```markdown
## P0 - Critical Outage
- **Definition**: Complete service unavailability, data breach, or revenue impact
- **Examples**: 
  - All posts failing to publish
  - Database down
  - Payment system offline
- **Response**: 
  1. Activate incident bridge line
  2. Designate incident commander
  3. Status page update every 30 minutes
  4. Post-mortem required within 48 hours

## P1 - Major Degradation
- **Definition**: Significant performance degradation affecting many users
- **Examples**:
  - 50% of posts failing
  - 5-minute delay in notifications
  - One platform (e.g., TikTok) unavailable
- **Response**:
  1. Notify on-call engineer via PagerDuty
  2. Investigate and implement fix
  3. Status update every hour
  4. Post-mortem if downtime > 30 minutes

## P2 - Minor Issue
- **Definition**: Single-user issue or isolated problem
- **Examples**:
  - Individual user can't publish
  - Specific webhook failing
  - UI element broken
- **Response**:
  1. Create ticket in Jira
  2. Fix in next release cycle
  3. Communicate with affected user(s)

## P3 - Cosmetic/Enhancement
- **Definition**: Non-urgent improvements
- **Response**:
  1. Add to backlog
  2. Prioritize during sprint planning
```

### Post-Incident Review Template

```markdown
# Post-Incident Report: [Incident Title]

**Date**: YYYY-MM-DD  
**Duration**: Start → End (XX minutes)  
**Severity**: P0/P1/P2/P3  
**Incident Commander**: @username  

## Summary
Brief description of what happened and its impact.

## Timeline
- HH:MM - Issue first detected
- HH:MM - On-call notified
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Mitigation implemented
- HH:MM - Service fully restored

## Root Cause
Technical explanation of what caused the incident.

## Impact
- Users affected: X
- Revenue loss: $Y
- Data lost: Z records
- SLA violation: Yes/No

## Action Items
1. [Fix] Implement proper retry logic (Owner: @dev, Due: DATE)
2. [Monitor] Add alerting for early detection (Owner: @sre, Due: DATE)
3. [Doc] Update runbook with troubleshooting steps (Owner: @tech-writer, Due: DATE)

## Prevention Measures
Long-term changes to prevent recurrence.
```

---

## Toolchain Recommendations

### Option 1: Self-Hosted (Open Source)

**Best for**: Teams wanting full control, lower cost

**Components**:
1. **Metrics Collection**: Prometheus
2. **Visualization**: Grafana
3. **Log Aggregation**: Loki + Promtail
4. **Tracing**: Jaeger
5. **Alerting**: Alertmanager
6. **Infrastructure**: Kubernetes or Docker Swarm

**Cost**: $0 license fees + engineering time (~40 hrs setup)

**Pros**: Full control, no vendor lock-in, customizable  
**Cons**: Requires operational overhead, scaling complexity

### Option 2: SaaS (Recommended for Starting)

**Best for**: Fast setup, reliable, built-in integrations

**Components**:
1. **Metrics & Dashboards**: Datadog ($29/node/month starting)
2. **Logs**: Sentry (Free tier → Paid ~$9/user/month)
3. **APM**: Sentry APM or Datadog APM
4. **Alerting**: Integrated into both platforms

**Cost**: ~$100-300/month depending on scale  
**Setup Time**: < 1 day

**Pros**: Quick setup, enterprise features, excellent support  
**Cons**: Higher cost at scale, vendor dependency

### Recommendation: Hybrid Approach

Start with **Sentry** (free tier) for immediate visibility, then migrate to **Datadog** when hitting limits. Eventually consider self-hosted Prometheus/Grafana for cost optimization at scale.

---

## Implementation Checklist

### Week 1: Foundation

- [ ] Set up logging infrastructure (Sentry/Datadog)
- [ ] Configure basic error tracking
- [ ] Create executive dashboard template
- [ ] Define initial alert rules (critical only)
- [ ] Document incident response procedures

### Week 2: Core Metrics

- [ ] Instrument request metrics in Next.js
- [ ] Add worker job metrics
- [ ] Create operations dashboard
- [ ] Set up Slack alerts for warnings
- [ ] Train team on dashboard interpretation

### Week 3: Advanced Features

- [ ] Implement distributed tracing
- [ ] Add business metric tracking
- [ ] Configure auto-scaling based on metrics
- [ ] Set up capacity planning reviews
- [ ] Create monitoring runbooks

### Week 4: Optimization

- [ ] Tune alert thresholds based on baseline
- [ ] Eliminate noise in logs (fix spammy log statements)
- [ ] Optimize query performance (find slow queries)
- [ ] Establish weekly metrics review meetings
- [ ] Document lessons learned

---

## Monitoring Maturity Model

### Level 1: Reactive (Current State)

❌ We know something's wrong after users complain  
✅ Basic error logging exists  
⚠️ Manual health checks

### Level 2: Proactive (Target in 3 months)

🟢 We detect issues within 5 minutes  
🟢 Automated alerts for critical paths  
🟢 Standardized dashboards for all teams

### Level 3: Predictive (Target in 12 months)

🔵 ML-based anomaly detection  
🔵 Capacity forecasting ahead of demand  
🔵 Automated remediation for common issues

---

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/dashboards/)
- [Prometheus Monitoring Patterns](https://prometheus.io/docs/practices/)
- [Sentry Error Tracking Guide](https://docs.sentry.io/product/sentry-basics/tracing/)
