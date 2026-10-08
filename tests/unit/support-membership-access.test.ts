import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, dbMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  dbMock: {
    membership: { findFirst: vi.fn(), findMany: vi.fn() },
    supportTicket: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: vi.fn() }));
vi.mock("@/server/admin", () => ({ requireSuperAdmin: vi.fn() }));
vi.mock("@/server/workspace-access", () => ({ requireActiveWorkspace: vi.fn() }));
vi.mock("@/server/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getTicketForReporter, listMyTickets } from "@/server/support";

describe("support ticket membership access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "reporter", email: "person@example.com" } });
    dbMock.supportTicket.findUnique.mockResolvedValue({ id: "ticket", reporterId: "reporter", workspaceId: "w1", messages: [] });
    dbMock.supportTicket.findMany.mockResolvedValue([]);
  });

  it("hides workspace tickets after the reporter's membership is revoked", async () => {
    dbMock.membership.findMany.mockResolvedValue([]);
    dbMock.membership.findFirst.mockResolvedValue(null);
    expect(await listMyTickets()).toEqual([]);
    expect(dbMock.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workspace: { memberships: { some: { userId: "reporter", status: "active" } } },
      }),
    }));
    expect(await getTicketForReporter("ticket")).toBeNull();
  });
});
