import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/workspace-access", () => ({
  requireActiveWorkspace: vi.fn().mockResolvedValue({
    userId: "u1",
    workspace: { id: "ws_1" },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { db } from "@/lib/db";
import { archiveNotification, listNotifications, listNotificationsPage } from "@/server/notifications";

describe("notification triage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters by status and search query within the workspace", async () => {
    (db.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await listNotifications(100, { status: "unread", q: "approval" });
    expect(db.notification.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws_1",
        status: "unread",
        OR: [
          { title: { contains: "approval", mode: "insensitive" } },
          { body: { contains: "approval", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });

  it("paginates filtered notifications beyond the first hundred with a stable order", async () => {
    (db.notification.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (db.notification.count as ReturnType<typeof vi.fn>).mockResolvedValue(145);
    const result = await listNotificationsPage(12, 10, { status: "unread", q: "approval" });
    expect(db.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "ws_1", status: "unread" }),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 110,
      take: 10,
    }));
    expect(result).toEqual({ items: [], total: 145 });
  });

  it("archives scoped to the workspace", async () => {
    await archiveNotification("n_1");
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n_1", workspaceId: "ws_1" },
      data: { status: "archived", readAt: expect.any(Date) },
    });
  });
});
