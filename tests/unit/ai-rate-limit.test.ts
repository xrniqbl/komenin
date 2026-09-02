import { describe, expect, it } from "vitest";
import { resolveAiRateLimitPerMinute } from "@/lib/ai/router";

/**
 * Security: the AI gateway rate limit must be clamped so a misconfigured env
 * can neither fully disable the gateway (DoS on ourselves) nor silently open
 * it (unbounded upstream spend).
 */
describe("resolveAiRateLimitPerMinute", () => {
  it("defaults to 60 when unset / empty", () => {
    expect(resolveAiRateLimitPerMinute(undefined)).toBe(60);
    expect(resolveAiRateLimitPerMinute("")).toBe(60);
  });

  it("clamps zero / negative / non-numeric to the safe default, never to open", () => {
    expect(resolveAiRateLimitPerMinute("0")).toBe(60);
    expect(resolveAiRateLimitPerMinute("-50")).toBe(60);
    expect(resolveAiRateLimitPerMinute("abc")).toBe(60);
    expect(resolveAiRateLimitPerMinute("NaN")).toBe(60);
  });

  it("enforces a floor of 1 and a ceiling of 600", () => {
    expect(resolveAiRateLimitPerMinute("0.5")).toBe(1);
    expect(resolveAiRateLimitPerMinute("1")).toBe(1);
    expect(resolveAiRateLimitPerMinute("999999")).toBe(600);
  });

  it("accepts a normal value within the band", () => {
    expect(resolveAiRateLimitPerMinute("120")).toBe(120);
    expect(resolveAiRateLimitPerMinute("60")).toBe(60);
  });
});
