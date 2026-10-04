import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendWeeklyReport } from "@/server/weekly-report";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ delivered: true, provider: "brevo" }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    workspace: { findMany: vi.fn().mockResolvedValue([]) },
    commentAction: { count: vi.fn().mockResolvedValue(0) },
    contentDraft: { count: vi.fn().mockResolvedValue(0) },
    approval: { count: vi.fn().mockResolvedValue(0) },
    engagementLead: { count: vi.fn().mockResolvedValue(0) },
    aiUsageEvent: { findMany: vi.fn().mockResolvedValue([]) },
    membership: { findMany: vi.fn().mockResolvedValue([]) },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe("sendWeeklyReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is a no-op when BREVO_API_KEY is not configured", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const monday = new Date("2026-10-05T02:00:00Z"); // Monday after slot
    const result = await sendWeeklyReport(monday);
    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("is a no-op off-slot (not Monday, or Monday before 01:00 UTC)", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    const tuesday = new Date("2026-10-06T02:00:00Z");
    expect(await sendWeeklyReport(tuesday)).toEqual({ sent: 0, skipped: 0, errors: 0 });
    const earlyMonday = new Date("2026-10-05T00:30:00Z");
    expect(await sendWeeklyReport(earlyMonday)).toEqual({ sent: 0, skipped: 0, errors: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.workspace.findMany).not.toHaveBeenCalled();
  });

  it("queries workspaces on Monday after the slot but sends nothing when quiet", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    const monday = new Date("2026-10-05T02:00:00Z");
    const result = await sendWeeklyReport(monday);
    expect(db.workspace.findMany).toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the report to analytics-capable members when activity exists", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    const monday = new Date("2026-10-05T02:00:00Z");

    (db.workspace.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "ws_1", name: "Toko Kopi" },
    ]);
    (db.commentAction.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(1);
    (db.contentDraft.count as ReturnType<typeof vi.fn>).mockResolvedValue(4);
    (db.approval.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(2);
    (db.engagementLead.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1);
    (db.aiUsageEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { creditsUsed: 100n },
      { creditsUsed: 50n },
    ]);
    (db.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        workspaceId: "ws_1",
        role: "owner",
        customRole: null,
        user: { id: "u1", email: "owner@brand.id" },
      },
      {
        workspaceId: "ws_1",
        role: "viewer",
        customRole: null,
        user: { id: "u2", email: "viewer@brand.id" },
      },
    ]);
    (db.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "marker_1" });

    const result = await sendWeeklyReport(monday);

    expect(result.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const call = (sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.to).toBe("owner@brand.id");
    expect(call.subject).toContain("Toko Kopi");
    expect(call.html).toContain("Komentar terkirim");
    expect(call.html).toContain("/app/analytics");
  });

  it("skips a workspace already reported this ISO week", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    const monday = new Date("2026-10-05T02:00:00Z");

    (db.workspace.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "ws_1", name: "Toko Kopi" },
    ]);
    (db.commentAction.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0);
    (db.contentDraft.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    (db.approval.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    (db.engagementLead.count as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    (db.aiUsageEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        workspaceId: "ws_1",
        role: "owner",
        customRole: null,
        user: { id: "u1", email: "owner@brand.id" },
      },
    ]);
    (db.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await sendWeeklyReport(monday);

    expect(result).toEqual({ sent: 0, skipped: 1, errors: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
