import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
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
 * Scheduled worker entrypoint for Vercel Cron.
 *
 * Vercel Cron issues a GET request with `Authorization: Bearer $CRON_SECRET`.
 * We also accept `WORKER_SECRET` (via Bearer or `x-worker-secret`) so the same
 * endpoint can be driven by an external scheduler (GitHub Actions, cron-job.org,
 * UptimeRobot, etc.) when not deploying on Vercel.
 *
 * The job defaults to `worker.tick`, which fans out to all worker jobs via
 * `Promise.allSettled`. Pass `?job=<name>` to run a single job on its own cadence.
 */
export async function GET(request: Request) {
  const env = getEnv();

  if (!env.CRON_SECRET && !env.WORKER_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET or WORKER_SECRET must be configured" },
      { status: 503 },
    );
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
    return NextResponse.json({ error: "Unauthorized cron secret" }, { status: 401 });
  }

  const jobParam = new URL(request.url).searchParams.get("job") || "worker.tick";
  const job = jobParam as WorkerJobName;
  if (!WORKER_JOBS.includes(job)) {
    return NextResponse.json(
      { error: `Invalid job. Allowed: ${WORKER_JOBS.join(", ")}` },
      { status: 400 },
    );
  }

  const result = await runWorkerJob(job);

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
