"use server";

import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";
import { writeAuditLog } from "@/server/audit";
import { ensureDefaultAgent } from "@/server/agents-lite";
import type { CampaignMode, Platform } from "@prisma/client";

export async function listCampaigns() {
  const { workspace } = await requireActiveWorkspace();
  return db.campaign.findMany({
    where: { workspaceId: workspace.id },
    include: {
      agent: true,
      accounts: true,
      listeners: true,
      _count: { select: { targetPosts: true, drafts: true, approvals: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCampaign(campaignId: string) {
  const { workspace } = await requireActiveWorkspace();
  return db.campaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
    include: {
      agent: true,
      accounts: { include: { socialAccount: true } },
      listeners: true,
      targetPosts: { orderBy: { discoveredAt: "desc" }, take: 20 },
      drafts: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

export async function createCampaign(input: {
  name: string;
  platform: Platform;
  mode?: CampaignMode;
  goal?: string;
  dailyLimit?: number;
  minDelaySec?: number;
  maxDelaySec?: number;
  socialAccountIds?: string[];
  listenerQuery?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "campaigns.manage");

  const name = input.name.trim();
  if (!name) throw new Error("Campaign name is required");

  const agent = await ensureDefaultAgent();

  const campaign = await db.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: {
        workspaceId: workspace.id,
        name,
        platform: input.platform,
        mode: input.mode || "approval_required",
        status: "active",
        agentId: agent.id,
        goal: input.goal?.trim() || null,
        dailyLimit: input.dailyLimit ?? 30,
        minDelaySec: input.minDelaySec ?? 45,
        maxDelaySec: input.maxDelaySec ?? 180,
      },
    });

    if (input.socialAccountIds?.length) {
      await tx.campaignAccount.createMany({
        data: input.socialAccountIds.map((socialAccountId) => ({
          campaignId: created.id,
          socialAccountId,
        })),
      });
    }

    if (input.listenerQuery?.trim()) {
      await tx.listener.create({
        data: {
          workspaceId: workspace.id,
          campaignId: created.id,
          platform: input.platform,
          type: "keyword",
          query: input.listenerQuery.trim(),
          isActive: true,
        },
      });
    }

    return created;
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "campaign.created",
    resourceType: "campaign",
    resourceId: campaign.id,
    metadata: { name: campaign.name, platform: campaign.platform, mode: campaign.mode },
  });

  revalidatePath("/app/campaigns");
  revalidatePath("/app/listeners");
  return campaign;
}
