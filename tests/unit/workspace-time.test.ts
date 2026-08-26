import { describe, expect, it } from "vitest";

import { hourInTimezone, isInQuietHours } from "@/lib/workspace-time";

describe("workspace-time", () => {
  const utcNoon = new Date("2026-08-12T12:00:00Z");

  it("hourInTimezone returns UTC hour when no timezone given", () => {
    expect(hourInTimezone(utcNoon)).toBe(12);
    expect(hourInTimezone(utcNoon, null)).toBe(12);
  });

  it("hourInTimezone converts to an IANA zone", () => {
    // Jakarta is UTC+7.
    expect(hourInTimezone(utcNoon, "Asia/Jakarta")).toBe(19);
  });

  it("hourInTimezone falls back to UTC on an invalid zone", () => {
    expect(hourInTimezone(utcNoon, "Not/A_Zone")).toBe(12);
  });

  it("isInQuietHours handles a same-day window", () => {
    // 19:00 Jakarta is inside 18:00-22:00.
    expect(
      isInQuietHours({
        date: utcNoon,
        timeZone: "Asia/Jakarta",
        startHour: 18,
        endHour: 22,
      }),
    ).toBe(true);
    expect(
      isInQuietHours({
        date: utcNoon,
        timeZone: "Asia/Jakarta",
        startHour: 20,
        endHour: 23,
      }),
    ).toBe(false);
  });

  it("isInQuietHours supports overnight windows", () => {
    expect(
      isInQuietHours({
        date: utcNoon,
        timeZone: "Asia/Jakarta",
        startHour: 18,
        endHour: 6,
      }),
    ).toBe(true);
    expect(
      isInQuietHours({
        date: utcNoon,
        timeZone: "Asia/Jakarta",
        startHour: 1,
        endHour: 5,
      }),
    ).toBe(false);
  });

  it("isInQuietHours is disabled when start equals end", () => {
    expect(
      isInQuietHours({
        date: utcNoon,
        timeZone: "Asia/Jakarta",
        startHour: 19,
        endHour: 19,
      }),
    ).toBe(false);
  });
});
