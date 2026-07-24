"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import { ensureDefaultAgent } from "@/server/agents";
import type { CampaignMode, Platform } from "@prisma/client";

export async function listCampaigns(input?: {
  q?: string;
  status?: string;
  platform?: string;
  clientId?: string;
}) {
  const { workspace } = await requireActiveWorkspace();
  const where: Record<string, unknown> & { workspaceId: string } = {
    workspaceId: workspace.id,
  };
  if (input?.q) {
    where.OR = [
      { name: { contains: input.q, mode: "insensitive" as const } },
      { goal: { contains: input.q, mode: "insensitive" as const } },
    ];
  }
  if (input?.status) where.status = input.status as never;
  if (input?.platform) where.platform = input.platform as never;
  if (input?.clientId) where.clientId = input.clientId;

  return db.campaign.findMany({
    where,
    include: {
      agent: true,
      client: { select: { id: true, name: true, slug: true } },
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
      client: { select: { id: true, name: true, slug: true } },
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
  clientId?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const name = input.name.trim();
  if (!name) throw new Error("Campaign name is required");

  let clientId: string | null = null;
  if (input.clientId?.trim()) {
    const client = await db.clientProfile.findFirst({
      where: { id: input.clientId.trim(), workspaceId: workspace.id, isActive: true },
      select: { id: true },
    });
    if (!client) throw new Error("Client not found");
    clientId = client.id;
  }

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
        clientId,
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
    metadata: {
      name: campaign.name,
      platform: campaign.platform,
      mode: campaign.mode,
      clientId: campaign.clientId,
    },
  });

  revalidatePath("/app/campaigns");
  revalidatePath("/app/listeners");
  revalidatePath("/app/clients");
  return campaign;
}

export async function setCampaignClient(input: {
  campaignId: string;
  clientId?: string | null;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const campaign = await db.campaign.findFirst({
    where: { id: input.campaignId, workspaceId: workspace.id },
    select: { id: true, clientId: true },
  });
  if (!campaign) throw new Error("Campaign not found");

  let nextClientId: string | null = null;
  if (input.clientId?.trim()) {
    const client = await db.clientProfile.findFirst({
      where: { id: input.clientId.trim(), workspaceId: workspace.id },
      select: { id: true },
    });
    if (!client) throw new Error("Client not found");
    nextClientId = client.id;
  }

  const updated = await db.campaign.update({
    where: { id: campaign.id },
    data: { clientId: nextClientId },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "campaign.client_updated",
    resourceType: "campaign",
    resourceId: updated.id,
    metadata: { from: campaign.clientId, to: nextClientId },
  });

  revalidatePath("/app/campaigns");
  revalidatePath(`/app/campaigns/${updated.id}`);
  revalidatePath("/app/clients");
  return updated;
}
