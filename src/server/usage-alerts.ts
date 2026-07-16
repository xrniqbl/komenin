"use server";

import { db } from "@/lib/db";
import { listRateLimitStatus } from "./rate-limits";

export async function checkUsageAlerts(): Promise<string[]> {
  try {
    const status = await listRateLimitStatus();
    const alerts: string[] = [];

    if (status.workspace.sendsStatus === "warning") {
      alerts.push(`Sends at ${status.workspace.sendsPct}% — ${status.workspace.sendsUsed}/${status.workspace.sendLimit}`);
    } else if (status.workspace.sendsStatus === "critical") {
      alerts.push(`Sends limit reached ${status.workspace.sendsPct}% — ${status.workspace.sendsUsed}/${status.workspace.sendLimit} — publishing paused until next period`);
    }

    if (status.workspace.publishesStatus === "warning") {
      alerts.push(`Publishes at ${status.workspace.publishesPct}% — ${status.workspace.publishesUsed}/${status.workspace.publishLimit}`);
    } else if (status.workspace.publishesStatus === "critical") {
      alerts.push(`Publish limit reached ${status.workspace.publishesPct}% — ${status.workspace.publishesUsed}/${status.workspace.publishLimit}`);
    }

    if (status.throttledCount > 0) {
      alerts.push(`${status.throttledCount} account(s) throttled — daily quota exceeded`);
    }

    return alerts;
  } catch {
    return [];
  }
}

export async function createUsageAlertNotifications() {
  try {
    const { requireActiveWorkspace } = await import("./active-workspace");
    // This is called from worker job — skip for now as it needs workspace. Instead use listRateLimitStatus directly in worker.
    return;
  } catch {
    return;
  }
}

export async function dispatchUsageWarningsForAllWorkspaces() {
  const periodKey = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;

  const workspaces = await db.workspace.findMany({
    where: { status: "active" },
    select: { id: true, monthlySendLimit: true, monthlyPublishLimit: true },
  });

  for (const ws of workspaces) {
    const counter = await db.usageCounter.findUnique({
      where: { workspaceId_periodKey: { workspaceId: ws.id, periodKey } },
    });
    if (!counter) continue;

    const sendsPct = ws.monthlySendLimit > 0 ? Math.round((counter.sends / ws.monthlySendLimit) * 100) : 0;
    const pubPct = ws.monthlyPublishLimit > 0 ? Math.round((counter.publishes / ws.monthlyPublishLimit) * 100) : 0;

    // Dedup: check if already alerted today for same threshold
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (sendsPct >= 80) {
      const exists = await db.notification.findFirst({
        where: {
          workspaceId: ws.id,
          title: { contains: "Usage warning" },
          body: { contains: "sends" },
          createdAt: { gte: todayStart },
        },
      });
      if (!exists) {
        await db.notification.create({
          data: {
            workspaceId: ws.id,
            title: `Usage warning: ${sendsPct}% of monthly sends used`,
            body: `${counter.sends}/${ws.monthlySendLimit} sends used — consider upgrading plan or pausing low-priority campaigns.`,
            href: "/app/analytics",
          },
        });
      }
    }

    if (pubPct >= 80) {
      const exists = await db.notification.findFirst({
        where: {
          workspaceId: ws.id,
          title: { contains: "Usage warning" },
          body: { contains: "publishes" },
          createdAt: { gte: todayStart },
        },
      });
      if (!exists) {
        await db.notification.create({
          data: {
            workspaceId: ws.id,
            title: `Usage warning: ${pubPct}% of monthly publishes used`,
            body: `${counter.publishes}/${ws.monthlyPublishLimit} publishes used — auto-publish will pause when limit reached.`,
            href: "/app/analytics",
          },
        });
      }
    }
  }
}
