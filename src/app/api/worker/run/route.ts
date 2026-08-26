import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { reportError } from "@/lib/error-reporting";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/security";
import { runWorkerJob, type WorkerJobName, WORKER_JOBS } from "@/server/worker-jobs";
import { writeAuditLog } from "@/server/audit";

export async function POST(request: Request) {
  const rate = await consumeRateLimit({
    key: getRequestRateKey(request, "api:worker:run"),
    limit: 120,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const env = getEnv();
  if (!env.WORKER_SECRET) {
    return NextResponse.json(
      { error: "WORKER_SECRET is not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : request.headers.get("x-worker-secret") || "";

  if (!token || !safeEqual(token, env.WORKER_SECRET)) {
    return NextResponse.json({ error: "Unauthorized worker secret" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { job?: string };
  const job = (body.job || "worker.tick") as WorkerJobName;
  if (!WORKER_JOBS.includes(job)) {
    return NextResponse.json(
      { error: `Invalid job. Allowed: ${WORKER_JOBS.join(", ")}` },
      { status: 400 },
    );
  }

  const result = await runWorkerJob(job).catch(async (error) => {
    await reportError(error, { scope: `worker:${job}` });
    return {
      ok: false as const,
      job,
      message: error instanceof Error ? error.message : "Worker job crashed",
      count: 0,
      details: null,
    };
  });
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
  });
}

export async function GET(request: Request) {
  const env = getEnv();
  if (!env.WORKER_SECRET) {
    return NextResponse.json(
      { error: "WORKER_SECRET is not configured" },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : request.headers.get("x-worker-secret") || "";
  if (!token || !safeEqual(token, env.WORKER_SECRET)) {
    return NextResponse.json({ error: "Unauthorized worker secret" }, { status: 401 });
  }

  return NextResponse.json({
    jobs: WORKER_JOBS,
    mode: env.SIMULATOR_MODE ? "simulator" : "live",
  });
}