import { describe, expect, it } from "vitest";
import { isValidMediaUrl, publishSocialPost } from "@/lib/publish-connector";

describe("mediaUrl validation (publish)", () => {
  it("accepts public https URLs", () => {
    expect(isValidMediaUrl("https://cdn.example.com/photo.jpg")).toBe(true);
    expect(isValidMediaUrl("http://images.example.org/p.png")).toBe(true);
  });

  it("accepts empty/null/undefined (optional field)", () => {
    expect(isValidMediaUrl(null)).toBe(true);
    expect(isValidMediaUrl(undefined)).toBe(true);
    expect(isValidMediaUrl("")).toBe(true);
    expect(isValidMediaUrl("   ")).toBe(true);
  });

  it("rejects non-http protocols", () => {
    expect(isValidMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isValidMediaUrl("data:image/png;base64,xxx")).toBe(false);
    expect(isValidMediaUrl("ftp://files.example.com/x.jpg")).toBe(false);
    expect(isValidMediaUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects local/private hosts", () => {
    expect(isValidMediaUrl("http://localhost/img.jpg")).toBe(false);
    expect(isValidMediaUrl("https://127.0.0.1/img.jpg")).toBe(false);
    expect(isValidMediaUrl("https://sub.localhost/img.jpg")).toBe(false);
    expect(isValidMediaUrl("https://192.168.1.5/img.jpg")).toBe(false);
    expect(isValidMediaUrl("https://10.0.0.3/img.jpg")).toBe(false);
    expect(isValidMediaUrl("https://172.16.2.1/img.jpg")).toBe(false);
    expect(isValidMediaUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
  });

  it("rejects garbage that is not a URL", () => {
    expect(isValidMediaUrl("not a url")).toBe(false);
    expect(isValidMediaUrl("example.com/photo.jpg")).toBe(false);
  });

  it("publishSocialPost fails closed on an invalid media URL", async () => {
    const result = await publishSocialPost({
      target: { platform: "instagram", username: "brand", workspaceId: "w1" },
      payload: {
        title: "x",
        body: "y",
        mediaUrl: "javascript:alert(1)",
      },
      forceMode: "simulator",
      webhook: null,
      official: null,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Invalid media URL/i);
    expect(result.connector).toBe("none");
  });
});
