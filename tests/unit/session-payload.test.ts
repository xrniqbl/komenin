import { describe, expect, it } from "vitest";
import {
  assertProductionSessionPayload,
  buildSessionPayloadFromCookieMap,
  parseCookieHeader,
  requiredCookieKeys,
} from "@/lib/session-payload";

function igCookies() {
  return [
    { name: "sessionid", value: "IGSESSION123456" },
    { name: "ds_user_id", value: "17841400000000000" },
    { name: "csrftoken", value: "csrf_token_value_1" },
  ];
}

describe("session-payload production import", () => {
  it("requires platform-specific cookies", () => {
    expect(requiredCookieKeys("instagram")).toEqual([
      "sessionid",
      "ds_user_id",
      "csrftoken",
    ]);
    expect(requiredCookieKeys("threads")).toEqual([
      "sessionid",
      "ds_user_id",
      "csrftoken",
    ]);
    expect(requiredCookieKeys("tiktok")).toEqual(["sessionid"]);
  });

  it("normalizes and accepts valid instagram payload", () => {
    const result = assertProductionSessionPayload(
      JSON.stringify({
        platform: "instagram",
        cookies: igCookies(),
        ua: "CustomUA/1.0",
      }),
      "instagram",
      { username: "brand.official" },
    );

    expect(result.cookieNames).toEqual([
      "sessionid",
      "ds_user_id",
      "csrftoken",
    ]);
    expect(result.payload.platform).toBe("instagram");
    expect(result.payload.username).toBe("brand.official");
    expect(result.payload.cookies[0]?.domain).toBe(".instagram.com");
    expect(result.payload.cookies[0]?.httpOnly).toBe(true);
    expect(JSON.parse(result.serialized).meta.cookieCount).toBe(3);
  });

  it("accepts tiktok with only sessionid", () => {
    const result = assertProductionSessionPayload(
      JSON.stringify({
        platform: "tiktok",
        cookies: [{ name: "sessionid", value: "TTSESSION999" }],
      }),
      "tiktok",
    );
    expect(result.cookieNames).toEqual(["sessionid"]);
    expect(result.payload.cookies[0]?.domain).toBe(".tiktok.com");
  });

  it("rejects empty cookies", () => {
    expect(() =>
      assertProductionSessionPayload(
        JSON.stringify({ platform: "instagram", cookies: [] }),
        "instagram",
      ),
    ).toThrow(/cookies are empty/i);
  });

  it("rejects demo cookies", () => {
    expect(() =>
      assertProductionSessionPayload(
        JSON.stringify({
          platform: "instagram",
          cookies: [
            { name: "sessionid", value: "demo_ig_abc" },
            { name: "ds_user_id", value: "1" },
            { name: "csrftoken", value: "x" },
          ],
        }),
        "instagram",
      ),
    ).toThrow(/Demo session cookies are not allowed/i);
  });

  it("rejects missing required cookies", () => {
    expect(() =>
      assertProductionSessionPayload(
        JSON.stringify({
          platform: "threads",
          cookies: [{ name: "sessionid", value: "TH_SESSION" }],
        }),
        "threads",
      ),
    ).toThrow(/Missing required threads cookies/i);
  });

  it("rejects platform mismatch", () => {
    expect(() =>
      assertProductionSessionPayload(
        JSON.stringify({
          platform: "tiktok",
          cookies: igCookies(),
        }),
        "instagram",
      ),
    ).toThrow(/platform mismatch/i);
  });

  it("parses raw cookie headers", () => {
    const parsed = parseCookieHeader(
      "sessionid=abc123; ds_user_id=42; csrftoken=tok; Path=/; Domain=.instagram.com",
    );
    expect(parsed.sessionid).toBe("abc123");
    expect(parsed.ds_user_id).toBe("42");
    expect(parsed.csrftoken).toBe("tok");
    expect(parsed.Path).toBeUndefined();
  });

  it("builds payload from cookie map", () => {
    const payload = buildSessionPayloadFromCookieMap({
      platform: "instagram",
      username: "brand.official",
      values: {
        sessionid: "IGSESSION123456",
        ds_user_id: "17841400000000000",
        csrftoken: "csrf_token_value_1",
      },
    });
    expect(payload.cookies).toHaveLength(3);
    expect(payload.meta.requiredCookies).toContain("sessionid");
  });
});
