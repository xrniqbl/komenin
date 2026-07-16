import { describe, expect, it } from "vitest";
import { buildContentSchedule } from "@/lib/content-engine";

describe("content schedule", () => {
  it("builds interval timestamps", () => {
    const start = new Date("2026-07-15T00:00:00.000Z");
    const schedule = buildContentSchedule({
      startAt: start,
      postCount: 3,
      intervalValue: 2,
      intervalUnit: "hours",
    });
    expect(schedule).toHaveLength(3);
    expect(schedule[0].toISOString()).toBe("2026-07-15T00:00:00.000Z");
    expect(schedule[1].toISOString()).toBe("2026-07-15T02:00:00.000Z");
    expect(schedule[2].toISOString()).toBe("2026-07-15T04:00:00.000Z");
  });
});