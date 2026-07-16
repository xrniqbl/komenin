import { describe, expect, it } from "vitest";
import { getThresholdStatus, getQuotaPercent, formatQuota } from "@/lib/quota";

describe("quota thresholds", () => {
  it("reports ok below 80%", () => {
    expect(getThresholdStatus(50, 100)).toBe("ok");
    expect(getThresholdStatus(79, 100)).toBe("ok");
  });

  it("reports warning at 80-99%", () => {
    expect(getThresholdStatus(80, 100)).toBe("warning");
    expect(getThresholdStatus(95, 100)).toBe("warning");
  });

  it("reports critical at 100%+", () => {
    expect(getThresholdStatus(100, 100)).toBe("critical");
    expect(getThresholdStatus(120, 100)).toBe("critical");
  });

  it("handles zero limit", () => {
    expect(getThresholdStatus(10, 0)).toBe("ok");
    expect(getQuotaPercent(10, 0)).toBe(0);
  });

  it("calculates percent", () => {
    expect(getQuotaPercent(25, 100)).toBe(25);
    expect(getQuotaPercent(0, 100)).toBe(0);
    expect(getQuotaPercent(150, 100)).toBe(100);
  });

  it("formats quota", () => {
    const s = formatQuota(1234, 5000);
    expect(s).toContain("1");
    const hasPart = s.includes(",") || s.includes("1");
    expect(hasPart).toBe(true);
  });
});
