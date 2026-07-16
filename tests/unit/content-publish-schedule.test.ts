import { describe, expect, it } from "vitest";
import { groupScheduleByDay } from "@/lib/content-schedule";
import { publishSocialPost } from "@/lib/publish-connector";

describe("content schedule calendar", () => {
  it("groups items by day", () => {
    const groups = groupScheduleByDay([
      {
        id: "1",
        sequence: 1,
        title: "A",
        status: "scheduled",
        scheduledFor: new Date("2026-07-15T02:00:00.000Z"),
      },
      {
        id: "2",
        sequence: 2,
        title: "B",
        status: "scheduled",
        scheduledFor: new Date("2026-07-15T08:00:00.000Z"),
      },
      {
        id: "3",
        sequence: 3,
        title: "C",
        status: "scheduled",
        scheduledFor: new Date("2026-07-16T01:00:00.000Z"),
      },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(1);
  });
});

describe("publish connector", () => {
  it("publishes in simulator mode", async () => {
    const result = await publishSocialPost({
      forceMode: "simulator",
      target: { platform: "instagram", username: "brand" },
      payload: { title: "Hello", body: "World", hashtags: ["ai"] },
    });
    expect(result.ok).toBe(true);
    expect(result.connector).toBe("simulator");
    expect(result.externalPostId).toMatch(/^sim_/);
  });

  it("fails closed in live mode without webhook", async () => {
    const previousWebhook = process.env.SOCIAL_PUBLISH_WEBHOOK_URL;
    const previousOfficial = process.env.SOCIAL_OFFICIAL_API_TOKEN;
    const previousIg = process.env.INSTAGRAM_ACCESS_TOKEN;
    const previousThreads = process.env.THREADS_ACCESS_TOKEN;
    const previousTiktok = process.env.TIKTOK_ACCESS_TOKEN;

    delete process.env.SOCIAL_PUBLISH_WEBHOOK_URL;
    delete process.env.SOCIAL_OFFICIAL_API_TOKEN;
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.THREADS_ACCESS_TOKEN;
    delete process.env.TIKTOK_ACCESS_TOKEN;

    try {
      const result = await publishSocialPost({
        forceMode: "live",
        target: { platform: "instagram", username: "brand" },
        payload: { body: "Live post" },
        webhook: null,
        official: null,
        policy: "prefer_webhook",
      });
      expect(result.ok).toBe(false);
      expect(["live_stub", "none"]).toContain(result.connector);
    } finally {
      if (previousWebhook) process.env.SOCIAL_PUBLISH_WEBHOOK_URL = previousWebhook;
      if (previousOfficial) process.env.SOCIAL_OFFICIAL_API_TOKEN = previousOfficial;
      if (previousIg) process.env.INSTAGRAM_ACCESS_TOKEN = previousIg;
      if (previousThreads) process.env.THREADS_ACCESS_TOKEN = previousThreads;
      if (previousTiktok) process.env.TIKTOK_ACCESS_TOKEN = previousTiktok;
    }
  });
});
