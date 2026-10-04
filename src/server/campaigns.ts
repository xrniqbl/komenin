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
  /** Hide completed campaigns from the default workspace view. */
  hideCompleted?: boolean;
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
  else if (input?.hideCompleted) where.status = { not: "completed" };
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

  const { getPlatformGuardrail, validateCampaignPacing } = await import("@/lib/platform-rate-limits");
  const delayFloor = getPlatformGuardrail(input.platform).comments.minIntervalSec;
  const pacing = validateCampaignPacing({
    platform: input.platform,
    dailyLimit: input.dailyLimit,
    minDelaySec: input.minDelaySec,
    maxDelaySec: input.maxDelaySec,
  });
  if (pacing.errors.length > 0) throw new Error(pacing.errors.join("; "));

  const agent = await ensureDefaultAgent();

  // H2: socialAccountIds are attacker-chosen UUIDs — resolve them against
  // this workspace BEFORE the transaction so a member of workspace A can
  // never link (or leak via listCampaigns include) workspace B's accounts.
  let socialAccountIds: string[] = [];
  if (input.socialAccountIds?.length) {
    const uniqueIds = [...new Set(input.socialAccountIds.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length > 0) {
      const owned = await db.socialAccount.findMany({
        where: { id: { in: uniqueIds }, workspaceId: workspace.id },
        select: { id: true },
      });
      if (owned.length !== uniqueIds.length) {
        throw new Error("Social account not found");
      }
      socialAccountIds = owned.map((a) => a.id);
    }
  }

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
        dailyLimit: pacing.clampedDailyLimit,
        minDelaySec: Math.max(input.minDelaySec ?? 180, delayFloor),
        maxDelaySec: Math.max(input.maxDelaySec ?? 600, input.minDelaySec ?? 180, delayFloor),
      },
    });

    if (socialAccountIds.length) {
      await tx.campaignAccount.createMany({
        data: socialAccountIds.map((socialAccountId) => ({
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

export async function setCampaignStatus(input: {
  campaignId: string;
  status: "draft" | "active" | "paused" | "completed";
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const campaign = await db.campaign.findFirst({
    where: { id: input.campaignId, workspaceId: workspace.id },
    select: { id: true, status: true, name: true },
  });
  if (!campaign) throw new Error("Campaign not found");

  const updated = await db.campaign.update({
    where: { id: campaign.id },
    data: { status: input.status as never },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "campaign.status_updated",
    resourceType: "campaign",
    resourceId: updated.id,
    metadata: { from: campaign.status, to: input.status },
  });

  revalidatePath("/app/campaigns");
  revalidatePath(`/app/campaigns/${updated.id}`);
  return updated;
}

export async function duplicateCampaign(input: {
  campaignId: string;
  name?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const source = await db.campaign.findFirst({
    where: { id: input.campaignId, workspaceId: workspace.id },
    include: { accounts: true, listeners: { take: 1 } },
  });
  if (!source) throw new Error("Campaign not found");

  const agent = source.agentId
    ? await db.agent.findFirst({
        where: { id: source.agentId, workspaceId: workspace.id },
        select: { id: true },
      })
    : null;

  const baseName = input.name?.trim() || `${source.name} (copy)`;
  const copy = await db.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: {
        workspaceId: workspace.id,
        name: baseName.slice(0, 120),
        platform: source.platform,
        mode: source.mode,
        status: "draft",
        agentId: agent?.id || (await ensureDefaultAgent()).id,
        clientId: source.clientId,
        goal: source.goal,
        dailyLimit: source.dailyLimit,
        minDelaySec: source.minDelaySec,
        maxDelaySec: source.maxDelaySec,
      },
    });
    if (source.accounts.length > 0) {
      await tx.campaignAccount.createMany({
        data: source.accounts.map((a) => ({
          campaignId: created.id,
          socialAccountId: a.socialAccountId,
        })),
      });
    }
    const listener = source.listeners[0];
    if (listener) {
      await tx.listener.create({
        data: {
          workspaceId: workspace.id,
          campaignId: created.id,
          platform: source.platform,
          type: listener.type,
          query: listener.query,
          isActive: false,
        },
      });
    }
    return created;
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "campaign.duplicated",
    resourceType: "campaign",
    resourceId: copy.id,
    metadata: { sourceId: source.id, name: copy.name },
  });

  revalidatePath("/app/campaigns");
  return copy;
}
