"use server";

import { revalidatePath } from "next/cache";
import type { CampaignMode, ContentIntervalUnit, Platform } from "@prisma/client";

import { buildContentSchedule, generateContentPosts } from "@/lib/content-engine";
import { publishSocialPost } from "@/lib/publish-connector";
import { assertWorkspacePermission } from "@/lib/rbac";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";
import { db } from "@/lib/db";
import { recordDailyAccountAction } from "@/lib/account-quota";
import { claimContentDraft } from "@/lib/worker-claims";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { ensureDefaultAgent } from "@/server/agents";
import { writeAuditLog } from "@/server/audit";

function revalidateContentPaths(campaignId?: string) {
  revalidatePath("/app/content");
  revalidatePath("/app");
  if (campaignId) revalidatePath(`/app/content/${campaignId}`);
}

export async function listContentCampaigns(input?: {
  q?: string;
  status?: string;
  platform?: string;
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
      { topic: { contains: input.q, mode: "insensitive" as const } },
    ];
  }
  if (input?.status) where.status = input.status as never;
  else if (input?.hideCompleted) where.status = { not: "completed" };
  if (input?.platform) where.platform = input.platform as never;

  return db.contentCampaign.findMany({
    where,
    include: {
      agent: true,
      socialAccount: true,
      _count: { select: { drafts: true } },
      drafts: {
        orderBy: { sequence: "asc" },
        take: 3,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getContentCampaign(campaignId: string) {
  const { workspace } = await requireActiveWorkspace();
  return db.contentCampaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
    include: {
      agent: true,
      socialAccount: true,
      drafts: { orderBy: { sequence: "asc" } },
    },
  });
}

export async function createContentCampaign(input: {
  name: string;
  topic: string;
  platform: Platform;
  mode?: CampaignMode;
  postCount: number;
  intervalValue: number;
  intervalUnit: ContentIntervalUnit;
  socialAccountId?: string;
  startAt?: Date;
  notes?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const name = input.name.trim();
  const topic = input.topic.trim();
  const postCount = Math.max(1, Math.min(Number(input.postCount || 1), 50));
  const intervalValue = Math.max(1, Number(input.intervalValue || 1));
  if (!name) throw new Error("Campaign name is required");
  if (!topic) throw new Error("Topic is required");

  if (input.socialAccountId) {
    const account = await db.socialAccount.findFirst({
      where: {
        id: input.socialAccountId,
        workspaceId: workspace.id,
        deletedAt: null,
      },
    });
    if (!account) throw new Error("Selected account not found");
  }

  const agent = await ensureDefaultAgent();
  const campaign = await db.contentCampaign.create({
    data: {
      workspaceId: workspace.id,
      name,
      topic,
      platform: input.platform,
      mode: input.mode || "approval_required",
      status: "draft",
      agentId: agent.id,
      socialAccountId: input.socialAccountId || null,
      postCount,
      intervalValue,
      intervalUnit: input.intervalUnit,
      startAt: input.startAt || new Date(),
      notes: input.notes?.trim() || null,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "content_campaign.created",
    resourceType: "content_campaign",
    resourceId: campaign.id,
    metadata: {
      topic,
      postCount,
      intervalValue,
      intervalUnit: input.intervalUnit,
      platform: input.platform,
    },
  });

  revalidateContentPaths(campaign.id);
  return campaign;
}

export async function generateContentCampaignDrafts(campaignId: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const campaign = await db.contentCampaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
    include: { agent: true },
  });
  if (!campaign) throw new Error("Content campaign not found");

  await db.contentCampaign.update({
    where: { id: campaign.id },
    data: { status: "generating" },
  });

  const posts = await generateContentPosts({
    topic: campaign.topic,
    postCount: campaign.postCount,
    platform: campaign.platform,
    language: campaign.agent?.language,
    tone: campaign.agent?.tone,
    systemPrompt: campaign.agent?.systemPrompt,
    agentName: campaign.agent?.name,
  });

  const schedule = buildContentSchedule({
    startAt: campaign.startAt,
    postCount: posts.length,
    intervalValue: campaign.intervalValue,
    intervalUnit: campaign.intervalUnit,
  });

  await db.$transaction(async (tx) => {
    await tx.contentDraft.deleteMany({
      where: { contentCampaignId: campaign.id, workspaceId: workspace.id, status: { in: ["pending", "scheduled", "approved", "rejected", "failed"] } },
    });
    const lastRetained = await tx.contentDraft.findFirst({
      where: { contentCampaignId: campaign.id, workspaceId: workspace.id },
      orderBy: { sequence: "desc" },
      select: { sequence: true },
    });
    const sequenceStart = lastRetained?.sequence ?? 0;

    for (const [index, post] of posts.entries()) {
      const initialStatus =
        campaign.mode === "approval_required" ? "pending" : "scheduled";
      await tx.contentDraft.create({
        data: {
          workspaceId: workspace.id,
          contentCampaignId: campaign.id,
          agentId: campaign.agentId,
          socialAccountId: campaign.socialAccountId,
          sequence: sequenceStart + index + 1,
          title: post.title,
          body: post.body,
          hashtags: post.hashtags,
          status: initialStatus,
          scheduledFor: schedule[index] || campaign.startAt,
          providerId: post.providerId,
          model: post.model,
          riskFlags: [],
        },
      });
    }

    await tx.contentCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "active",
        generatedCount: posts.length,
      },
    });
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "content_campaign.generated",
    resourceType: "content_campaign",
    resourceId: campaign.id,
    metadata: {
      generated: posts.length,
      source: posts[0]?.source || "local_fallback",
      mode: campaign.mode,
    },
  });

  revalidateContentPaths(campaign.id);
  return { generated: posts.length };
}

