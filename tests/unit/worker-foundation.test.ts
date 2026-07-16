import { describe, expect, it } from "vitest";
import { WORKER_JOBS } from "@/server/worker-jobs";
import { describeSendResult } from "@/lib/runtime-mode";

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
      ]),
    );
  });

  it("describes simulator send results", () => {
    expect(describeSendResult("simulator")).toMatch(/simulator/i);
    expect(describeSendResult("live")).toMatch(/live/i);
  });
});
