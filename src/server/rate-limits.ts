"use server";

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

  const accountStatuses = accounts.map((acc) => {
    const pct = getQuotaPercent(acc.actionsToday, acc.dailyQuota);
    const status = getThresholdStatus(acc.actionsToday, acc.dailyQuota);
    return {
      ...acc,
      pct,
      status,
      throttled: acc.actionsToday >= acc.dailyQuota || acc.status === "limited",
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
