import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { getEnv } from "@/lib/env";
import { getWorkerMetrics } from "@/lib/metrics/worker-metrics";
import { isProductionRuntime, safeEqual } from "@/lib/security";
import { runWorkerJob, type WorkerJobName, WORKER_JOBS } from "@/server/worker-jobs";
import { writeAuditLog } from "@/server/audit";

export const runtime = "nodejs";
// Cron invocations must always execute fresh, never be statically cached.
export const dynamic = "force-dynamic";
// Full worker.tick fans out many jobs; give the function the max hobby/pro window.
// Prefer splitting crons or a dedicated worker process for heavier live workloads.
export const maxDuration = 60;

/**
 * Scheduled worker entrypoint for an external scheduler (systemd timer, cron,
 * GitHub Actions, cron-job.org, UptimeRobot, etc.).
 *
 * The scheduler issues a GET request with `Authorization: Bearer $CRON_SECRET`.
 * We also accept `WORKER_SECRET` (via Bearer or `x-worker-secret`).
 *
 * The job defaults to `worker.tick`, which fans out to all worker jobs via
 * `Promise.allSettled`. Pass `?job=<name>` to run a single job on its own cadence.
 */
export async function GET(request: Request) {
  let env;
  try {
    env = getEnv();
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  if (!env.CRON_SECRET && !env.WORKER_SECRET) {
    return apiError("NOT_CONFIGURED", 503, "CRON_SECRET or WORKER_SECRET must be configured");
  }

  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  const token = bearer || request.headers.get("x-worker-secret") || "";

  const authorized =
    (!!env.CRON_SECRET && safeEqual(token, env.CRON_SECRET)) ||
    (!!env.WORKER_SECRET && safeEqual(token, env.WORKER_SECRET));

  if (!token || !authorized) {
    return apiError("INVALID_CREDENTIALS", 401, "Unauthorized cron secret");
  }

  const jobParam = new URL(request.url).searchParams.get("job") || "worker.tick";
  const job = jobParam as WorkerJobName;
  if (!WORKER_JOBS.includes(job)) {
    return apiError("INVALID_JOB", 400, `Invalid job. Allowed: ${WORKER_JOBS.join(", ")}`);
  }

  const startedAt = Date.now();
  // runWorkerJob touches the DB before its internal try/catch (re-entrancy
  // guard + jobRun row), so a DB blip throws here. Catch so the scheduler
  // gets a structured JSON failure instead of a 500 HTML page.
  let result: Awaited<ReturnType<typeof runWorkerJob>>;
  try {
    result = await runWorkerJob(job);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        job,
        message: "Service temporarily unavailable",
        count: 0,
        details: null,
        mode: env.SIMULATOR_MODE ? "simulator" : "live",
      },
      { status: 503 },
    );
  }
  // F4: record job duration/success so failure-rate alerts actually fire.
  const metrics = getWorkerMetrics();
  if (result.ok) {
    metrics.onJobComplete(job, Date.now() - startedAt);
  } else {
    metrics.onJobFailure(job, Date.now() - startedAt, result.message.slice(0, 80));
  }

  await writeAuditLog({
    action: `worker.cron.${job}`,
    resourceType: "worker",
    resourceId: job,
    metadata: {
      ok: result.ok,
      message: result.message,
      count: result.count ?? null,
      mode: env.SIMULATOR_MODE ? "simulator" : "live",
      trigger: "cron",
      runtime: isProductionRuntime() ? "production" : "development",
    },
  });

  return NextResponse.json(
    {
      ok: result.ok,
      job: result.job,
      message: result.message,
      count: result.count ?? 0,
      details: result.details ?? null,
      mode: env.SIMULATOR_MODE ? "simulator" : "live",
    },
    { status: result.ok ? 200 : 500 },
  );
}
