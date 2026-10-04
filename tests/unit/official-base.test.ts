import { describe, expect, it } from "vitest";
import { isAllowedOfficialApiBaseUrl } from "@/lib/connectors/official-base";

describe("official base allowlist", () => {
  it("allows pinned provider hosts", () => {
    expect(isAllowedOfficialApiBaseUrl("https://graph.facebook.com/v21.0")).toBe(true);
    expect(isAllowedOfficialApiBaseUrl("https://open.tiktokapis.com/v2")).toBe(true);
    expect(isAllowedOfficialApiBaseUrl("https://sub.graph.threads.net/x")).toBe(true);
  });

  it("rejects non-provider, private, and localhost hosts", () => {
    expect(isAllowedOfficialApiBaseUrl("https://evil.example.com/x")).toBe(false);
    expect(isAllowedOfficialApiBaseUrl("http://127.0.0.1:8787/bridge")).toBe(false);
    expect(isAllowedOfficialApiBaseUrl("http://192.168.1.10/x")).toBe(false);
    expect(isAllowedOfficialApiBaseUrl("not-a-url")).toBe(false);
  });
});
