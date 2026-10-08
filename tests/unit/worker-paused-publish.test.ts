import { beforeEach, expect, it, vi } from "vitest";

const { dbMock, publish } = vi.hoisted(() => ({
  dbMock: {
    jobRun: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    contentDraft: { findMany: vi.fn(), updateMany: vi.fn() },
    workspace: { findUnique: vi.fn() },
    usageCounter: { findUnique: vi.fn() },
  },
  publish: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/publish-connector", () => ({ publishSocialPost: publish }));

import { runWorkerJob } from "@/server/worker-jobs";

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.jobRun.findFirst.mockResolvedValue(null);
  dbMock.jobRun.create.mockResolvedValue({ id: "run" });
  dbMock.jobRun.update.mockResolvedValue({});
  dbMock.contentDraft.updateMany.mockResolvedValue({ count: 1 });
  dbMock.workspace.findUnique.mockResolvedValue(null);
  dbMock.usageCounter.findUnique.mockResolvedValue(null);
});

it("does not publish a due draft belonging to a paused campaign", async () => {
  dbMock.contentDraft.findMany.mockResolvedValue([{ id: "draft", workspaceId: "ws", contentCampaignId: "campaign", contentCampaign: { status: "paused", platform: "instagram" } }]);
  const result = await runWorkerJob("content.publish");
  expect(publish).not.toHaveBeenCalled();
  expect(result.ok).toBe(true);
});
