"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { executeSocialAction } from "@/lib/connectors/runtime";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import type { ListenerType, Platform } from "@prisma/client";

export async function listListeners() {
  const { workspace } = await requireActiveWorkspace();
  return db.listener.findMany({
    where: { workspaceId: workspace.id },
    include: {
      campaign: true,
      _count: { select: { posts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createListener(input: {
  platform: Platform;
  type: ListenerType;
  query: string;
  campaignId?: string;
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
      isActive: true,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "listener.created",
    resourceType: "listener",
    resourceId: listener.id,
    metadata: { query, platform: listener.platform, type: listener.type },
  });

  revalidatePath("/app/listeners");
  return listener;
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
  revalidatePath("/app/inbox");
  revalidatePath("/app/campaigns");
  return { created: createdPosts.length, postIds: createdPosts };
}