export async function decideContentDraft(input: {
  draftId: string;
  decision: "approved" | "rejected";
  editedBody?: string;
  editedTitle?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const draft = await db.contentDraft.findFirst({
    where: { id: input.draftId, workspaceId: workspace.id },
    include: { contentCampaign: true },
  });
  if (!draft) throw new Error("Content draft not found");
  const allowed = input.decision === "approved" ? ["pending", "rejected"] : ["pending", "scheduled", "approved"];
  if (!allowed.includes(draft.status)) {
    throw new Error(`Cannot ${input.decision} a ${draft.status} draft`);
  }

  const changed = await db.contentDraft.updateMany({
    where: { id: draft.id, workspaceId: workspace.id, status: draft.status },
    data: input.decision === "rejected"
      ? { status: "rejected", resultMessage: "Rejected by operator" }
      : {
          status: "scheduled",
          title: input.editedTitle?.trim() || draft.title,
          body: input.editedBody?.trim() || draft.body,
          resultMessage: "Approved and scheduled",
        },
  });
  if (changed.count !== 1) throw new Error("Content draft changed; refresh and try again");

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: `content_draft.${input.decision}`,
    resourceType: "content_draft",
    resourceId: draft.id,
    metadata: { campaignId: draft.contentCampaignId },
  });

  revalidateContentPaths(draft.contentCampaignId);
  return { ok: true };
}

