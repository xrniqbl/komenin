import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    commentAction: { findMany: vi.fn().mockResolvedValue([]) },
    contentDraft: { findMany: vi.fn().mockResolvedValue([]) },
    engagementLead: { count: vi.fn() },
  },
}));

vi.mock("@/server/workspace-access", () => ({
  requireActiveWorkspace: vi.fn().mockResolvedValue({
    userId: "u1",
    workspace: { id: "ws_1" },
  }),
}));

vi.mock("@/lib/rbac", () => ({
  assertWorkspacePermission: vi.fn(),
}));

import { db } from "@/lib/db";
import { exportCommentSendsCsv, exportPublishesCsv } from "@/server/analytics";

describe("analytics CSV exports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports comment sends with platform, author, and account columns", async () => {
    (db.commentAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "a1",
        status: "sent",
        scheduledFor: new Date("2026-10-01T10:00:00Z"),
        executedAt: new Date("2026-10-01T10:05:00Z"),
        createdAt: new Date("2026-10-01T09:00:00Z"),
        targetPost: { platform: "instagram", authorHandle: "prospek" },
        socialAccount: { username: "brand" },
        campaign: { name: "Promo" },
      },
    ]);

    const result = await exportCommentSendsCsv(30);
    expect(result.filename).toMatch(/^komenin-comment-sends-/);
    expect(result.count).toBe(1);
    expect(result.csv.split("\n")[0]).toContain("platform");
    expect(result.csv).toContain("instagram");
    expect(result.csv).toContain("@prospek");
  });

  it("exports publishes with campaign and schedule columns", async () => {
    (db.contentDraft.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "d1",
        sequence: 3,
        title: "Tips Kopi",
        scheduledFor: new Date("2026-10-02T08:00:00Z"),
        publishedAt: new Date("2026-10-02T08:01:00Z"),
        contentCampaign: { name: "Konten", platform: "tiktok" },
        socialAccount: { username: "brand" },
      },
    ]);

    const result = await exportPublishesCsv(30);
    expect(result.filename).toMatch(/^komenin-publishes-/);
    expect(result.count).toBe(1);
    expect(result.csv).toContain("tiktok");
    expect(result.csv).toContain("Tips Kopi");
  });

  it("escapes CSV injection and quotes", async () => {
    (db.commentAction.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "a2",
        status: 'sent"=cmd',
        scheduledFor: null,
        executedAt: null,
        createdAt: new Date("2026-10-01T09:00:00Z"),
        targetPost: { platform: "threads", authorHandle: 'a"b,c' },
        socialAccount: null,
        campaign: null,
      },
    ]);
    const result = await exportCommentSendsCsv(30);
    expect(result.csv).toContain('"sent""=cmd"');
    expect(result.csv).toContain('"@a""b,c"');
  });
});
