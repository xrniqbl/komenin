import { describe, expect, it } from "vitest";
import { getMonthMatrix, getWeekDays, dateKey, isSameDay, formatCalTitle, addMonths, addDays } from "@/lib/content-calendar-utils";

describe("content-calendar-utils", () => {
  it("dateKey formats YYYY-MM-DD", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dateKey(new Date(2026, 11, 25))).toBe("2026-12-25");
  });

  it("isSameDay works", () => {
    const a = new Date(2026, 5, 15, 10, 0);
    const b = new Date(2026, 5, 15, 22, 30);
    const c = new Date(2026, 5, 16);
    expect(isSameDay(a, b)).toBe(true);
    expect(isSameDay(a, c)).toBe(false);
  });

  it("getMonthMatrix produces weeks", () => {
    const matrix = getMonthMatrix(new Date(2026, 0, 1)); // Jan 2026
    expect(matrix.length).toBeGreaterThan(0);
    expect(matrix.length).toBeLessThanOrEqual(6);
    for (const week of matrix) {
      expect(week.length).toBe(7);
    }
    // First week should contain Jan 1
    const hasJan1 = matrix.flat().some((d) => d && d.getDate() === 1 && d.getMonth() === 0);
    expect(hasJan1).toBe(true);
  });

  it("getWeekDays returns 7 days Mon-Sun", () => {
    const days = getWeekDays(new Date(2026, 6, 15)); // Wednesday
    expect(days.length).toBe(7);
    // Monday first
    expect(days[0].getDay()).toBe(1); // Mon
    expect(days[6].getDay()).toBe(0); // Sun
  });

  it("formatCalTitle formats month/year", () => {
    const title = formatCalTitle("month", new Date(2026, 0, 1));
    expect(title.toLowerCase()).toContain("january");
    expect(title).toContain("2026");
  });

  it("addMonths/addDays", () => {
    const base = new Date(2026, 0, 15);
    expect(addMonths(base, 1).getMonth()).toBe(1);
    expect(addDays(base, 7).getDate()).toBe(22);
  });
});
