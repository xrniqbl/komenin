import { describe, expect, it } from "vitest";

import {
  dailyActionIncrementData,
  effectiveActionsToday,
  isSameUtcDay,
  startOfUtcDay,
} from "@/lib/account-quota";

describe("account-quota daily reset", () => {
  const today = new Date("2026-08-12T10:00:00Z");

  it("startOfUtcDay strips the time component", () => {
    expect(startOfUtcDay(today).toISOString()).toBe("2026-08-12T00:00:00.000Z");
  });

  it("isSameUtcDay compares UTC day boundaries", () => {
    expect(isSameUtcDay(today, new Date("2026-08-12T23:59:59Z"))).toBe(true);
    expect(isSameUtcDay(today, new Date("2026-08-13T00:00:00Z"))).toBe(false);
  });

  it("effectiveActionsToday resets when last action crossed the day boundary", () => {
    const stale = {
      actionsToday: 50,
      dailyQuota: 50,
      lastActionAt: new Date("2026-08-11T23:00:00Z"),
    };
    expect(effectiveActionsToday(stale, today)).toBe(0);

    const fresh = {
      actionsToday: 50,
      dailyQuota: 50,
      lastActionAt: new Date("2026-08-12T01:00:00Z"),
    };
    expect(effectiveActionsToday(fresh, today)).toBe(50);
  });

  it("never counts actions before the last one was recorded", () => {
    expect(
      effectiveActionsToday(
        { actionsToday: 5, dailyQuota: 50, lastActionAt: null },
        today,
      ),
    ).toBe(5);
  });

  it("increments within the day but restarts at 1 on a new day", () => {
    const sameDay = dailyActionIncrementData(
      { actionsToday: 3, dailyQuota: 50, lastActionAt: new Date("2026-08-12T02:00:00Z") },
      today,
    );
    expect(sameDay.actionsToday).toEqual({ increment: 1 });

    const newDay = dailyActionIncrementData(
      { actionsToday: 49, dailyQuota: 50, lastActionAt: new Date("2026-08-11T20:00:00Z") },
      today,
    );
    expect(newDay.actionsToday).toBe(1);
  });
});
