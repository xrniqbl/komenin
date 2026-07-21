"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
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

  const listener = await db.listener.create({
    data: {
      workspaceId: workspace.id,
      platform: input.platform,
      type: input.type,
      query,
      campaignId: input.campaignId || null,
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

  const samples = [
    `Baru coba ${listener.query} dan hasilnya lumayan. Ada tips biar lebih optimal?`,
    `Lagi riset ${listener.query}. Rekomendasi tools yang worth it buat tim kecil?`,
    `Diskusi ${listener.query} lagi rame. Siapa yang sudah implement end-to-end?`,
  ];

  const createdPosts = [] as string[];
  for (let i = 0; i < samples.length; i += 1) {
    const externalId = `${listener.platform}_${listener.id}_${Date.now()}_${i}`;
    const post = await db.targetPost.create({
      data: {
        workspaceId: workspace.id,
        campaignId: listener.campaignId,
        listenerId: listener.id,
        platform: listener.platform,
        externalId,
        authorHandle: `user_${100 + i}`,
        content: samples[i],
        url: `https://example.com/p/${externalId}`,
        status: "new",
      },
    });
    createdPosts.push(post.id);
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "listener.polled",
    resourceType: "listener",
    resourceId: listener.id,
    metadata: { created: createdPosts.length },
  });

  revalidatePath("/app/listeners");
  revalidatePath("/app/inbox");
  revalidatePath("/app/campaigns");
  return { created: createdPosts.length, postIds: createdPosts };
}
