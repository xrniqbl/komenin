import { describe, expect, it } from "vitest";
import { parseInviteEmails } from "@/lib/invite-emails";
import { sanitizeCallbackUrl } from "@/lib/callback-url";
import { escapeCsvValue } from "@/lib/csv";

describe("parseInviteEmails", () => {
  it("splits comma, semicolon, and whitespace separators", () => {
    const result = parseInviteEmails("a@x.com; b@x.com\nc@x.com d@x.com");
    expect(result.emails).toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]);
    expect(result.skippedInvalid).toEqual([]);
  });

  it("dedupes, lowercases, and reports invalid entries", () => {
    const result = parseInviteEmails("A@x.com, a@x.com, not-an-email");
    expect(result.emails).toEqual(["a@x.com"]);
    expect(result.skippedInvalid).toEqual(["not-an-email"]);
  });

  it("caps the batch", () => {
    const many = Array.from({ length: 60 }, (_, i) => `u${i}@x.com`).join(",");
    const result = parseInviteEmails(many);
    expect(result.emails).toHaveLength(50);
    expect(result.truncated).toBe(10);
  });
});

describe("sanitizeCallbackUrl", () => {
  it("keeps plain same-origin paths", () => {
    expect(sanitizeCallbackUrl("/app")).toBe("/app");
    expect(sanitizeCallbackUrl("/invite/abc")).toBe("/invite/abc");
  });

  it("rejects smuggled off-site targets", () => {
    expect(sanitizeCallbackUrl("//evil.com")).toBe("/onboarding");
    expect(sanitizeCallbackUrl("/%5cevil")).toBe("/onboarding");
    expect(sanitizeCallbackUrl("/%2F%2Fevil.com")).toBe("/onboarding");
    expect(sanitizeCallbackUrl("https://evil.com")).toBe("/onboarding");
    expect(sanitizeCallbackUrl("/app\\evil")).toBe("/onboarding");
    expect(sanitizeCallbackUrl("")).toBe("/onboarding");
  });
});

describe("escapeCsvValue (shared)", () => {
  it("neutralizes formulas", () => {
    expect(escapeCsvValue("=1+1")).toBe("'=1+1");
    expect(escapeCsvValue("@x")).toBe("'@x");
  });
});
