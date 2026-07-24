import { describe, expect, it } from "vitest";
import { contactPayloadSchema } from "@/lib/contact";

describe("contact payload schema", () => {
  it("accepts a valid lead", () => {
    const parsed = contactPayloadSchema.safeParse({
      name: "Ayu",
      email: "ayu@company.com",
      message: "We need enterprise onboarding for 40 accounts.",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects short messages and bad email", () => {
    expect(
      contactPayloadSchema.safeParse({
        name: "A",
        email: "not-an-email",
        message: "hi",
      }).success,
    ).toBe(false);
  });

  it("accepts filled honeypot so the API can silently drop spam", () => {
    const parsed = contactPayloadSchema.safeParse({
      name: "Bot",
      email: "bot@spam.test",
      message: "Buy now click here please",
      company: "Acme Spam Co",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.company).toBe("Acme Spam Co");
  });
});
