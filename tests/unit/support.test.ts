import { afterEach, describe, expect, it } from "vitest";
import { supportInbox } from "@/lib/email";
import {
  canTransition,
  derivePriority,
  reporterCanTransition,
  supportReplySchema,
  supportTicketSchema,
  ticketShortId,
} from "@/lib/support";
import {
  buildNewTicketEmailToCs,
  buildReplyEmailToReporter,
  buildStatusEmailToReporter,
} from "@/lib/support-email";

afterEach(() => {
  delete process.env.SUPPORT_INBOX_EMAIL;
  delete process.env.APP_URL;
});

describe("supportTicketSchema", () => {
  it("accepts a valid ticket payload", () => {
    const parsed = supportTicketSchema.safeParse({
      category: "bug",
      subject: "Campaign tidak jalan",
      body: "Kampanye saya berhenti mengirim sejak kemarin pagi.",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects bad category, short subject, and short body", () => {
    expect(
      supportTicketSchema.safeParse({ category: "spam", subject: "Hello world", body: "x".repeat(30) })
        .success,
    ).toBe(false);
    expect(
      supportTicketSchema.safeParse({ category: "bug", subject: "hi", body: "x".repeat(30) }).success,
    ).toBe(false);
    expect(
      supportTicketSchema.safeParse({ category: "bug", subject: "Hello world", body: "too short" })
        .success,
    ).toBe(false);
  });

  it("reply schema enforces a minimum body", () => {
    expect(supportReplySchema.safeParse({ body: "o" }).success).toBe(false);
    expect(supportReplySchema.safeParse({ body: "sudah kami periksa ulang" }).success).toBe(true);
  });
});

describe("status transitions", () => {
  it("allows the legal transitions from the spec", () => {
    expect(canTransition("open", "in_progress")).toBe(true);
    expect(canTransition("open", "resolved")).toBe(true);
    expect(canTransition("in_progress", "resolved")).toBe(true);
    expect(canTransition("resolved", "closed")).toBe(true);
    expect(canTransition("closed", "open")).toBe(true);
  });

  it("rejects illegal or no-op transitions", () => {
    expect(canTransition("closed", "in_progress")).toBe(false);
    expect(canTransition("open", "open")).toBe(false);
    expect(canTransition("resolved", "in_progress")).toBe(false);
  });

  it("reporters may only close or reopen their ticket", () => {
    expect(reporterCanTransition("open", "closed")).toBe(true);
    expect(reporterCanTransition("in_progress", "closed")).toBe(true);
    expect(reporterCanTransition("resolved", "open")).toBe(true);
    expect(reporterCanTransition("closed", "open")).toBe(true);
    expect(reporterCanTransition("open", "in_progress")).toBe(false);
    expect(reporterCanTransition("open", "resolved")).toBe(false);
    expect(reporterCanTransition("closed", "resolved")).toBe(false);
  });
});

describe("derivePriority", () => {
  it("maps bug/billing to normal and the rest to low", () => {
    expect(derivePriority("bug")).toBe("normal");
    expect(derivePriority("billing")).toBe("normal");
    expect(derivePriority("account")).toBe("low");
    expect(derivePriority("feature")).toBe("low");
    expect(derivePriority("other")).toBe("low");
  });
});

describe("ticketShortId / supportInbox", () => {
  it("uses the id suffix", () => {
    expect(ticketShortId("ckvverylongcuid12345678")).toBe("12345678");
  });

  it("defaults the inbox to cs@komenin.id and honors the env override", () => {
    expect(supportInbox()).toBe("cs@komenin.id");
    process.env.SUPPORT_INBOX_EMAIL = "help@other.id";
    expect(supportInbox()).toBe("help@other.id");
  });
});

describe("ticket email builders", () => {
  const base = {
    ticketId: "ckvticket000012345678",
    subject: "Campaign tidak jalan",
    category: "bug" as const,
    body: "Kampanye berhenti sejak kemarin.",
    reporterName: "Budi",
    reporterEmail: "budi@brand.id",
    workspaceName: "Kopi Nusantara",
    submittedAt: new Date("2026-09-05T08:00:00Z"),
  };

  it("new-ticket mail goes to the CS inbox with reply-to the reporter", () => {
    const msg = buildNewTicketEmailToCs(base);
    expect(msg.to).toBe("cs@komenin.id");
    expect(msg.replyTo).toBe("budi@brand.id");
    expect(msg.subject).toBe("[Tiket 12345678] bug — Campaign tidak jalan");
    expect(msg.html).toContain("budi@brand.id");
    expect(msg.html).toContain("Kopi Nusantara");
  });

  it("reporter-facing mails link to the ticket page and use APP_URL when set", () => {
    process.env.APP_URL = "https://komenin.id";
    const reply = buildReplyEmailToReporter({
      ...base,
      replyBody: "Kami sudah memeriksa dan akan memantau 24 jam ke depan.",
    });
    expect(reply.to).toBe("budi@brand.id");
    expect(reply.html).toContain("https://komenin.id/app/support/ckvticket000012345678");
    expect(reply.html).toContain("memantau");

    const status = buildStatusEmailToReporter({ ...base, status: "resolved" });
    expect(status.subject).toContain("resolved");
    expect(status.html).toContain("resolved");
  });
});
