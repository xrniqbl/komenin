import { describe, expect, it } from "vitest";
import { handleMockBridgeRequest } from "../../bridges/mock-social/handler";

describe("mock social bridge handler", () => {
  it("returns 1+ valid discover posts for a query", () => {
    const res = handleMockBridgeRequest({
      action: "discoverPosts",
      platform: "instagram",
      query: "kopi",
      limit: 2,
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.posts)).toBe(true);
    const posts = res.body.posts as Array<Record<string, string>>;
    expect(posts.length).toBeGreaterThanOrEqual(1);
    expect(posts.length).toBeLessThanOrEqual(2);
    for (const p of posts) {
      expect(p.externalId).toBeTruthy();
      expect(p.authorHandle).toBeTruthy();
      expect(p.content).toBeTruthy();
      expect(p.url).toBeTruthy();
      expect(p.platform).toBe("instagram");
    }
  });

  it("returns mock_ externalId for sendComment and publishPost", () => {
    const comment = handleMockBridgeRequest({
      action: "sendComment",
      platform: "threads",
      body: "nice post",
      targetPostExternalId: "post_1",
    });
    expect(comment.status).toBe(200);
    expect(String(comment.body.externalId || "")).toMatch(/^mock_/);

    const publish = handleMockBridgeRequest({
      action: "publishPost",
      platform: "instagram",
      body: "hello world",
      caption: "hello world",
    });
    expect(publish.status).toBe(200);
    expect(String(publish.body.externalId || "")).toMatch(/^mock_/);
  });

  it("healthProbe returns healthy true and rotateProxy returns TEST-NET ip", () => {
    const health = handleMockBridgeRequest({
      action: "healthProbe",
      platform: "instagram",
      hasSession: true,
      proxyHealthy: true,
    });
    expect(health.status).toBe(200);
    expect(health.body.healthy).toBe(true);

    const rotate = handleMockBridgeRequest({
      action: "rotateProxy",
      platform: "instagram",
      proxyId: "px1",
      seed: "abc",
    });
    expect(rotate.status).toBe(200);
    expect(rotate.body.ip).toBe("203.0.113.10");
  });

  it("rejects unknown action with 400 ok false", () => {
    const res = handleMockBridgeRequest({ action: "nope", platform: "instagram" });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(String(res.body.error || res.body.message || "")).toMatch(/unsupported|unknown/i);
  });
});
