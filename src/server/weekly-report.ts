/**
 * Weekly workspace report email
 *
 * Every Monday after 01:00 UTC: one email per active workspace summarizing the
 * last 7 days (comment sends, failures, publishes, approvals flow, leads, AI
 * credits). Reuses the analytics queries (bounded) and the DigestMarker table
 * with kind="weekly_report" + ISO-week day keys so overlapping crons cannot
 * double-send. No-op when BREVO_API_KEY is unset or before the Monday slot.
 */

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { writeAuditLog } from "@/server/audit";

const REPORT_WEEKDAY_UTC = 1; // Monday
const REPORT_HOUR_UTC = 1; // 08:00 WIB (UTC+7), same slot as the daily digest
const MARKER_KIND = "weekly_report";

type ReportTarget = {
  workspaceId: string;
  workspaceName: string;
  sends: number;
  failedSends: number;
  publishes: number;
  approvalsDecided: number;
  approvalsPending: number;
  leadsNew: number;
  leadsWon: number;
  aiCalls: number;
  aiCredits: string;
  recipients: { email: string; userId: string }[];
};

function isoWeekKey(now = new Date()): string {
  // ISO week key YYYY-Www for the week containing `now` (UTC).
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function reportSlotReached(now = new Date()): boolean {
  return now.getUTCDay() === REPORT_WEEKDAY_UTC && now.getUTCHours() >= REPORT_HOUR_UTC;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function collectReportTargets(since: Date): Promise<ReportTarget[]> {
  const workspaces = await db.workspace.findMany({
    where: { status: "active" },
    select: { id: true, name: true },
  });
  if (workspaces.length === 0) return [];

  const targets: ReportTarget[] = [];
  for (const ws of workspaces) {
    const [
      sends,
      failedSends,
      publishes,
      approvalsDecided,
      approvalsPending,
      leadsNew,
      leadsWon,
      aiEvents,
      memberships,
    ] = await Promise.all([
      db.commentAction.count({
        where: { workspaceId: ws.id, status: "sent", createdAt: { gte: since } },
      }),
      db.commentAction.count({
        where: { workspaceId: ws.id, status: "failed", createdAt: { gte: since } },
      }),
      db.contentDraft.count({
        where: { workspaceId: ws.id, status: "published", publishedAt: { gte: since } },
      }),
      db.approval.count({
        where: {
          workspaceId: ws.id,
          status: { in: ["approved", "rejected"] },
          createdAt: { gte: since },
        },
      }),
      db.approval.count({ where: { workspaceId: ws.id, status: "pending" } }),
      db.engagementLead.count({
        where: { workspaceId: ws.id, createdAt: { gte: since } },
      }),
      db.engagementLead.count({
        where: { workspaceId: ws.id, status: "won", updatedAt: { gte: since } },
      }),
      db.aiUsageEvent.findMany({
        where: { workspaceId: ws.id, createdAt: { gte: since } },
        select: { creditsUsed: true },
      }),
      db.membership.findMany({
        where: { workspaceId: ws.id, status: "active" },
        include: {
          user: { select: { id: true, email: true } },
          customRole: { select: { permissions: true } },
        },
      }),
    ]);

    // Skip quiet workspaces — no activity and nothing pending means no email.
    const activity =
      sends + failedSends + publishes + approvalsDecided + leadsNew + leadsWon + aiEvents.length;
    if (activity === 0 && approvalsPending === 0) continue;

    const recipients = memberships
      .filter((m) => {
        const permissions = m.customRole?.permissions ?? [];
        return (
          ["owner", "admin", "operator"].includes(m.role) ||
          permissions.includes("analytics.view") ||
          permissions.includes("campaigns.manage")
        );
      })
      .filter((m) => m.user.email)
      .map((m) => ({ email: m.user.email as string, userId: m.user.id }));
    if (recipients.length === 0) continue;

    const aiCredits = aiEvents.reduce((sum, e) => sum + e.creditsUsed, 0n).toString();

    targets.push({
      workspaceId: ws.id,
      workspaceName: ws.name,
      sends,
      failedSends,
      publishes,
      approvalsDecided,
      approvalsPending,
      leadsNew,
      leadsWon,
      aiCalls: aiEvents.length,
      aiCredits,
      recipients,
    });
  }
  return targets;
}

function buildReportEmail(target: ReportTarget): { subject: string; html: string; text: string } {
  const subject = `[Komenin] Laporan mingguan ${target.workspaceName}: ${target.sends} komentar, ${target.publishes} postingan`;
  const rows: Array<[string, string]> = [
    ["Komentar terkirim", String(target.sends)],
    ["Komentar gagal", String(target.failedSends)],
    ["Postingan terbit", String(target.publishes)],
    ["Approval diputuskan", String(target.approvalsDecided)],
    ["Approval menunggu", String(target.approvalsPending)],
    ["Leads baru", String(target.leadsNew)],
    ["Leads won", String(target.leadsWon)],
    [
      "Panggilan AI",
      `${target.aiCalls} · ${new Intl.NumberFormat("id-ID").format(Number(target.aiCredits))} kredit`,
    ],
  ];
  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;">${escapeHtml(label)}</td><td style="padding:8px 12px;font-weight:600;text-align:right;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const textRows = rows.map(([label, value]) => `- ${label}: ${value}`).join("\n");

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="color:#0b0f14;">${escapeHtml(target.workspaceName)}: ringkasan 7 hari</h2>
    <table style="border-collapse:collapse;width:100%;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;font-size:13px;color:#374151;">Metrik</th>
        <th style="padding:8px 12px;text-align:right;font-size:13px;color:#374151;">7 hari</th>
      </tr></thead>
      <tbody>${htmlRows}</tbody>
    </table>
    <p style="margin:24px 0;">
      <a href="${appUrl()}/app/analytics"
         style="background:#0b0f14;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Buka analytics
      </a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="color:#9ca3af;font-size:12px;">Laporan mingguan otomatis dari Komenin (Senin 08:00 WIB).</p>
  </div>`;

  const text =
    `${target.workspaceName}: ringkasan 7 hari.\n\n${textRows}\n\nBuka analytics: ${appUrl()}/app/analytics\n\nLaporan mingguan otomatis dari Komenin.`;

  return { subject, html, text };
}

/**
 * Send the Monday weekly report. Safe to run repeatedly: workspaces already
 * reported for this ISO week are skipped via DigestMarker.
 */
export async function sendWeeklyReport(now = new Date()): Promise<{
  sent: number;
  skipped: number;
  errors: number;
}> {
  if (!process.env.BREVO_API_KEY?.trim()) {
    return { sent: 0, skipped: 0, errors: 0 };
  }
  if (!reportSlotReached(now)) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const weekKey = isoWeekKey(now);
  const since = new Date(now.getTime() - 7 * 86400000);
  const targets = await collectReportTargets(since);

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const target of targets) {
    try {
      const marker = await db.$transaction(async (tx) => {
        const existing = await tx.digestMarker.findFirst({
          where: {
            workspaceId: target.workspaceId,
            dayKey: weekKey,
            kind: MARKER_KIND,
          },
          select: { id: true },
        });
        if (existing) return null;
        try {
          return await tx.digestMarker.create({
            data: { workspaceId: target.workspaceId, dayKey: weekKey, kind: MARKER_KIND },
          });
        } catch {
          return null; // lost a race — treat as already sent
        }
      });
      if (!marker) {
        skipped += 1;
        continue;
      }
    } catch {
      skipped += 1;
      continue;
    }

    const email = buildReportEmail(target);
    let delivered = false;
    for (const recipient of target.recipients) {
      const result = await sendEmail({
        to: recipient.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (result.delivered) delivered = true;
    }

    if (delivered) {
      sent += 1;
      await writeAuditLog({
        workspaceId: target.workspaceId,
        action: "report.weekly_sent",
        resourceType: "report",
        resourceId: `${target.workspaceId}:${weekKey}`,
        metadata: {
          recipients: target.recipients.length,
          sends: target.sends,
          publishes: target.publishes,
          leadsNew: target.leadsNew,
        },
      }).catch(() => undefined);
    } else {
      errors += 1;
    }
  }

  return { sent, skipped, errors };
}
