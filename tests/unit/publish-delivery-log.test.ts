import { describe, expect, it } from "vitest";
import { appendPublishDelivery, listPublishDeliveries } from "@/lib/publish-delivery-log";

describe("publish delivery log", () => {
  it("appends and lists deliveries", async () => {
    const created = await appendPublishDelivery({
      platform: "instagram",
      username: "brand",
      accountId: "acc_1",
      title: "Test",
      body: "Hello webhook",
      hashtags: ["ai"],
      caption: "Test\n\nHello webhook\n\n#ai",
      scheduledFor: null,
      publishedAt: new Date().toISOString(),
    });
    expect(created.externalPostId).toBeTruthy();
    const rows = await listPublishDeliveries(10);
    expect(rows.some((row) => row.id === created.id)).toBe(true);
  });
});