"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { executeSocialAction } from "@/lib/connectors/runtime";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";
import { normalizePollIntervalMinutes } from "@/lib/listener-poll-interval";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import type { ListenerType, Platform } from "@prisma/client";

export type ListenerListFilter = {
  q?: string;
  platform?: string;
  /** "active" | "paused" | "" (empty = all). */
  status?: string;
};

export async function listListeners(input?: ListenerListFilter) {
  const { workspace } = await requireActiveWorkspace();
  const where: Record<string, unknown> & { workspaceId: string } = {
    workspaceId: workspace.id,
  };
  const q = input?.q?.trim();
  if (q) {
    where.query = { contains: q, mode: "insensitive" as const };
  }
  if (input?.platform) where.platform = input.platform as never;
  if (input?.status === "active") where.isActive = true;
  else if (input?.status === "paused") where.isActive = false;
  return db.listener.findMany({
    where,
    include: {
      campaign: true,
      _count: { select: { posts: true } },
      // Latest discovery timestamp per listener — drives the stale badge
      // without a separate query per row.
      posts: {
        orderBy: { discoveredAt: "desc" },
        take: 1,
        select: { discoveredAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createListener(input: {
  platform: Platform;
  type: ListenerType;
  query: string;
  campaignId?: string;
  pollIntervalMinutes?: number | string | null;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const query = input.query.trim();
  if (!query) throw new Error("Listener query is required");

  // M1: campaignId is attacker-chosen — a member of workspace A must not be
  // able to link their listener to workspace B's campaign (pollListener /
  // listListeners would then write targetPosts against a foreign campaign).
  let campaignId: string | null = null;
  if (input.campaignId?.trim()) {
    const campaign = await db.campaign.findFirst({
      where: { id: input.campaignId.trim(), workspaceId: workspace.id },
      select: { id: true },
    });
    if (!campaign) throw new Error("Campaign not found");
    campaignId = campaign.id;
  }

  const listener = await db.listener.create({
    data: {
      workspaceId: workspace.id,
      platform: input.platform,
      type: input.type,
      query,
      campaignId,
      pollIntervalMinutes: normalizePollIntervalMinutes(input.pollIntervalMinutes ?? null),
      isActive: true,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "listener.created",
    resourceType: "listener",
    resourceId: listener.id,
    metadata: {
      query,
      platform: listener.platform,
      type: listener.type,
      pollIntervalMinutes: listener.pollIntervalMinutes,
    },
  });

  revalidatePath("/app/listeners");
  return listener;
}

export async function getListener(listenerId: string) {
  const { workspace } = await requireActiveWorkspace();
  return db.listener.findFirst({
    where: { id: listenerId, workspaceId: workspace.id },
    include: {
      campaign: true,
      posts: {
        orderBy: { discoveredAt: "desc" },
        take: 10,
        select: {
          id: true,
          platform: true,
          authorHandle: true,
          content: true,
          url: true,
          status: true,
          discoveredAt: true,
        },
      },
      _count: { select: { posts: true } },
    },
  });
}

export async function updateListener(
  listenerId: string,
  input: {
    platform: Platform;
    type: ListenerType;
    query: string;
    campaignId?: string | null;
    isActive: boolean;
    pollIntervalMinutes?: number | string | null;
  },
) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const listener = await db.listener.findFirst({
    where: { id: listenerId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!listener) throw new Error("Listener not found");

  const query = input.query.trim();
  if (!query) throw new Error("Listener query is required");

  // Same workspace-scoping guard as createListener: campaignId is
  // attacker-chosen, so it must belong to this workspace.
  let campaignId: string | null = null;
  if (input.campaignId?.trim()) {
    const campaign = await db.campaign.findFirst({
      where: { id: input.campaignId.trim(), workspaceId: workspace.id },
      select: { id: true },
    });
    if (!campaign) throw new Error("Campaign not found");
    campaignId = campaign.id;
  }

  const updated = await db.listener.update({
    where: { id: listener.id },
    data: {
      platform: input.platform,
      type: input.type,
      query,
      campaignId,
      pollIntervalMinutes: normalizePollIntervalMinutes(
        input.pollIntervalMinutes ?? null,
      ),
      isActive: input.isActive,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "listener.updated",
    resourceType: "listener",
    resourceId: listener.id,
    metadata: {
      query,
      platform: updated.platform,
      type: updated.type,
      isActive: updated.isActive,
      pollIntervalMinutes: updated.pollIntervalMinutes,
    },
  });

  revalidatePath("/app/listeners");
  revalidatePath(`/app/listeners/${listener.id}`);
  return updated;
}

export async function setListenerActive(listenerId: string, isActive: boolean) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const listener = await db.listener.findFirst({
    where: { id: listenerId, workspaceId: workspace.id },
    select: { id: true, query: true },
  });
  if (!listener) throw new Error("Listener not found");

  await db.listener.update({
    where: { id: listener.id },
    data: { isActive },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: isActive ? "listener.resumed" : "listener.paused",
    resourceType: "listener",
    resourceId: listener.id,
    metadata: { query: listener.query },
  });

  revalidatePath("/app/listeners");
  revalidatePath(`/app/listeners/${listener.id}`);
  return { ok: true as const, isActive };
}

export async function bulkUpdateListeners(input: {
  listenerIds: string[];
  action: "activate" | "pause" | "delete";
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  if (input.listenerIds.length === 0) return { processed: 0 };
  if (input.listenerIds.length > 100) throw new Error("Bulk limit is 100");

  // Workspace-scoped lookup first: foreign ids silently drop out instead of
  // leaking existence, matching the bulkDecideApprovals pattern.
  const rows = await db.listener.findMany({
    where: { id: { in: input.listenerIds }, workspaceId: workspace.id },
    select: { id: true, query: true },
  });

  let processed = 0;
  if (input.action === "delete") {
    // Hard delete (no deletedAt column); TargetPosts survive via SetNull.
    await db.listener.deleteMany({
      where: { id: { in: rows.map((row) => row.id) }, workspaceId: workspace.id },
    });
    processed = rows.length;
  } else {
    const isActive = input.action === "activate";
    const updated = await db.listener.updateMany({
      where: { id: { in: rows.map((row) => row.id) }, workspaceId: workspace.id },
      data: { isActive },
    });
    processed = updated.count;
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action:
      input.action === "delete"
        ? "listener.bulk_deleted"
        : input.action === "activate"
          ? "listener.bulk_resumed"
          : "listener.bulk_paused",
    resourceType: "listener",
    resourceId: rows.map((row) => row.id).join(","),
    metadata: { processed, action: input.action, ids: input.listenerIds },
  });

  revalidatePath("/app/listeners");
  return { processed };
}

export async function deleteListener(listenerId: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const listener = await db.listener.findFirst({
    where: { id: listenerId, workspaceId: workspace.id },
    select: { id: true, query: true, platform: true },
  });
  if (!listener) throw new Error("Listener not found");

  // Listener has no deletedAt column — hard delete. Related TargetPost rows
  // survive with listenerId set to null (onDelete: SetNull).
  await db.listener.delete({ where: { id: listener.id } });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "listener.deleted",
    resourceType: "listener",
    resourceId: listener.id,
    metadata: { query: listener.query, platform: listener.platform },
  });

  revalidatePath("/app/listeners");
  return { ok: true as const };
}

export async function pollListener(listenerId: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const listener = await db.listener.findFirst({
    where: { id: listenerId, workspaceId: workspace.id },
    include: { campaign: true },
  });
  if (!listener) throw new Error("Listener not found");

  const mode = getRuntimeModeLabel();
  // Native Instagram hashtag discovery needs the platform-side account id
  // (SocialAccount.externalId); resolve any active account on the platform.
  const discoveryAccount = await db.socialAccount.findFirst({
    where: {
      workspaceId: workspace.id,
      platform: listener.platform,
      status: { in: ["healthy", "degraded", "limited"] },
      deletedAt: null,
    },
    select: { id: true, externalId: true, username: true },
    orderBy: { createdAt: "asc" },
  });
  const discovery = await executeSocialAction({
    action: "discoverPosts",
    workspaceId: workspace.id,
    target: {
      platform: listener.platform,
      username: discoveryAccount?.username || "listener",
      accountId: discoveryAccount?.id ?? null,
      externalId: discoveryAccount?.externalId ?? null,
      workspaceId: workspace.id,
    },
    payload: {
      query: listener.query,
      limit: 3,
      listenerId: listener.id,
    },
  });

  const realPosts =
    discovery.posts && discovery.posts.length > 0 ? discovery.posts : [];

  // Live: only persist real connector posts — never invent example.com targets.
  // Simulator: seed demo posts when discovery is empty so the pipeline is testable.
  const posts =
    mode === "live"
      ? realPosts
      : realPosts.length > 0
        ? realPosts
        : [
            `Baru coba ${listener.query} dan hasilnya lumayan. Ada tips biar lebih optimal?`,
            `Lagi riset ${listener.query}. Rekomendasi tools yang worth it buat tim kecil?`,
            `Diskusi ${listener.query} lagi rame. Siapa yang sudah implement end-to-end?`,
          ].map((content, i) => {
            const externalId = `${listener.platform}_${listener.id}_${Date.now()}_${i}`;
            return {
              externalId,
              authorHandle: `user_${100 + i}`,
              content,
              url: `https://example.com/p/${externalId}`,
              platform: listener.platform,
            };
          });

  if (mode === "live" && !discovery.ok) {
    throw new Error(discovery.message || "Listener poll failed in live mode");
  }

  const createdPosts = [] as string[];
  for (const sample of posts) {
    try {
      const post = await db.targetPost.upsert({
        where: {
          workspaceId_platform_externalId: {
            workspaceId: workspace.id,
            platform: listener.platform,
            externalId: sample.externalId,
          },
        },
        create: {
          workspaceId: workspace.id,
          campaignId: listener.campaignId,
          listenerId: listener.id,
          platform: listener.platform,
          externalId: sample.externalId,
          authorHandle: sample.authorHandle,
          content: sample.content,
          url: sample.url,
          status: "new",
        },
        update: {
          // Refresh discovery metadata but do not reset an in-flight pipeline status.
          authorHandle: sample.authorHandle,
          content: sample.content,
          url: sample.url,
          listenerId: listener.id,
          campaignId: listener.campaignId,
        },
        select: { id: true, status: true },
      });
      if (post.status === "new") createdPosts.push(post.id);
    } catch {
      // Skip malformed / race duplicates without failing the whole poll.
    }
  }

  await db.listener.update({
    where: { id: listener.id },
    data: { lastPolledAt: new Date() },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "listener.polled",
    resourceType: "listener",
    resourceId: listener.id,
    metadata: {
      created: createdPosts.length,
      mode,
      invented: mode === "simulator" && realPosts.length === 0,
      connector: discovery.connector,
    },
  });

  revalidatePath("/app/listeners");
  revalidatePath(`/app/listeners/${listener.id}`);
  revalidatePath("/app/inbox");
  revalidatePath("/app/campaigns");
  return { created: createdPosts.length, postIds: createdPosts };
}
