import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { runWorkerJob, type WorkerJobName, WORKER_JOBS } from "@/server/worker-jobs";
import { writeAuditLog } from "@/server/audit";

export async function POST(request: Request) {
  const env = getEnv();
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : request.headers.get("x-worker-secret") || "";

  if (!env.WORKER_SECRET || token !== env.WORKER_SECRET) {
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

  const result = await runWorkerJob(job);
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

export async function GET() {
  return NextResponse.json({
    jobs: WORKER_JOBS,
    mode: getEnv().SIMULATOR_MODE ? "simulator" : "live",
  });
}