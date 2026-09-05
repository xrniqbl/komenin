import { afterEach, describe, expect, it } from "vitest";
import { buildContactNotification } from "@/lib/email";

afterEach(() => {
  delete process.env.SUPPORT_INBOX_EMAIL;
});

describe("buildContactNotification", () => {
  it("targets the support inbox with reply-to the submitter", () => {
    const msg = buildContactNotification({
      name: "Budi",
      email: "budi@brand.id",
      message: "Saya tidak bisa connect akun Instagram.",
      auditId: "aud_1",
      submittedAt: new Date("2026-09-05T08:00:00Z"),
    });
    expect(msg.to).toBe("cs@komenin.id");
    expect(msg.replyTo).toBe("budi@brand.id");
    expect(msg.subject).toContain("Budi");
    expect(msg.html).toContain("budi@brand.id");
    expect(msg.html).toContain("Instagram");
    expect(msg.text).toContain("aud_1");
  });

  it("honors SUPPORT_INBOX_EMAIL and truncates long subject names", () => {
    process.env.SUPPORT_INBOX_EMAIL = "help@other.id";
    const msg = buildContactNotification({
      name: "A".repeat(120),
      email: "a@b.id",
      message: "x".repeat(80),
      auditId: "aud_2",
      submittedAt: new Date(),
    });
    expect(msg.to).toBe("help@other.id");
    expect(msg.subject.length).toBeLessThan(120);
  });

  it("escapes html-sensitive characters in the body", () => {
    const msg = buildContactNotification({
      name: "Risky <script>",
      email: "r@b.id",
      message: "<img src=x onerror=alert(1)> tolong bantu",
      auditId: "aud_3",
      submittedAt: new Date(),
    });
    expect(msg.html).not.toContain("<img src=x");
    expect(msg.html).toContain("&lt;img src=x");
  });
});
