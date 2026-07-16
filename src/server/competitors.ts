"use server";

import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";
import { writeAuditLog } from "@/server/audit";
import type { Platform } from "@prisma/client";

export async function listCompetitorProfiles() {
  const { workspace } = await requireActiveWorkspace();
  return db.competitorProfile.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCompetitorProfile(input: {
  handle: string;
  platform: Platform;
  displayName?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "campaigns.manage");

  let handle = input.handle.trim().replace(/^@/, "");
  if (!handle) throw new Error("Handle is required");
  if (handle.length > 100) throw new Error("Handle too long");

  const profile = await db.$transaction(async (tx) => {
    const created = await tx.competitorProfile.create({
      data: {
        workspaceId: workspace.id,
        handle,
        platform: input.platform,
        displayName: input.displayName?.trim() || null,
        isActive: true,
      },
    });

    // Also create a competitor listener for discovery
    await tx.listener.create({
      data: {
        workspaceId: workspace.id,
        platform: input.platform,
        type: "competitor",
        query: handle,
        isActive: true,
      },
    });

    return created;
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "competitor_profile.created",
    resourceType: "competitor_profile",
    resourceId: profile.id,
    metadata: { handle: profile.handle, platform: profile.platform },
  });

  revalidatePath("/app/competitors");
  return profile;
}

export async function deleteCompetitorProfile(id: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "campaigns.manage");

  const existing = await db.competitorProfile.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Competitor profile not found");

  await db.competitorProfile.delete({ where: { id } });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "competitor_profile.deleted",
    resourceType: "competitor_profile",
    resourceId: id,
  });

  revalidatePath("/app/competitors");
  return { ok: true };
}

export async function getCompetitorMetrics(profileId: string) {
  const { workspace } = await requireActiveWorkspace();

  const profile = await db.competitorProfile.findFirst({
    where: { id: profileId, workspaceId: workspace.id },
  });
  if (!profile) throw new Error("Competitor profile not found");

  // Find listeners matching handle
  const listeners = await db.listener.findMany({
    where: {
      workspaceId: workspace.id,
      type: "competitor",
      query: { contains: profile.handle, mode: "insensitive" },
    },
    select: { id: true },
  });
  const listenerIds = listeners.map((l) => l.id);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [count7d, count30d, posts30d, allPosts] = await Promise.all([
    db.targetPost.count({
      where: {
        workspaceId: workspace.id,
        listenerId: { in: listenerIds },
        discoveredAt: { gte: sevenDaysAgo },
      },
    }),
    db.targetPost.count({
      where: {
        workspaceId: workspace.id,
        listenerId: { in: listenerIds },
        discoveredAt: { gte: thirtyDaysAgo },
      },
    }),
    db.targetPost.findMany({
      where: {
        workspaceId: workspace.id,
        listenerId: { in: listenerIds },
        discoveredAt: { gte: thirtyDaysAgo },
      },
      select: { content: true, discoveredAt: true },
      orderBy: { discoveredAt: "desc" },
      take: 100,
    }),
    db.targetPost.findMany({
      where: {
        workspaceId: workspace.id,
        listenerId: { in: listenerIds },
      },
      select: { discoveredAt: true },
      orderBy: { discoveredAt: "desc" },
      take: 200,
    }),
  ]);

  // Daily buckets last 14d for sparkline
  const dailyBuckets: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const count = allPosts.filter((p) => p.discoveredAt.toISOString().slice(0, 10) === key).length;
    dailyBuckets.push({ date: key, count });
  }

  // Top keywords simple token freq
  const wordCounts = new Map<string, number>();
  for (const post of posts30d) {
    const tokens = post.content.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
    for (const tok of tokens) {
      wordCounts.set(tok, (wordCounts.get(tok) || 0) + 1);
    }
  }
  const topKeywords = Array.from(wordCounts.entries())
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  return {
    profile,
    count7d,
    count30d,
    avgPerDay: count30d > 0 ? Math.round((count30d / 30) * 10) / 10 : 0,
    dailyBuckets,
    topKeywords,
    recentPosts: posts30d.slice(0, 5),
  };
}

export async function getCompetitorOverview() {
  const { workspace } = await requireActiveWorkspace();

  const [profiles, ownPosts] = await Promise.all([
    db.competitorProfile.findMany({
      where: { workspaceId: workspace.id, isActive: true },
      orderBy: { createdAt: "desc" },
    }),
    db.targetPost.count({
      where: {
        workspaceId: workspace.id,
        campaignId: { not: null },
      },
    }),
  ]);

  return { profiles, ownPosts };
}
