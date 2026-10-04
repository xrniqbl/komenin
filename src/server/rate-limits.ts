"use server";

import { effectiveActionsToday } from "@/lib/account-quota";
import {
  describePlatformLimits,
  effectiveDailyCommentCap,
  getPlatformGuardrail,
  PLATFORM_GUARDRAILS,
} from "@/lib/platform-rate-limits";
import { getQuotaPercent, getThresholdStatus } from "@/lib/quota";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";

function currentPeriodKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function listRateLimitStatus() {
  const { workspace } = await requireActiveWorkspace();
  const periodKey = currentPeriodKey();

  const [accounts, usage, ws] = await Promise.all([
    db.socialAccount.findMany({
      where: { workspaceId: workspace.id, deletedAt: null },
      select: {
        id: true,
        username: true,
        platform: true,
        status: true,
        dailyQuota: true,
        actionsToday: true,
        lastActionAt: true,
        createdAt: true,
        healthScore: true,
      },
      orderBy: { username: "asc" },
    }),
    db.usageCounter.findUnique({
      where: {
        workspaceId_periodKey: { workspaceId: workspace.id, periodKey },
      },
    }),
    db.workspace.findUnique({
      where: { id: workspace.id },
      select: { monthlySendLimit: true, monthlyPublishLimit: true, planCode: true },
    }),
  ]);

  const sendsUsed = usage?.sends ?? 0;
  const publishesUsed = usage?.publishes ?? 0;
  const generatesUsed = usage?.generates ?? 0;
  const skillRunsUsed = usage?.skillRuns ?? 0;
  const sendLimit = ws?.monthlySendLimit ?? 5000;
  const publishLimit = ws?.monthlyPublishLimit ?? 1000;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourlyCounts = await db.commentAction.groupBy({
    by: ["socialAccountId"],
    where: {
      workspaceId: workspace.id,
      status: "sent",
      executedAt: { gte: hourAgo },
    },
    _count: { socialAccountId: true },
  });
  const hourlyByAccount = new Map(
    hourlyCounts.map((row) => [row.socialAccountId, row._count.socialAccountId]),
  );

  const accountStatuses = accounts.map((acc) => {
    // Effective cap = strictest of platform safe cap, new-account warming
    // cap, and the operator quota — this is the number that actually
    // protects the account from platform restriction.
    const effectiveCap = effectiveDailyCommentCap({
      platform: acc.platform,
      accountCreatedAt: acc.createdAt,
      customDailyQuota: acc.dailyQuota,
    });
    const effectiveUsed = effectiveActionsToday({
      actionsToday: acc.actionsToday,
      dailyQuota: acc.dailyQuota,
      lastActionAt: acc.lastActionAt,
    });
    const guardrail = getPlatformGuardrail(acc.platform);
    const sentInLastHour = hourlyByAccount.get(acc.id) ?? 0;
    const hourlyThrottled = sentInLastHour >= guardrail.comments.safePerHour;
    const pct = getQuotaPercent(effectiveUsed, effectiveCap);
    const status = getThresholdStatus(effectiveUsed, effectiveCap);
    return {
      ...acc,
      pct,
      status,
      effectiveCap,
      effectiveUsed,
      sentInLastHour,
      hourlyCap: guardrail.comments.safePerHour,
      hourlyThrottled,
      limitSummary: describePlatformLimits(acc.platform),
      throttled: effectiveUsed >= effectiveCap || hourlyThrottled || acc.status === "limited",
    };
  });

  return {
    workspace: {
      planCode: ws?.planCode ?? "unknown",
      sendsUsed,
      publishesUsed,
      generatesUsed,
      skillRunsUsed,
      sendLimit,
      publishLimit,
      sendsPct: getQuotaPercent(sendsUsed, sendLimit),
      publishesPct: getQuotaPercent(publishesUsed, publishLimit),
      sendsStatus: getThresholdStatus(sendsUsed, sendLimit),
      publishesStatus: getThresholdStatus(publishesUsed, publishLimit),
    },
    accounts: accountStatuses,
    throttledCount: accountStatuses.filter((a) => a.throttled).length,
    periodKey,
    guardrails: Object.values(PLATFORM_GUARDRAILS).map((g) => ({
      platform: g.platform,
      label: g.label,
      commentsPerHour: g.comments.safePerHour,
      commentsPerDay: g.comments.safePerDay,
      minIntervalMin: Math.round(g.comments.minIntervalSec / 60),
      newAccountPerDay: g.comments.newAccountPerDay,
      publishesPerDay: g.publishes.safePerDay,
      summary: describePlatformLimits(g.platform),
      notes: g.notes,
    })),
  };
}

export async function checkUsageAlerts() {
  const status = await listRateLimitStatus();
  const alerts: string[] = [];

  if (status.workspace.sendsStatus !== "ok") {
    alerts.push(`Sends at ${status.workspace.sendsPct}% (${status.workspace.sendsUsed}/${status.workspace.sendLimit})`);
  }
  if (status.workspace.publishesStatus !== "ok") {
    alerts.push(`Publishes at ${status.workspace.publishesPct}% (${status.workspace.publishesUsed}/${status.workspace.publishLimit})`);
  }
  if (status.throttledCount > 0) {
    alerts.push(`${status.throttledCount} account(s) at daily limit`);
  }

  return alerts;
}
