import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    campaign: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      $transaction: undefined,
    },
    agent: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/server/workspace-access", () => ({
  requireActiveWorkspace: vi.fn().mockResolvedValue({
    userId: "u1",
    workspace: { id: "ws_1", role: "owner", customPermissions: [] },
  }),
}));

vi.mock("@/lib/rbac", () => ({
  assertWorkspacePermission: vi.fn(),
}));

vi.mock("@/server/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/agents", () => ({
  ensureDefaultAgent: vi.fn().mockResolvedValue({ id: "agent_1" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { duplicateCampaign, setCampaignStatus } from "@/server/campaigns";

describe("campaign operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireActiveWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue({
      userId: "u1",
      workspace: { id: "ws_1", role: "owner", customPermissions: [] },
    });
  });

  it("duplicates a campaign as a draft copy with accounts and a paused listener", async () => {
    const source = {
      id: "cmp_1",
      name: "Promo Kopi",
      platform: "instagram",
      mode: "approval_required",
      agentId: "agent_1",
      clientId: "client_1",
      goal: "engagement",
      dailyLimit: 30,
      minDelaySec: 180,
      maxDelaySec: 600,
      accounts: [{ socialAccountId: "acc_1" }, { socialAccountId: "acc_2" }],
      listeners: [{ type: "keyword", query: "kopi" }],
    };
    (db.campaign.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(source);
    (db.agent.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "agent_1" });
    const created = { id: "cmp_2", name: "Promo Kopi (copy)" };
    (db.$transaction as ReturnType<typeof vi.fn>).mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        campaign: { create: vi.fn().mockResolvedValue(created) },
        campaignAccount: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
        listener: { create: vi.fn().mockResolvedValue({ id: "l2" }) },
      };
      return fn(tx);
    });

    const copy = await duplicateCampaign({ campaignId: "cmp_1" });

    expect(copy).toEqual(created);
    expect(db.campaign.findFirst).toHaveBeenCalledWith({
      where: { id: "cmp_1", workspaceId: "ws_1" },
      include: { accounts: true, listeners: { take: 1 } },
    });
  });

  it("rejects duplicating another workspace's campaign", async () => {
    (db.campaign.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(duplicateCampaign({ campaignId: "cmp_x" })).rejects.toThrow(
      "Campaign not found",
    );
  });

  it("updates campaign status for pause/archive/reopen", async () => {
    (db.campaign.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cmp_1",
      status: "active",
      name: "Promo Kopi",
    });
    (db.campaign.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cmp_1",
      status: "paused",
    });

    const updated = await setCampaignStatus({ campaignId: "cmp_1", status: "paused" });

    expect(updated.status).toBe("paused");
    expect(db.campaign.update).toHaveBeenCalledWith({
      where: { id: "cmp_1" },
      data: { status: "paused" },
    });
  });
});
