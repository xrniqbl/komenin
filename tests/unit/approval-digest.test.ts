import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendDailyApprovalDigest } from "@/server/approval-digest";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ delivered: true, provider: "brevo" }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    approval: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
    contentDraft: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
    membership: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe("sendDailyApprovalDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is a no-op when BREVO_API_KEY is not configured", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const result = await sendDailyApprovalDigest();
    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("is a no-op before the digest slot hour (01:00 UTC / 08:00 WIB)", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    const earlyMorning = new Date("2026-08-27T00:30:00Z"); // 00:30 UTC
    const result = await sendDailyApprovalDigest(earlyMorning);
    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.approval.groupBy).not.toHaveBeenCalled();
  });

  it("queries pending work after the slot hour but sends nothing when empty", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    const afterSlot = new Date("2026-08-27T02:00:00Z");

    const result = await sendDailyApprovalDigest(afterSlot);

    expect(db.approval.groupBy).toHaveBeenCalled();
    expect(db.contentDraft.groupBy).toHaveBeenCalled();
    // no pending work → no memberships queried, no sends
    expect(db.membership.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, skipped: 0, errors: 0 });
  });

  it("sends digest emails to campaigns.manage members when work is pending", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    const afterSlot = new Date("2026-08-27T02:00:00Z");

    (db.approval.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        workspaceId: "ws_1",
        _count: { _all: 3 },
        _min: { createdAt: new Date("2026-08-26T10:00:00Z") },
      },
    ]);
    (db.contentDraft.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        workspaceId: "ws_1",
        _count: { _all: 2 },
        _min: { createdAt: new Date("2026-08-26T12:00:00Z") },
      },
    ]);
    (db.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        workspaceId: "ws_1",
        role: "owner",
        customRole: null,
        user: { id: "u1", email: "owner@brand.id" },
        workspace: { id: "ws_1", name: "Toko Kopi" },
      },
      {
        workspaceId: "ws_1",
        role: "viewer", // no approval permission — excluded
        customRole: null,
        user: { id: "u2", email: "viewer@brand.id" },
        workspace: { id: "ws_1", name: "Toko Kopi" },
      },
    ]);
    (db.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "marker_1" });

    const result = await sendDailyApprovalDigest(afterSlot);

    expect(result.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1); // only the owner
    const call = (sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.to).toBe("owner@brand.id");
    expect(call.subject).toContain("5 item");
    expect(call.subject).toContain("Toko Kopi");
    expect(call.html).toContain("Approval komentar");
    expect(call.html).toContain("Draf konten");
  });

  it("skips a workspace already digested today (marker exists)", async () => {
    vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
    const afterSlot = new Date("2026-08-27T02:00:00Z");

    (db.approval.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { workspaceId: "ws_1", _count: { _all: 1 }, _min: { createdAt: null } },
    ]);
    (db.contentDraft.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.membership.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        workspaceId: "ws_1",
        role: "owner",
        customRole: null,
        user: { id: "u1", email: "owner@brand.id" },
        workspace: { id: "ws_1", name: "Toko Kopi" },
      },
    ]);
    // marker already exists → transaction resolves null → skip
    (db.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await sendDailyApprovalDigest(afterSlot);

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
