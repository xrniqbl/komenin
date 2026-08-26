# ADR-002: Worker Task Processing Pattern

## Status

**Accepted** - 2026-08-24

## Context

Aether memiliki berbagai jenis background jobs yang perlu dijalankan secara async:

1. **Time-sensitive jobs**: Health checks setiap 5 minutes, session polling
2. **Batch jobs**: Usage rollup, billing expire, data cleanup
3. **Event-driven jobs**: Webhook notifications, user actions
4. **Scheduled jobs**: Content publishing, report generation

Challenge:
- Jobs memiliki different SLAs (critical vs batch)
- Need to handle failures gracefully
- Must scale dengan workload
- Cannot block web requests

## Decision

Menerapkan **Multi-Strategy Worker Pattern** dengan 3 execution modes:

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Worker System                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Poller     │  │   Cron       │  │   Event-     │      │
│  │   (Always    │  │   Scheduler  │  │   Driven     │      │
│  │    On)       │  │  (Per-Job)   │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         |                   |                    |          │
│         v                   v                    v          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Job Processor Pool                     │   │
│  │  • Concurrency Control                              │   │
│  │  • Retry Logic                                      │   │
│  │  • Error Handling                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                           |                                  │
│                           v                                  │
│                  ┌────────────────┐                         │
│                  │  Database Log  │                         │
│                  │  (JobRuns)     │                         │
│                  └────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### Strategy 1: Poller (Always-On Worker)

Untuk time-critical operations:

```typescript
// Example: Session Health Check
export async function healthWorker() {
  while (true) {
    try {
      // Find unhealthy sessions
      const targets = await getTargetsForHealthCheck();
      
      // Process with concurrency limit
      await Promise.all(
        targets.map(target => checkSessionHealth(target))
      );
      
      // Update status in DB
      await updateHealthStatus(targets);
      
    } catch (error) {
      logError(error);
      await recordJobRun('health', 'failed', error);
    }
    
    // Wait 5 minutes before next tick
    await sleep(5 * 60 * 1000);
  }
}
```

**Jobs:**
- Session health monitoring
- Proxy rotation
- Rate limit tracking
- Real-time content delivery

### Strategy 2: Cron Scheduler (Vercel/System Cron)

Untuk scheduled batches yang tidak urgent:

```typescript
// Vercel Cron or system cron calling this endpoint
// GET /api/worker/cron?job=billing-expire&token=SECRET
export async function GET(request: Request) {
  validateAuth(request); // WORKER_SECRET or CRON_SECRET
  
  const { job } = request.nextUrl.searchParams;
  
  const handlers: Record<string, () => Promise<void>> = {
    'billing-expire': () => expireBillingPeriods(),
    'usage-rollup': () => rollUpUsageCounts(),
    'cleanup-temp': () => cleanupTemporaryData(),
  };
  
  const handler = handlers[job];
  if (!handler) return Response.json({ error: 'Unknown job' });
  
  try {
    await handler();
    return Response.json({ ok: true, job });
  } catch (error) {
    await recordJobRun(job, 'failed', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
```

**Jobs:**
- Billing period expiration
- Monthly usage rollup
- Data archival & cleanup
- Report generation

### Strategy 3: Event-Driven Triggers

Untuk on-demand execution:

```typescript
// API Endpoint triggering specific jobs
// POST /api/worker/run?job=send-notification
export async function POST(request: Request) {
  validateAuth(request);
  
  const { job, payload } = await request.json();
  
  const queue = await getJobQueue();
  await queue.add(job, payload);
  
  return Response.json({ queued: true });
}
```

**Jobs:**
- Send email notifications
- Trigger webhook calls
- Process user-initiated actions
- Requeue failed jobs

## Implementation Details

### Job Queue Structure

```typescript
interface JobDefinition {
  name: string;
  frequency?: string; // cron expression or interval
  timeoutMs?: number; // max execution time
  retries?: number;
  concurrency?: number; // how many instances can run
}

const JOBS: Record<string, JobDefinition> = {
  'health-check': {
    name: 'Health Check Worker',
    frequency: '*/5 * * * *', // every 5 minutes
    timeoutMs: 60000,
    retries: 3,
    concurrency: 1, // only one instance at a time
  },
  'usage-rollup': {
    name: 'Usage Rollup',
    frequency: '0 0 * * *', // daily at midnight
    timeoutMs: 300000,
    retries: 3,
    concurrency: 2,
  },
};
```

