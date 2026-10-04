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
    sendsByPlatform,
    publishesByPlatform,
    newLeads,
    wonLeads,
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
    // Per-platform send mix from account-facing actions in range.
    ...[["sends"], ["publishes"]].map(() => Promise.resolve(null)),
  ]);

  const platformPair = await Promise.all([
    db.commentAction.groupBy({
      by: ["status"],
      where: {
        workspaceId: workspace.id,
        status: "sent",
        createdAt: { gte: since },
        targetPost: { platform: "instagram" },
      },
      _count: { _all: true },
    }).catch(() => []),
    db.commentAction.groupBy({
      by: ["status"],
      where: {
        workspaceId: workspace.id,
        status: "sent",
        createdAt: { gte: since },
        targetPost: { platform: "threads" },
      },
      _count: { _all: true },
    }).catch(() => []),
  ]).catch(() => [[], []] as const);

  const [sendsByPlatformRows, publishesByPlatformRows, leadsNew, leadsWon] = await Promise.all([
    db.commentAction
      .findMany({
        where: { workspaceId: workspace.id, status: "sent", createdAt: { gte: since } },
        select: { targetPost: { select: { platform: true } } },
        take: 500,
      })
      .then((rows) => {
        const counts = new Map<string, number>();
        for (const row of rows) {
          const platform = row.targetPost?.platform || "unknown";
          counts.set(platform, (counts.get(platform) || 0) + 1);
        }
        return Array.from(counts.entries()).map(([platform, count]) => ({ platform, count }));
      })
      .catch(() => [] as Array<{ platform: string; count: number }>),
    db.contentDraft
      .findMany({
        where: { workspaceId: workspace.id, status: "published", publishedAt: { gte: since } },
        select: { contentCampaign: { select: { platform: true } } },
        take: 500,
      })
      .then((rows) => {
        const counts = new Map<string, number>();
        for (const row of rows) {
          const platform = row.contentCampaign?.platform || "unknown";
          counts.set(platform, (counts.get(platform) || 0) + 1);
        }
        return Array.from(counts.entries()).map(([platform, count]) => ({ platform, count }));
      })
      .catch(() => [] as Array<{ platform: string; count: number }>),
    db.engagementLead.count({
      where: { workspaceId: workspace.id, createdAt: { gte: since } },
    }),
    db.engagementLead.count({
      where: { workspaceId: workspace.id, status: "won", updatedAt: { gte: since } },
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
    sendsByPlatform: sendsByPlatformRows,
    publishesByPlatform: publishesByPlatformRows,
    leadsNew,
    leadsWon,
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

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function csvFilename(prefix: string): string {
  return `komenin-${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}

/** Export comment sends (up to 500 rows) for the analytics CSV buttons. */
export async function exportCommentSendsCsv(rangeDays = 30) {
  const { workspace } = await requireActiveWorkspace();
  const { assertWorkspacePermission } = await import("@/lib/rbac");
  assertWorkspacePermission(workspace, "analytics.view");
  const days = Math.min(Math.max(Math.floor(rangeDays) || 30, 1), 365);
  const since = daysAgo(days);

  const rows = await db.commentAction.findMany({
    where: { workspaceId: workspace.id, createdAt: { gte: since } },
    include: {
      targetPost: { select: { platform: true, authorHandle: true } },
      socialAccount: { select: { username: true } },
      campaign: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const header = ["id", "status", "platform", "author", "account", "campaign", "scheduledFor", "executedAt", "createdAt"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.status,
        row.targetPost?.platform,
        row.targetPost ? `@${row.targetPost.authorHandle}` : "",
        row.socialAccount ? `@${row.socialAccount.username}` : "",
        row.campaign?.name,
        row.scheduledFor?.toISOString() || "",
        row.executedAt?.toISOString() || "",
        row.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return { filename: csvFilename("comment-sends"), csv: lines.join("\n"), count: rows.length };
}

/** Export published auto posts (up to 500 rows) for the analytics CSV buttons. */
export async function exportPublishesCsv(rangeDays = 30) {
  const { workspace } = await requireActiveWorkspace();
  const { assertWorkspacePermission } = await import("@/lib/rbac");
  assertWorkspacePermission(workspace, "analytics.view");
  const days = Math.min(Math.max(Math.floor(rangeDays) || 30, 1), 365);
  const since = daysAgo(days);

  const rows = await db.contentDraft.findMany({
    where: { workspaceId: workspace.id, status: "published", publishedAt: { gte: since } },
    include: {
      contentCampaign: { select: { name: true, platform: true } },
      socialAccount: { select: { username: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 500,
  });

  const header = ["id", "campaign", "platform", "account", "sequence", "title", "scheduledFor", "publishedAt"];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.contentCampaign?.name,
        row.contentCampaign?.platform,
        row.socialAccount ? `@${row.socialAccount.username}` : "",
        row.sequence,
        row.title,
        row.scheduledFor?.toISOString() || "",
        row.publishedAt?.toISOString() || "",
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return { filename: csvFilename("publishes"), csv: lines.join("\n"), count: rows.length };
}

/**
 * AI usage analytics for the workspace (spec §3.5): credits consumed per
 * funding source (own key vs subscription vs payg), top models, and an
 * estimated cost figure. Sourced from AiUsageEvent (one row per AI call).
 */
export async function getAiUsageAnalytics(rangeDays = 30) {
  const { workspace } = await requireActiveWorkspace();
  // Clamp the window so a crafted range can't trigger an unbounded table scan.
  const days = Math.min(Math.max(Math.floor(rangeDays) || 30, 1), 365);
  const since = daysAgo(days);

  const events = await db.aiUsageEvent.findMany({
    where: { workspaceId: workspace.id, createdAt: { gte: since } },
    select: {
      billedTo: true,
      model: true,
      creditsUsed: true,
      inputTokens: true,
      outputTokens: true,
    },
  });

  const bySource = { own_key: 0n, subscription: 0n, payg: 0n };
  const tokensBySource = { own_key: 0, subscription: 0, payg: 0 };
  const byModel = new Map<string, { calls: number; credits: bigint }>();
  let totalCalls = 0;

  for (const e of events) {
    totalCalls += 1;
    const src = (e.billedTo as keyof typeof bySource) in bySource ? e.billedTo : "own_key";
    bySource[src as keyof typeof bySource] += e.creditsUsed;
    tokensBySource[src as keyof typeof tokensBySource] += e.inputTokens + e.outputTokens;
    const m = byModel.get(e.model) ?? { calls: 0, credits: 0n };
    m.calls += 1;
    m.credits += e.creditsUsed;
    byModel.set(e.model, m);
  }

  const topModels = Array.from(byModel.entries())
    .map(([model, v]) => ({ model, calls: v.calls, credits: v.credits.toString() }))
    .sort((a, b) => Number(BigInt(b.credits) - BigInt(a.credits)))
    .slice(0, 5);

  // Rough cost estimate in IDR for Komenin-funded usage. Blended at the
  // Starter rate (Rp50.000 / 1.000.000 credits = Rp0,05/credit) — analytics
  // only, not used for billing.
  const komeninCredits = bySource.subscription + bySource.payg;
  const estimatedCostIdr = Number(komeninCredits) * 0.05;

  return {
    rangeDays: days,
    totalCalls,
    creditsBySource: {
      own_key: bySource.own_key.toString(),
      subscription: bySource.subscription.toString(),
      payg: bySource.payg.toString(),
    },
    tokensBySource,
    topModels,
    estimatedCostIdr: Math.round(estimatedCostIdr),
  };
}
