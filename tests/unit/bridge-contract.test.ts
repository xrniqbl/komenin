import { describe, expect, it } from "vitest";
import { parseBridgeSuccessPayload } from "@/lib/connectors/bridge-contract";

describe("bridge contract v1", () => {
  it("accepts empty discover posts as success", () => {
    const result = parseBridgeSuccessPayload({
      action: "discoverPosts",
      payload: { ok: true, posts: [] },
      platform: "instagram",
      httpStatus: 200,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.posts).toEqual([]);
  });

  it("filters malformed discover posts and keeps valid ones", () => {
    const result = parseBridgeSuccessPayload({
      action: "discoverPosts",
      payload: {
        posts: [
          {
            externalId: "p1",
            authorHandle: "a",
            content: "hi",
            url: "https://example.com/1",
            platform: "instagram",
          },
          { externalId: "bad" },
        ],
      },
      platform: "instagram",
      httpStatus: 200,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.posts).toHaveLength(1);
      expect(result.posts?.[0]?.externalId).toBe("p1");
    }
  });

  it("fails when posts is not an array", () => {
    const result = parseBridgeSuccessPayload({
      action: "discoverPosts",
      payload: { posts: "nope" },
      platform: "instagram",
      httpStatus: 200,
    });
    expect(result.ok).toBe(false);
  });

  it("fails on ok:false even with HTTP 200", () => {
    const result = parseBridgeSuccessPayload({
      action: "sendComment",
      payload: { ok: false, error: "upstream denied" },
      platform: "threads",
      httpStatus: 200,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/upstream denied/i);
  });

  it("fails on non-object JSON body", () => {
    const result = parseBridgeSuccessPayload({
      action: "publishPost",
      payload: "sent",
      httpStatus: 200,
    });
    expect(result.ok).toBe(false);
  });

  it("accepts sendComment with externalId aliases", () => {
    const result = parseBridgeSuccessPayload({
      action: "sendComment",
      payload: { externalPostId: "c_99", message: "queued" },
      platform: "instagram",
      httpStatus: 200,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.externalId).toBe("c_99");
  });
});
