import { describe, expect, it } from "vitest";
import {
  checkHourlyPace,
  checkMinInterval,
  describePlatformLimits,
  effectiveDailyCommentCap,
  getPlatformGuardrail,
  isRateLimitFailure,
  validateCampaignPacing,
  validatePublishPacing,
} from "@/lib/platform-rate-limits";
import { runSendPreflight } from "@/lib/send-preflight";

describe("platform guardrails", () => {
  it("exposes conservative per-platform caps", () => {
    expect(getPlatformGuardrail("instagram").comments.safePerDay).toBe(50);
    expect(getPlatformGuardrail("threads").comments.safePerDay).toBe(40);
    expect(getPlatformGuardrail("tiktok").comments.safePerDay).toBe(30);
    // TikTok interval is the strictest (most aggressive spam detection)
    expect(getPlatformGuardrail("tiktok").comments.minIntervalSec).toBeGreaterThan(
      getPlatformGuardrail("instagram").comments.minIntervalSec,
    );
  });

  it("falls back to the strictest cap for unknown platforms", () => {
    const g = getPlatformGuardrail("myspace");
    expect(g.comments.safePerDay).toBeLessThanOrEqual(30);
  });

  it("caps new accounts harder than established ones", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    const fresh = effectiveDailyCommentCap({
      platform: "instagram",
      accountCreatedAt: new Date("2026-09-20T12:00:00Z"),
      now,
    });
    const established = effectiveDailyCommentCap({
      platform: "instagram",
      accountCreatedAt: new Date("2026-01-01T00:00:00Z"),
      now,
    });
    expect(fresh).toBeLessThan(established);
    expect(fresh).toBe(15);
  });

  it("lets operators go lower but never higher than the platform cap", () => {
    expect(
      effectiveDailyCommentCap({ platform: "instagram", customDailyQuota: 10 }),
    ).toBe(10);
    expect(
      effectiveDailyCommentCap({ platform: "instagram", customDailyQuota: 500 }),
    ).toBe(50);
  });

  it("blocks hourly bursts", () => {
    const over = checkHourlyPace({
      platform: "instagram",
      kind: "comments",
      sentInLastHour: 12,
    });
    expect(over.ok).toBe(false);
    expect(over.retryAfterSec).toBeGreaterThan(0);
    const room = checkHourlyPace({
      platform: "instagram",
      kind: "comments",
      sentInLastHour: 3,
    });
    expect(room.ok).toBe(true);
    expect(room.remaining).toBe(9);
  });

  it("requires a human-like gap between actions", () => {
    const now = new Date("2026-10-02T12:10:00Z");
    const tooSoon = checkMinInterval({
      platform: "instagram",
      kind: "comments",
      lastActionAt: new Date("2026-10-02T12:09:00Z"),
      now,
    });
    expect(tooSoon.ok).toBe(false);
    expect(tooSoon.waitSec).toBeGreaterThan(0);
    const fine = checkMinInterval({
      platform: "instagram",
      kind: "comments",
      lastActionAt: new Date("2026-10-02T12:00:00Z"),
      now,
    });
    expect(fine.ok).toBe(true);
  });

  it("rejects unsafe campaign pacing at creation time", () => {
    const bad = validateCampaignPacing({
      platform: "instagram",
      dailyLimit: 200,
      minDelaySec: 10,
      maxDelaySec: 20,
    });
    expect(bad.errors.length).toBeGreaterThan(0);
    expect(bad.errors.join(" ")).toMatch(/batas aman|terlalu cepat/i);

    const good = validateCampaignPacing({
      platform: "instagram",
      dailyLimit: 30,
      minDelaySec: 180,
      maxDelaySec: 600,
    });
    expect(good.errors).toEqual([]);
  });

  it("rejects over-frequent publish schedules", () => {
    const bad = validatePublishPacing({ platform: "tiktok", postsPerDay: 20 });
    expect(bad.errors.length).toBeGreaterThan(0);
    const good = validatePublishPacing({ platform: "tiktok", postsPerDay: 2 });
    expect(good.errors).toEqual([]);
  });

  it("classifies platform throttle responses", () => {
    expect(isRateLimitFailure("Request failed with 429")).toBe(true);
    expect(isRateLimitFailure("Action blocked: try again later")).toBe(true);
    expect(isRateLimitFailure("Sorry, this post was flagged as spam")).toBe(true);
    expect(isRateLimitFailure("Invalid access token")).toBe(false);
    expect(isRateLimitFailure(null)).toBe(false);
  });

  it("describes limits for UI copy", () => {
    expect(describePlatformLimits("instagram")).toContain("50/hari");
  });
});

describe("preflight platform enforcement", () => {
  const base = {
    body: "Thanks for sharing this perspective on product ops.",
    account: { status: "healthy", healthScore: 90 },
  };

  it("blocks sends past the platform daily cap even when custom quota is higher", () => {
    const result = runSendPreflight({
      ...base,
      platform: "tiktok",
      account: { ...base.account, actionsToday: 30, dailyQuota: 200 },
    });
    expect(result.blocked).toBe(true);
    expect(result.reasons.join(" ")).toMatch(/batas aman/i);
  });

  it("warns near the cap but still allows", () => {
    const result = runSendPreflight({
      ...base,
      platform: "instagram",
      account: { ...base.account, actionsToday: 42, dailyQuota: 50 },
    });
    expect(result.blocked).toBe(false);
    expect(result.warnings.join(" ")).toMatch(/mendekati/i);
  });

  it("defers (not fails) hourly bursts so the approval is not burned", () => {
    const result = runSendPreflight({
      ...base,
      platform: "instagram",
      account: {
        ...base.account,
        actionsToday: 2,
        dailyQuota: 50,
        lastActionAt: new Date(Date.now() - 60 * 60 * 1000),
      },
      pace: { sentInLastHour: 12 },
    });
    expect(result.blocked).toBe(false);
    expect(result.paceDeferSec).toBeGreaterThan(0);
  });

  it("defers rapid successive sends instead of failing them", () => {
    const result = runSendPreflight({
      ...base,
      platform: "threads",
      account: {
        ...base.account,
        actionsToday: 1,
        dailyQuota: 50,
        lastActionAt: new Date(),
      },
    });
    expect(result.blocked).toBe(false);
    expect(result.paceDeferSec).toBeGreaterThan(0);
    expect(result.warnings.join(" ")).toMatch(/dijadwalkan ulang/i);
  });

  it("applies the stricter new-account cap", () => {
    const createdAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const result = runSendPreflight({
      ...base,
      platform: "instagram",
      account: {
        ...base.account,
        actionsToday: 15,
        dailyQuota: 50,
        createdAt,
        lastActionAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    expect(result.blocked).toBe(true);
  });
});
