import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: { mention: { findMany: vi.fn() } } }));
vi.mock("@/server/workspace-access", () => ({ requireActiveWorkspace: vi.fn().mockResolvedValue({ workspace: { id: "ws_1" } }) }));
vi.mock("@/server/worker-jobs", () => ({ runWorkerJob: vi.fn() }));
vi.mock("@/server/audit", () => ({ writeAuditLog: vi.fn() }));

import { db } from "@/lib/db";
import { listMentions } from "@/server/mention-replies";

const mention = (n: number, high = false) => ({
  id: `m_${n}`, platform: "INSTAGRAM", authorHandle: `user${n}`, content: "hi", parentContent: "post",
  url: null, status: "drafted", assigneeId: null, assignee: null, socialAccount: null, action: null,
  receivedAt: new Date(Date.UTC(2026, 0, 1, 0, n)), processedAt: null,
  drafts: high ? [{ id: `d_${n}`, content: "reply", status: "pending", riskFlags: ["banned_phrase:test"], createdAt: new Date(), updatedAt: new Date() }] : [],
});

describe("mention listing", () => {
  it("shows a high-risk mention past the first 100 and advances by the displayed sort order", async () => {
    (db.mention.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      ...Array.from({ length: 110 }, (_, n) => mention(n)), mention(110, true),
    ]);
    const first = await listMentions({ priority: "high" });
    expect(first.items.map((item) => item.id)).toEqual(["m_110"]);
    expect(first.hasMore).toBe(false);
    expect(db.mention.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ take: 101 }));
  });

  it("paginates oldest-first without repeating or skipping items", async () => {
    (db.mention.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(
      Array.from({ length: 102 }, (_, n) => mention(n)),
    );
    const first = await listMentions({ sort: "oldest" });
    expect(first.items[0].id).toBe("m_0");
    expect(first.nextCursor).toBe("m_99");
    const second = await listMentions({ sort: "oldest", cursor: first.nextCursor! });
    expect(second.items.map((item) => item.id)).toEqual(["m_100", "m_101"]);
  });
});
