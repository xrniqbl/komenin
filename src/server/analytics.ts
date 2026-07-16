"use server";

import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export async function getAnalyticsSummary(rangeDays = 30) {
  const { workspace } = await requireActiveWorkspace();
  const since = daysAgo(rangeDays);

  const [
    sends,
    failedSends,
    approvalsPending,
    approvalsDone,
    publishes,
    healthyAccounts,
    degradedAccounts,
    skillRuns,
    deliveries,
    usage,
  ] = await Promise.all([
    db.commentAction.count({
      where: {
        workspaceId: workspace.id,
        status: "sent",
        createdAt: { gte: since },
      },
    }),
    db.commentAction.count({
      where: {
        workspaceId: workspace.id,
        status: "failed",
        createdAt: { gte: since },
      },
    }),
    db.approval.count({
      where: { workspaceId: workspace.id, status: "pending" },
    }),
    db.approval.count({
      where: {
        workspaceId: workspace.id,
        status: { in: ["approved", "rejected"] },
        createdAt: { gte: since },
      },
    }),
    db.contentDraft.count({
      where: {
        workspaceId: workspace.id,
        status: "published",
        publishedAt: { gte: since },
      },
    }),
    db.socialAccount.count({
      where: { workspaceId: workspace.id, status: "healthy", deletedAt: null },
    }),
    db.socialAccount.count({
      where: {
        workspaceId: workspace.id,
        status: { in: ["degraded", "limited", "banned"] },
        deletedAt: null,
      },
    }),
    db.skillRun.count({
      where: { workspaceId: workspace.id, createdAt: { gte: since } },
    }),
    db.deliveryLog.groupBy({
      by: ["kind"],
      where: { workspaceId: workspace.id, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.usageCounter.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    rangeDays,
    sends,
    failedSends,
    approvalsPending,
    approvalsDone,
    publishes,
    healthyAccounts,
    degradedAccounts,
    skillRuns,
    deliveries: deliveries.map((row) => ({
      kind: row.kind,
      count: row._count._all,
    })),
    usage,
    limits: {
      monthlySendLimit: workspace.monthlySendLimit,
      monthlyPublishLimit: workspace.monthlyPublishLimit,
      planCode: workspace.planCode,
    },
  };
}
