import { describe, expect, it } from "vitest";
import { describeSendResult } from "@/lib/runtime-mode";
import { WORKER_JOBS } from "@/server/worker-jobs";

describe("worker foundation", () => {
  it("exposes required MVP jobs", () => {
    expect(WORKER_JOBS).toEqual(
      expect.arrayContaining([
        "worker.tick",
        "session.health_check",
        "listener.poll",
        "comment.generate",
        "comment.send",
      ]),
    );
  });

  it("describes simulator send results", () => {
    expect(describeSendResult("simulator")).toMatch(/simulator/i);
    expect(describeSendResult("live")).toMatch(/live/i);
  });
});