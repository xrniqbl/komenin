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
    }).catch((error) => {
      // Supplementary breakdown only — never mask a DB outage as "no data"
      // without a trace. The headline counts above already throw honestly.
      console.error("[analytics] instagram breakdown failed (degraded)", error);
      return [];
    }),
    db.commentAction.groupBy({
      by: ["status"],
      where: {
        workspaceId: workspace.id,
        status: "sent",
        createdAt: { gte: since },
        targetPost: { platform: "threads" },
      },
      _count: { _all: true },
    }).catch((error) => {
      console.error("[analytics] threads breakdown failed (degraded)", error);
      return [];
    }),
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
      .catch((error) => {
        console.error("[analytics] sends-by-platform failed (degraded)", error);
        return [] as Array<{ platform: string; count: number }>;
      }),
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
      .catch((error) => {
        console.error("[analytics] publishes-by-platform failed (degraded)", error);
        return [] as Array<{ platform: string; count: number }>;
      }),
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
  const days = Math.min(Math.max(Math.floor(rangeDays) || 30, 1), 365);
  const since = daysAgo(days);

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

  const [leads, campaigns, sentActions] = await Promise.all([
    db.engagementLead.findMany({
      where: { workspaceId: workspace.id, createdAt: { gte: since } },
      select: { clientId: true, status: true, followUpAt: true, platform: true, campaignId: true },
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
    // Sent actions in range → per-client volume + volume-by-platform.
    // Degraded to empty (not fatal): headline client/campaign/lead counts stay honest.
    db.commentAction
      .findMany({
        where: { workspaceId: workspace.id, status: "sent", createdAt: { gte: since } },
        select: {
          campaign: { select: { clientId: true } },
          targetPost: { select: { platform: true } },
        },
        take: 2000,
      })
      .catch((error) => {
        console.error("[analytics] agency sends breakdown failed (degraded)", error);
        return [] as Array<{
          campaign: { clientId: string | null } | null;
          targetPost: { platform: "instagram" | "threads" | "tiktok" } | null;
        }>;
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
      sends: number;
      sendsByPlatform: Array<{ platform: string; count: number }>;
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
      sends: 0,
      sendsByPlatform: [] as Array<{ platform: string; count: number }>,
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

  const sendsMix = new Map<string | null, Map<string, number>>();
  for (const action of sentActions) {
    const clientId = action.campaign?.clientId ?? null;
    const platform = action.targetPost?.platform || "unknown";
    const mix = sendsMix.get(clientId) ?? new Map<string, number>();
    mix.set(platform, (mix.get(platform) || 0) + 1);
    sendsMix.set(clientId, mix);
  }
  for (const [clientId, mix] of sendsMix) {
    const name = clientId
      ? clients.find((c) => c.id === clientId)?.name || "Client"
      : "Unassigned";
    const row = ensure(clientId, name);
    const entries = Array.from(mix.entries());
    row.sends = entries.reduce((sum, [, count]) => sum + count, 0);
    row.sendsByPlatform = entries
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);
  }

  const rows = Array.from(byClient.values()).sort((a, b) => {
    if (a.clientId == null) return 1;
    if (b.clientId == null) return -1;
    return b.leadsTotal + b.campaigns - (a.leadsTotal + a.campaigns);
  });

  return {
    rangeDays: days,
    totals: {
      clients: clients.length,
      campaigns: campaigns.length,
      leads: leads.length,
      leadsDue: rows.reduce((sum, row) => sum + row.leadsDue, 0),
      sends: sentActions.length,
    },
    rows,
  };
}

/**
 * Engagement funnel for the range: listeners → target posts → comment drafts
 * → approval decisions → sent actions → published auto-posts. Each stage
 * reports the conversion ratio vs the previous stage so drop-offs are visible.
 */
export async function getAnalyticsFunnel(rangeDays = 30) {
  const { workspace } = await requireActiveWorkspace();
  const days = Math.min(Math.max(Math.floor(rangeDays) || 30, 1), 365);
  const since = daysAgo(days);

  const [listeners, posts, drafts, approvalsDecided, approvalsPending, sends, published] =
    await Promise.all([
      db.listener.count({ where: { workspaceId: workspace.id, isActive: true } }),
      db.targetPost.count({ where: { workspaceId: workspace.id, discoveredAt: { gte: since } } }),
      db.commentDraft.count({ where: { workspaceId: workspace.id, createdAt: { gte: since } } }),
      db.approval.count({
        where: {
          workspaceId: workspace.id,
          status: { in: ["approved", "rejected"] },
          decidedAt: { gte: since },
        },
      }),
      db.approval.count({ where: { workspaceId: workspace.id, status: "pending" } }),
      db.commentAction.count({
        where: { workspaceId: workspace.id, status: "sent", createdAt: { gte: since } },
      }),
      db.contentDraft.count({
        where: { workspaceId: workspace.id, status: "published", publishedAt: { gte: since } },
      }),
    ]);

  const ratio = (part: number, whole: number): number | null =>
    whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

  const stages = [
    { key: "listeners", label: "Active listeners", value: listeners, conversionFromPrev: null as number | null },
    { key: "posts", label: "Target posts", value: posts, conversionFromPrev: null as number | null },
    { key: "drafts", label: "Comment drafts", value: drafts, conversionFromPrev: ratio(drafts, posts) },
    { key: "approvals", label: "Approvals decided", value: approvalsDecided, conversionFromPrev: ratio(approvalsDecided, drafts) },
    { key: "sends", label: "Comments sent", value: sends, conversionFromPrev: ratio(sends, approvalsDecided) },
    { key: "published", label: "Posts published", value: published, conversionFromPrev: null as number | null },
  ];

  return {
    rangeDays: days,
    stages,
    approvalsPending,
    endToEnd: {
      postsToSends: ratio(sends, posts),
      draftsToSends: ratio(sends, drafts),
    },
  };
}

/**
 * Per-campaign ROI table for the range: drafts, approvals decided,
 * approval rate, sends, publishes (estimated via sends when unattributed),
 * attributed leads (EngagementLead.campaignId), and sends per day.
 */
export async function getCampaignRoiReport(rangeDays = 30) {
  const { workspace } = await requireActiveWorkspace();
  const days = Math.min(Math.max(Math.floor(rangeDays) || 30, 1), 365);
  const since = daysAgo(days);

  const campaigns = await db.campaign.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      platform: true,
      status: true,
      clientId: true,
      client: { select: { name: true } },
      dailyLimit: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  const [draftGroups, approvalGroups, sendGroups, leadGroups] = await Promise.all([
    db.commentDraft.groupBy({
      by: ["campaignId", "status"],
      where: { workspaceId: workspace.id, campaignId: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.approval.groupBy({
      by: ["campaignId", "status"],
      where: { workspaceId: workspace.id, campaignId: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.commentAction.groupBy({
      by: ["campaignId", "status"],
      where: { workspaceId: workspace.id, campaignId: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    // Lead attribution: EngagementLead.campaignId is the supported relation.
    db.engagementLead.groupBy({
      by: ["campaignId", "status"],
      where: { workspaceId: workspace.id, campaignId: { not: null }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const sumBy = (
    groups: Array<{ campaignId: string | null; status: string; _count: { _all: number } }>,
    pick: (status: string) => boolean,
  ) => {
    const map = new Map<string, number>();
    for (const g of groups) {
      if (!g.campaignId || !pick(g.status)) continue;
      map.set(g.campaignId, (map.get(g.campaignId) || 0) + g._count._all);
    }
    return map;
  };

  const draftsBy = sumBy(draftGroups, () => true);
  const approvalsDecidedBy = sumBy(approvalGroups, (s) => s === "approved" || s === "rejected");
  const approvedBy = sumBy(approvalGroups, (s) => s === "approved");
  const sendsBy = sumBy(sendGroups, (s) => s === "sent");
  const failedSendsBy = sumBy(sendGroups, (s) => s === "failed");
  const leadsBy = sumBy(leadGroups, () => true);
  const wonLeadsBy = sumBy(leadGroups, (s) => s === "won");

  const rows = campaigns.map((c) => {
    const drafts = draftsBy.get(c.id) || 0;
    const decided = approvalsDecidedBy.get(c.id) || 0;
    const approved = approvedBy.get(c.id) || 0;
    const sends = sendsBy.get(c.id) || 0;
    const failed = failedSendsBy.get(c.id) || 0;
    const leads = leadsBy.get(c.id) || 0;
    const won = wonLeadsBy.get(c.id) || 0;
    const approvalRate = decided > 0 ? Math.round((approved / decided) * 1000) / 10 : null;
    const sendsPerDay = days > 0 ? Math.round((sends / days) * 100) / 100 : 0;
    return {
      campaignId: c.id,
      name: c.name,
      platform: c.platform,
      status: c.status,
      clientName: c.client?.name || null,
      drafts,
      approvalsDecided: decided,
      approved,
      approvalRate,
      sends,
      failedSends: failed,
      leadsAttributed: leads,
      leadsWon: won,
      sendsPerDay,
    };
  });

  // Most productive first; campaigns with zero activity sink to the bottom.
  rows.sort((a, b) => b.sends + b.leadsAttributed - (a.sends + a.leadsAttributed));

  return {
    rangeDays: days,
    totals: {
      campaigns: campaigns.length,
      drafts: rows.reduce((s, r) => s + r.drafts, 0),
      sends: rows.reduce((s, r) => s + r.sends, 0),
      leadsAttributed: rows.reduce((s, r) => s + r.leadsAttributed, 0),
      leadsWon: rows.reduce((s, r) => s + r.leadsWon, 0),
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

/** Export analytics summary KPIs (one row per metric) for the export route. */
export async function exportSummaryCsv(rangeDays = 30) {
  const { workspace } = await requireActiveWorkspace();
  const { assertWorkspacePermission } = await import("@/lib/rbac");
  assertWorkspacePermission(workspace, "analytics.view");
  const summary = await getAnalyticsSummary(rangeDays);

  const rows: Array<[string, string | number]> = [
    ["rangeDays", summary.rangeDays],
    ["sends", summary.sends],
    ["failedSends", summary.failedSends],
    ["approvalsPending", summary.approvalsPending],
    ["approvalsDone", summary.approvalsDone],
    ["publishes", summary.publishes],
    ["leadsNew", summary.leadsNew],
    ["leadsWon", summary.leadsWon],
    ["skillRuns", summary.skillRuns],
    ["healthyAccounts", summary.healthyAccounts],
    ["degradedAccounts", summary.degradedAccounts],
  ];
  for (const row of summary.sendsByPlatform) {
    rows.push([`sends:${row.platform}`, row.count]);
  }
  for (const row of summary.publishesByPlatform) {
    rows.push([`publishes:${row.platform}`, row.count]);
  }
  for (const row of summary.deliveries) {
    rows.push([`delivery:${row.kind}`, row.count]);
  }

  const lines = [
    "metric,value",
    ...rows.map(([metric, value]) => [metric, value].map(csvCell).join(",")),
  ];
  return { filename: csvFilename("analytics-summary"), csv: lines.join("\n"), count: rows.length };
}

/** Export per-client agency rows for the export route. */
export async function exportClientsCsv(rangeDays = 30) {
  const { workspace } = await requireActiveWorkspace();
  const { assertWorkspacePermission } = await import("@/lib/rbac");
  assertWorkspacePermission(workspace, "analytics.view");
  const report = await getClientAgencyReport(rangeDays);

  const header = [
    "clientId", "name", "active", "campaigns",
    "leadsTotal", "leadsNew", "leadsQualified", "leadsWon", "leadsDue",
    "targetPosts", "approvals", "drafts", "sends", "sendsByPlatform",
  ];
  const lines = [
    header.join(","),
    ...report.rows.map((row) =>
      [
        row.clientId || "",
        row.name,
        row.active ? "true" : "false",
        row.campaigns,
        row.leadsTotal,
        row.leadsNew,
        row.leadsQualified,
        row.leadsWon,
        row.leadsDue,
        row.targetPosts,
        row.approvals,
        row.drafts,
        row.sends,
        row.sendsByPlatform.map((s) => `${s.platform}:${s.count}`).join(" | "),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return { filename: csvFilename("analytics-clients"), csv: lines.join("\n"), count: report.rows.length };
}

/** Export per-campaign ROI rows for the export route. */
export async function exportCampaignsCsv(rangeDays = 30) {
  const { workspace } = await requireActiveWorkspace();
  const { assertWorkspacePermission } = await import("@/lib/rbac");
  assertWorkspacePermission(workspace, "analytics.view");
  const report = await getCampaignRoiReport(rangeDays);

  const header = [
    "campaignId", "name", "platform", "status", "client",
    "drafts", "approvalsDecided", "approved", "approvalRatePct",
    "sends", "failedSends", "leadsAttributed", "leadsWon", "sendsPerDay",
  ];
  const lines = [
    header.join(","),
    ...report.rows.map((row) =>
      [
        row.campaignId,
        row.name,
        row.platform,
        row.status,
        row.clientName || "",
        row.drafts,
        row.approvalsDecided,
        row.approved,
        row.approvalRate ?? "",
        row.sends,
        row.failedSends,
        row.leadsAttributed,
        row.leadsWon,
        row.sendsPerDay,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  return { filename: csvFilename("analytics-campaigns"), csv: lines.join("\n"), count: report.rows.length };
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


/** Daily sends + drafts for the last 7 days, for the overview chart. */
export async function getWeeklyActivity() {
  const { workspace } = await requireActiveWorkspace();
  const days: { date: string; label: string; sends: number; drafts: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);

    const [sends, drafts] = await Promise.all([
      db.commentAction.count({
        where: {
          workspaceId: workspace.id,
          status: "sent",
          createdAt: { gte: d, lt: next },
        },
      }),
      db.commentDraft.count({
        where: {
          workspaceId: workspace.id,
          createdAt: { gte: d, lt: next },
        },
      }),
    ]);

    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      sends,
      drafts,
    });
  }

  return days;
}