### Job Run Tracking

```prisma
model JobRun {
  id          String       @id @default(cuid())
  workspaceId String?
  job         String
  status      JobRunStatus @default(queued)
  message     String?
  count       Int?
  details     Json?
  startedAt   DateTime     @default(now())
  finishedAt  DateTime?
}
```

### Concurrency Control

```typescript
async function acquireLock(jobName: string): Promise<boolean> {
  const lockKey = `job_lock:${jobName}`;
  
  // Use Redis or database advisory locks
  const acquired = await db.query
    .lockTable('job_locks')
    .insert({ key: lockKey, expiresAt: now().add(5m) })
    .onConflictDoNothing();
    
  return !!acquired;
}

async function processJob(jobName: string, handler: () => Promise<void>) {
  if (!(await acquireLock(jobName))) {
    logDebug(`Job ${jobName} already running, skipping`);
    return;
  }
  
  try {
    await recordJobRun(jobName, 'running');
    await handler();
    await recordJobRun(jobName, 'succeeded');
  } catch (error) {
    await recordJobRun(jobName, 'failed', error);
    throw error;
  }
}
```

### Environment Configuration

```bash
# Worker Mode
WORKER_MODE=poller        # poller | scheduler | event-driven
WORKER_TICK_INTERVAL=300   # seconds (only for poller mode)

# Security
WORKER_SECRET=your_secret_min_16_chars
CRON_SECRET=another_secret_for_cron_endpoints

# Limits
WORKER_MAX_CONCURRENT=5    # max parallel jobs
WORKER_JOB_TIMEOUT=300     # seconds per job
```

## Rationale

**Why not use traditional queue (Redis/Bull)?**
1. Simplicity: Database polling cukup untuk current load
2. Cost: No additional infrastructure required
3. Observability: All job history in one place (JobRuns table)
4. Durability: PostgreSQL ensures no lost jobs

**When to add external queue?**
- When concurrent workers across multiple servers
- When need complex retry/backoff algorithms
- When >1000 jobs/day volume
- When need dead letter queues with rich features

**Why multi-strategy instead of single approach?**
- Different jobs have different requirements
- Poller for real-time, Cron for scheduled, Events for on-demand
- Reduces complexity of queue management
- Better control over job priority

## Operational Considerations

### Monitoring

Track these metrics:
- Job success/failure rate
- Average job duration
- Queue depth (jobs waiting)
- Lock contention events

Alert thresholds:
- Job failure rate > 5% in 1 hour
- Job duration p95 > 2x normal
- Job queue backlog > 100 items

### Scaling Strategy

**Current capacity:**
- Single worker instance
- ~50 concurrent jobs possible
- ~10,000 job runs/month

**Upgrade path:**
1. Add horizontal scaling (multiple worker instances with locks)
2. Migrate to Redis queue when needed
3. Add job priorities (critical vs batch)

### Disaster Recovery

```bash
# Restart all jobs manually
curl -X POST http://localhost:3000/api/worker/run \
  -H "Authorization: Bearer $WORKER_SECRET" \
  -d '{"job": "health-check"}'

# View stuck jobs
SELECT * FROM JobRuns 
WHERE status = 'running' 
  AND finishedAt IS NULL
  AND startedAt < NOW() - INTERVAL '1 hour';

# Reset stuck job
UPDATE JobRuns SET status = 'failed', message = 'Manually reset'
WHERE id = 'stuck-job-id';
```

## Related Decisions

- [ADR-001: Social Bridge Pattern](./ADR-001-social-bridge-pattern.md)
- [ADR-005: Database Sharding Strategy](./ADR-005-database-sharding.md)
- [ADR-006: Cache Invalidation Policy](./ADR-006-cache-policy.md)

## References

- [Worker Integration Guide](../integrators/worker-integration.md)
- [Production Checklist - Section 6](../PRODUCTION-CHECKLIST.md#6-worker-process)
- [Docker Deploy Guide - Worker Setup](../deploy/README-DEPLOY.md)
