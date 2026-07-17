import { db } from "@/lib/db";

export async function getPublicStatus() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [recentJobs, recentHealth, deliveryStats, failedJobs] = await Promise.all([
    db.jobRun.findMany({
      where: { startedAt: { gte: dayAgo } },
      select: { job: true, status: true, startedAt: true },
      orderBy: { startedAt: "desc" },
      take: 100,
    }),
    db.sessionHealthCheck.findMany({
      where: { createdAt: { gte: dayAgo } },
      select: { ok: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.deliveryLog.groupBy({
      by: ["kind"],
      where: { createdAt: { gte: dayAgo } },
      _count: true,
    }),
    db.jobRun.findMany({
      where: { status: "failed", startedAt: { gte: monthAgo } },
      select: { job: true, message: true, startedAt: true },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
  ]);

  const totalJobs = recentJobs.length;
  const succeededJobs = recentJobs.filter((j) => j.status === "succeeded").length;
  const successRate24h = totalJobs > 0 ? Math.round((succeededJobs / totalJobs) * 100) : 100;

  const totalHealth = recentHealth.length;
  const okHealth = recentHealth.filter((h) => h.ok).length;
  const healthRate = totalHealth > 0 ? Math.round((okHealth / totalHealth) * 100) : 100;

  // Uptime buckets per day last 30d from job runs
  const jobGroups = new Map<string, { total: number; ok: number }>();
  const allJobsMonth = await db.jobRun.findMany({
    where: { startedAt: { gte: monthAgo } },
    select: { status: true, startedAt: true },
    orderBy: { startedAt: "asc" },
  });
  for (const j of allJobsMonth) {
    const key = j.startedAt.toISOString().slice(0, 10);
    const g = jobGroups.get(key) || { total: 0, ok: 0 };
    g.total += 1;
    if (j.status === "succeeded") g.ok += 1;
    jobGroups.set(key, g);
  }
  const uptimeBuckets = Array.from(jobGroups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { total, ok }]) => ({
      date,
      uptime: total > 0 ? Math.round((ok / total) * 100) : 100,
      total,
    }));

  const overallUptime = uptimeBuckets.length > 0
    ? Math.round(uptimeBuckets.reduce((sum, b) => sum + b.uptime, 0) / uptimeBuckets.length)
    : 100;

  return {
    checkedAt: now.toISOString(),
    services: [
      { name: "Web App", status: "operational" as const, latency: null },
      { name: "Worker", status: successRate24h > 80 ? ("operational" as const) : ("degraded" as const), uptime: successRate24h, latency: null },
      { name: "Session Probes", status: healthRate > 80 ? ("operational" as const) : ("degraded" as const), uptime: healthRate, latency: null },
      { name: "Delivery", status: "operational" as const, stats: deliveryStats.map((d) => ({ kind: d.kind, count: d._count })), latency: null },
    ],
    uptime: {
      overall: overallUptime,
      buckets: uptimeBuckets,
      successRate24h,
      healthRate,
    },
    incidents: failedJobs.map((j) => ({
      title: `${j.job} failed`,
      message: j.message || "Worker job failed",
      at: j.startedAt.toISOString(),
    })),
    counts: {
      jobs24h: totalJobs,
      succeeded24h: succeededJobs,
      failed24h: totalJobs - succeededJobs,
      healthChecks24h: totalHealth,
    },
  };
}
