"use server";

import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";

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

export async function getClientAgencyReport(rangeDays = 30) {
  const { workspace } = await requireActiveWorkspace();
  const since = daysAgo(rangeDays);

  const clients = await db.clientProfile.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      _count: { select: { campaigns: true, leads: true } },
    },
    orderBy: { name: "asc" },
  });

  const [leads, campaigns] = await Promise.all([
    db.engagementLead.findMany({
      where: { workspaceId: workspace.id, createdAt: { gte: since } },
      select: { clientId: true, status: true, followUpAt: true },
    }),
    db.campaign.findMany({
      where: { workspaceId: workspace.id },
      select: {
        id: true,
        clientId: true,
        status: true,
        _count: { select: { targetPosts: true, approvals: true, drafts: true } },
      },
    }),
  ]);

  const now = Date.now();
  const byClient = new Map<
    string | null,
    {
      clientId: string | null;
      name: string;
      active: boolean;
      campaigns: number;
      leadsTotal: number;
      leadsNew: number;
      leadsQualified: number;
      leadsWon: number;
      leadsDue: number;
      targetPosts: number;
      approvals: number;
      drafts: number;
    }
  >();

  const ensure = (clientId: string | null, name: string, active = true) => {
    const key = clientId;
    const existing = byClient.get(key);
    if (existing) return existing;
    const row = {
      clientId,
      name,
      active,
      campaigns: 0,
      leadsTotal: 0,
      leadsNew: 0,
      leadsQualified: 0,
      leadsWon: 0,
      leadsDue: 0,
      targetPosts: 0,
      approvals: 0,
      drafts: 0,
    };
    byClient.set(key, row);
    return row;
  };

  ensure(null, "Unassigned", true);
  for (const client of clients) {
    ensure(client.id, client.name, client.isActive);
  }

  for (const campaign of campaigns) {
    const row = ensure(
      campaign.clientId,
      campaign.clientId
        ? clients.find((c) => c.id === campaign.clientId)?.name || "Client"
        : "Unassigned",
    );
    row.campaigns += 1;
    row.targetPosts += campaign._count.targetPosts;
    row.approvals += campaign._count.approvals;
    row.drafts += campaign._count.drafts;
  }

  for (const lead of leads) {
    const row = ensure(
      lead.clientId,
      lead.clientId
        ? clients.find((c) => c.id === lead.clientId)?.name || "Client"
        : "Unassigned",
    );
    row.leadsTotal += 1;
    if (lead.status === "new") row.leadsNew += 1;
    if (lead.status === "qualified" || lead.status === "contacted") row.leadsQualified += 1;
    if (lead.status === "won") row.leadsWon += 1;
    if (
      lead.followUpAt &&
      lead.followUpAt.getTime() <= now &&
      !["won", "lost", "archived"].includes(lead.status)
    ) {
      row.leadsDue += 1;
    }
  }

  const rows = Array.from(byClient.values()).sort((a, b) => {
    if (a.clientId == null) return 1;
    if (b.clientId == null) return -1;
    return b.leadsTotal + b.campaigns - (a.leadsTotal + a.campaigns);
  });

  return {
    rangeDays,
    totals: {
      clients: clients.length,
      campaigns: campaigns.length,
      leads: leads.length,
      leadsDue: rows.reduce((sum, row) => sum + row.leadsDue, 0),
    },
    rows,
  };
}
