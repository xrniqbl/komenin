import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, discover } = vi.hoisted(() => ({
  dbMock: {
    jobRun: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    listener: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    socialAccount: { findFirst: vi.fn() },
    deliveryLog: { create: vi.fn() },
    targetPost: { upsert: vi.fn() },
  },
  discover: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/connectors/runtime", () => ({ executeSocialAction: discover }));
vi.mock("@/lib/runtime-mode", () => ({ getRuntimeModeLabel: () => "live" }));
vi.mock("@/lib/error-reporting", () => ({ reportError: vi.fn() }));

import { runWorkerJob } from "@/server/worker-jobs";

const listener = (id: string, lastPolledAt: Date | null = null) => ({ id, workspaceId: "ws", platform: "instagram", query: "topic", isActive: true, pollIntervalMinutes: 15, lastPolledAt });

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.jobRun.findFirst.mockResolvedValue(null);
  dbMock.jobRun.create.mockResolvedValue({ id: "run" });
  dbMock.jobRun.update.mockResolvedValue({});
  dbMock.socialAccount.findFirst.mockResolvedValue(null);
  dbMock.deliveryLog.create.mockResolvedValue({});
  dbMock.listener.update.mockResolvedValue({});
  dbMock.listener.updateMany.mockResolvedValue({ count: 1 });
  discover.mockResolvedValue({ ok: true, posts: [], connector: "official", mode: "live", message: "ok" });
});

describe("listener.autopoll", () => {
  it("paginates past the first 30 not-due listeners to poll an overdue listener", async () => {
    const recent = Array.from({ length: 30 }, (_, i) => listener(`recent-${i}`, new Date(Date.now() - 60_000)));
    const overdue = listener("overdue", new Date(Date.now() - 60 * 60_000));
    dbMock.listener.findMany.mockImplementation(async ({ skip = 0, take }: { skip?: number; take: number }) => [ ...recent, overdue ].slice(skip, skip + take));
    dbMock.listener.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => overdue.id === where.id ? overdue : null);
    const result = await runWorkerJob("listener.autopoll");
    expect(result.details).toMatchObject({ polled: 1 });
    expect(discover).toHaveBeenCalledTimes(1);
  });

  it("does not poll when another invocation has already claimed the same listener", async () => {
    const overdue = listener("overdue");
    dbMock.listener.findMany.mockResolvedValue([overdue]);
    dbMock.listener.updateMany.mockResolvedValue({ count: 0 });
    const result = await runWorkerJob("listener.autopoll");
    expect(result.details).toMatchObject({ polled: 0 });
    expect(discover).not.toHaveBeenCalled();
  });
});
