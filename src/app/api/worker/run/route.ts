import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { getEnv } from "@/lib/env";
import { reportError } from "@/lib/error-reporting";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { isProductionRuntime, safeEqual } from "@/lib/security";
import { runWorkerJob, type WorkerJobName, WORKER_JOBS } from "@/server/worker-jobs";
import { writeAuditLog } from "@/server/audit";

export async function POST(request: Request) {
  const rate = await consumeRateLimit({
    key: getRequestRateKey(request, "api:worker:run"),
    limit: 120,
    windowMs: 60_000,
    // N7: fail closed like the other secret-gated entrypoints so an Upstash
    // outage cannot open an unauthenticated CPU/DB flood window.
    failClosed: true,
  });
  if (!rate.ok) {
    return apiError("RATE_LIMITED", 429);
  }
  let env;
  try {
    env = getEnv();
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }
  if (!env.WORKER_SECRET) {
    return apiError("NOT_CONFIGURED", 503, "WORKER_SECRET is not configured");
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : request.headers.get("x-worker-secret") || "";

  if (!token || !safeEqual(token, env.WORKER_SECRET)) {
    return apiError("INVALID_CREDENTIALS", 401, "Unauthorized worker secret");
  }

  const body = (await request.json().catch(() => ({}))) as { job?: string };
  const job = (body.job || "worker.tick") as WorkerJobName;
  if (!WORKER_JOBS.includes(job)) {
    return apiError("INVALID_JOB", 400, `Invalid job. Allowed: ${WORKER_JOBS.join(", ")}`);
  }

  const result = await runWorkerJob(job).catch(async (error) => {
    await reportError(error, { scope: `worker:${job}` });
    return {
      ok: false as const,
      job,
      message: "Worker job failed",
      count: 0,
      details: null,
    };
  });
  // writeAuditLog is best-effort (never throws): a logging outage must not
  // turn a successful job into a 500.
  await writeAuditLog({
    action: `worker.${job}`,
    resourceType: "worker",
    resourceId: job,
    metadata: {
      ok: result.ok,
      message: result.message,
      count: result.count ?? null,
      mode: env.SIMULATOR_MODE ? "simulator" : "live",
    },
  });

  return NextResponse.json({
    ok: result.ok,
    job: result.job,
    message: result.message,
    count: result.count ?? 0,
    details: result.details ?? null,
    mode: env.SIMULATOR_MODE ? "simulator" : "live",
  }, { status: result.ok ? 200 : 500 });
}

export async function GET(request: Request) {
  // The job catalogue is a recon aid. Hide it in production — operators use
  // the contract in docs/integrators/worker-integration.md. POST runs jobs.
  if (isProductionRuntime()) {
    return apiError("NOT_FOUND", 404);
  }
  let env;
  try {
    env = getEnv();
  } catch {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }
  if (!env.WORKER_SECRET) {
    return apiError("NOT_CONFIGURED", 503, "WORKER_SECRET is not configured");
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : request.headers.get("x-worker-secret") || "";
  if (!token || !safeEqual(token, env.WORKER_SECRET)) {
    return apiError("INVALID_CREDENTIALS", 401, "Unauthorized worker secret");
  }

  return NextResponse.json({
    jobs: WORKER_JOBS,
    mode: env.SIMULATOR_MODE ? "simulator" : "live",
  });
}