export async function publishDueContentDrafts(limit = 30) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const due = await db.contentDraft.findMany({
    where: {
      workspaceId: workspace.id,
      status: "scheduled",
      contentCampaign: { status: "active" },
      scheduledFor: { lte: new Date() },
    },
    include: {
      contentCampaign: true,
      socialAccount: true,
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  let published = 0;
  let failed = 0;

  const paceLib = await import("@/lib/platform-rate-limits");
  for (const draft of due) {
    if (draft.contentCampaign.status !== "active") continue;
    // Atomic claim so the worker cron and this manual trigger cannot publish
    // the same draft twice.
    const claimed = await claimContentDraft(draft.id);
    if (!claimed) continue;

    // Publish pace guard: posts are heavier than comments — defer (not fail)
    // when the account already hit its safe hourly window or min interval.
    if (draft.socialAccountId) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [pubsLastHour, lastPub] = await Promise.all([
        db.contentDraft.count({
          where: { socialAccountId: draft.socialAccountId, status: "published", publishedAt: { gte: hourAgo } },
        }),
        db.contentDraft.findFirst({
          where: { socialAccountId: draft.socialAccountId, status: "published" },
          orderBy: { publishedAt: "desc" },
          select: { publishedAt: true },
        }),
      ]);
      void dayAgo;
      const platform = draft.contentCampaign?.platform;
      if (!paceLib.checkHourlyPace({ platform, kind: "publishes", sentInLastHour: pubsLastHour }).ok) {
        await db.contentDraft.update({
          where: { id: draft.id },
          data: { status: "scheduled", scheduledFor: new Date(Date.now() + 30 * 60 * 1000), resultMessage: "Publish pace deferred ~30m (batas aman per-jam)" },
        });
        continue;
      }
      const gap = paceLib.checkMinInterval({ platform, kind: "publishes", lastActionAt: lastPub?.publishedAt ?? null });
      if (!gap.ok) {
        await db.contentDraft.update({
          where: { id: draft.id },
          data: { status: "scheduled", scheduledFor: new Date(Date.now() + gap.waitSec * 1000), resultMessage: "Publish pace deferred (jeda aman antar posting)" },
        });
        continue;
      }
    }

    const currentCampaign = await db.contentCampaign.findFirst({ where: { id: draft.contentCampaignId, workspaceId: workspace.id, status: "active" } });
    if (!currentCampaign) {
      await db.contentDraft.updateMany({ where: { id: draft.id, status: "publishing" }, data: { status: "scheduled" } });
      continue;
    }

    const result = await publishSocialPost({
      idempotencyKey: `content-draft:${draft.id}`,
      target: {
        platform: draft.contentCampaign.platform,
        username: draft.socialAccount?.username,
        accountId: draft.socialAccountId,
        workspaceId: draft.workspaceId,
      },
      payload: {
        title: draft.title,
        body: draft.body,
        hashtags: draft.hashtags,
        scheduledFor: draft.scheduledFor,
        mediaUrl: draft.mediaUrl,
      },
    });

    if (result.ok) {
      published += 1;
      await db.$transaction(async (tx) => {
        await tx.contentDraft.update({
          where: { id: draft.id },
          data: {
            status: "published",
            publishedAt: result.publishedAt,
            resultMessage: result.externalPostId
              ? result.message + " | id=" + result.externalPostId
              : result.message,
          },
        });
        await tx.contentCampaign.update({
          where: { id: draft.contentCampaignId },
          data: { publishedCount: { increment: 1 } },
        });
        if (draft.socialAccountId && draft.socialAccount) {
          // Atomic UTC-day reset + increment (race-safe at midnight boundary).
          await recordDailyAccountAction(tx, draft.socialAccountId);
        }
      });
    } else {
      failed += 1;
      await db.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: "failed",
          resultMessage: result.message,
        },
      });
    }
  }

  const active = await db.contentCampaign.findMany({
    where: { workspaceId: workspace.id, status: "active" },
    include: {
      drafts: { select: { status: true } },
    },
  });
  for (const campaign of active) {
    const remaining = campaign.drafts.filter((d) =>
      ["pending", "scheduled", "approved"].includes(d.status),
    ).length;
    if (remaining === 0 && campaign.drafts.length > 0) {
      await db.contentCampaign.update({
        where: { id: campaign.id },
        data: { status: "completed" },
      });
    }
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "content_drafts.published_due",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: { published, failed, mode: getRuntimeModeLabel() },
  });

  revalidateContentPaths();
  return { published, failed, mode: getRuntimeModeLabel() };
}

export async function listContentSchedule(limit = 100) {
  const { workspace } = await requireActiveWorkspace();
  return db.contentDraft.findMany({
    where: {
      workspaceId: workspace.id,
      status: { in: ["pending", "scheduled", "published", "failed"] },
    },
    include: {
      contentCampaign: true,
      socialAccount: true,
    },
    orderBy: [{ scheduledFor: "asc" }, { sequence: "asc" }],
    take: Math.min(Math.max(limit, 1), 300),
  });
}

export async function listPendingContentDrafts() {
  const { workspace } = await requireActiveWorkspace();
  return db.contentDraft.findMany({
    where: { workspaceId: workspace.id, status: "pending" },
    include: {
      contentCampaign: true,
      socialAccount: true,
    },
    orderBy: [{ scheduledFor: "asc" }, { sequence: "asc" }],
    take: 100,
  });
}

