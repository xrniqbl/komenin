import { describe, expect, it } from "vitest";
import { WORKER_JOBS } from "@/server/worker-jobs";
import { describeSendResult } from "@/lib/runtime-mode";
import { classifyWorkerError } from "@/lib/metrics/worker-metrics";

describe("worker foundation", () => {
  it("exposes required production jobs", () => {
    expect(WORKER_JOBS).toEqual(
      expect.arrayContaining([
        "worker.tick",
        "session.health_check",
        "proxy.rotate",
        "listener.poll",
        "comment.generate",
        "comment.send",
        "content.generate",
        "content.publish",
        "knowledge.ingest",
        "skill.execute",
        "usage.rollup",
        "notify.dispatch",
        "billing.expire",
      ]),
    );
  });

  it("describes simulator send results", () => {
    expect(describeSendResult("simulator")).toMatch(/simulator/i);
    expect(describeSendResult("live")).toMatch(/live/i);
  });
});

describe("classifyWorkerError", () => {
  it("buckets free-form failure messages into bounded labels", () => {
    expect(classifyWorkerError("Mentions: 0 drafted, 2 failed:quota")).toBe("quota");
    expect(classifyWorkerError("Preflight blocked: banned topic")).toBe("preflight");
    expect(classifyWorkerError("Request timeout after 20000ms")).toBe("connector");
    expect(classifyWorkerError("fetch failed: ECONNRESET")).toBe("connector");
    expect(classifyWorkerError("Payment webhook rejected")).toBe("billing");
    expect(classifyWorkerError("Unauthorized cron secret")).toBe("auth");
    expect(classifyWorkerError("something entirely novel")).toBe("unknown");
  });

  it("never returns the raw message (unbounded cardinality guard)", () => {
    const noisy = `Boom ${Math.random()} ${"x".repeat(200)}`;
    const label = classifyWorkerError(noisy);
    expect(label.length).toBeLessThanOrEqual(10);
  });
});
