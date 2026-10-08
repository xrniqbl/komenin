import { beforeEach, describe, expect, it, vi } from "vitest";

const runWorkerJob = vi.hoisted(() => vi.fn());
vi.mock("@/server/worker-jobs", () => ({ runWorkerJob, WORKER_JOBS: ["listener.poll"] }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ WORKER_SECRET: "worker-secret-123456", SIMULATOR_MODE: true }) }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: () => Promise.resolve({ ok: true }), getRequestRateKey: () => "test" }));
vi.mock("@/server/audit", () => ({ writeAuditLog: () => Promise.resolve() }));
vi.mock("@/lib/error-reporting", () => ({ reportError: () => Promise.resolve() }));

import { POST } from "@/app/api/worker/run/route";

const request = () => new Request("http://localhost/api/worker/run", {
  method: "POST", headers: { authorization: "Bearer worker-secret-123456", "content-type": "application/json" },
  body: JSON.stringify({ job: "listener.poll" }),
});

beforeEach(() => runWorkerJob.mockReset());

describe("worker run HTTP outcome", () => {
  it("returns non-2xx when a job reports failure so schedulers retry", async () => {
    runWorkerJob.mockResolvedValue({ ok: false, job: "listener.poll", message: "discovery failed" });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, message: "discovery failed" });
  });

});