export async function rescheduleContentDraft(input: {
  draftId: string;
  scheduledFor: Date;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  if (Number.isNaN(input.scheduledFor.getTime())) {
    throw new Error("Invalid schedule datetime");
  }

  const draft = await db.contentDraft.findFirst({
    where: { id: input.draftId, workspaceId: workspace.id },
  });
  if (!draft) throw new Error("Content draft not found");
  if (!["pending", "scheduled", "approved"].includes(draft.status)) {
    throw new Error(`Cannot reschedule a ${draft.status} draft`);
  }

  const nextStatus = draft.status === "pending" ? "pending" : "scheduled";
  const changed = await db.contentDraft.updateMany({
    where: { id: draft.id, workspaceId: workspace.id, status: draft.status },
    data: {
      scheduledFor: input.scheduledFor,
      status: nextStatus,
      resultMessage: nextStatus === "pending"
        ? "Schedule updated (still pending approval)"
        : "Schedule updated",
    },
  });
  if (changed.count !== 1) throw new Error("Content draft changed; refresh and try again");
  const updated = await db.contentDraft.findUniqueOrThrow({ where: { id: draft.id } });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "content_draft.rescheduled",
    resourceType: "content_draft",
    resourceId: draft.id,
    metadata: {
      scheduledFor: input.scheduledFor.toISOString(),
      previousStatus: draft.status,
      nextStatus: updated.status,
    },
  });

  revalidateContentPaths(draft.contentCampaignId);
  return updated;
}

export async function bulkApproveContentDrafts(input: {
  campaignId: string;
  draftIds?: string[];
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const campaign = await db.contentCampaign.findFirst({
    where: { id: input.campaignId, workspaceId: workspace.id },
  });
  if (!campaign) throw new Error("Content campaign not found");

  const where = {
    workspaceId: workspace.id,
    contentCampaignId: campaign.id,
    status: "pending" as const,
    ...(input.draftIds && input.draftIds.length > 0
      ? { id: { in: input.draftIds } }
      : {}),
  };

  const pending = await db.contentDraft.findMany({ where });
  if (pending.length === 0) {
    return { approved: 0 };
  }

  const changed = await db.contentDraft.updateMany({
    where: {
      id: { in: pending.map((item) => item.id) },
      workspaceId: workspace.id,
      status: "pending",
    },
    data: {
      status: "scheduled",
      resultMessage: "Bulk approved and scheduled",
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "content_drafts.bulk_approved",
    resourceType: "content_campaign",
    resourceId: campaign.id,
    metadata: {
      approved: changed.count,
      draftIds: pending.map((item) => item.id),
    },
  });

  revalidateContentPaths(campaign.id);
  return { approved: changed.count };
}

export async function setContentCampaignStatus(input: {
  campaignId: string;
  status: "draft" | "active" | "paused" | "completed";
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const campaign = await db.contentCampaign.findFirst({
    where: { id: input.campaignId, workspaceId: workspace.id },
    select: { id: true, status: true },
  });
  if (!campaign) throw new Error("Content campaign not found");

  const updated = await db.contentCampaign.update({
    where: { id: campaign.id },
    data: { status: input.status as never },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "content_campaign.status_updated",
    resourceType: "content_campaign",
    resourceId: updated.id,
    metadata: { from: campaign.status, to: input.status },
  });

  revalidateContentPaths(updated.id);
  return updated;
}

export async function duplicateContentCampaign(input: {
  campaignId: string;
  name?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const source = await db.contentCampaign.findFirst({
    where: { id: input.campaignId, workspaceId: workspace.id },
  });
  if (!source) throw new Error("Content campaign not found");

  const copy = await db.contentCampaign.create({
    data: {
      workspaceId: workspace.id,
      name: (input.name?.trim() || `${source.name} (copy)`).slice(0, 120),
      topic: source.topic,
      platform: source.platform,
      mode: source.mode,
      status: "draft",
      agentId: source.agentId,
      socialAccountId: source.socialAccountId,
      postCount: source.postCount,
      intervalValue: source.intervalValue,
      intervalUnit: source.intervalUnit,
      startAt: new Date(),
      notes: source.notes,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "content_campaign.duplicated",
    resourceType: "content_campaign",
    resourceId: copy.id,
    metadata: { sourceId: source.id, name: copy.name },
  });

  revalidateContentPaths(copy.id);
  return copy;
}
