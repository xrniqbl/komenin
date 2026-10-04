/**
 * Daily approval digest email
 *
 * Aggregates pending review work per workspace (comment approvals +
 * content drafts awaiting review) and emails the members who can act on
 * them. Sent once per day per workspace — the digest marker row prevents
 * duplicates when the cron overlaps or retries.
 */

import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { writeAuditLog } from "@/server/audit";

const DIGEST_HOUR_UTC = 1; // 08:00 WIB (UTC+7)

type DigestTarget = {
  workspaceId: string;
  workspaceName: string;
  pendingApprovals: number;
  pendingDrafts: number;
  oldestPendingAt: Date | null;
  recipients: { email: string; userId: string }[];
};

/** True when the current UTC time has passed today's digest slot. */
function digestSlotReached(now = new Date()): boolean {
  return now.getUTCHours() >= DIGEST_HOUR_UTC;
}

/** Key for the once-per-day marker: YYYY-MM-DD (UTC). */
function digestDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

async function collectDigestTargets(): Promise<DigestTarget[]> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [pendingApprovals, pendingDrafts] = await Promise.all([
    db.approval.groupBy({
      by: ["workspaceId"],
      where: { status: "pending", createdAt: { gte: dayAgo } },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
    db.contentDraft.groupBy({
      by: ["workspaceId"],
      where: { status: "pending", createdAt: { gte: dayAgo } },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
  ]);

  const byWorkspace = new Map<
    string,
    { approvals: number; drafts: number; oldest: Date | null }
  >();
  const bump = (
    workspaceId: string,
    field: "approvals" | "drafts",
    count: number,
    oldest: Date | null,
  ) => {
    const entry =
      byWorkspace.get(workspaceId) || { approvals: 0, drafts: 0, oldest: null };
    entry[field] = count;
    if (oldest && (!entry.oldest || oldest < entry.oldest)) entry.oldest = oldest;
    byWorkspace.set(workspaceId, entry);
  };

  for (const row of pendingApprovals) {
    bump(row.workspaceId, "approvals", row._count._all, row._min.createdAt);
  }
  for (const row of pendingDrafts) {
    bump(row.workspaceId, "drafts", row._count._all, row._min.createdAt);
  }

  if (byWorkspace.size === 0) return [];

  // Recipients: active members with campaigns.manage (the approval actors)
  const memberships = await db.membership.findMany({
    where: {
      workspaceId: { in: Array.from(byWorkspace.keys()) },
      status: "active",
    },
    include: {
      user: { select: { id: true, email: true } },
      workspace: { select: { id: true, name: true } },
      customRole: { select: { permissions: true } },
    },
  });

  const targets = new Map<string, DigestTarget>();
  for (const membership of memberships) {
    // Owner/admin/operator roles hold campaigns.manage; custom roles carry it
    // in their permission list. Skip everyone else.
    const permissions = membership.customRole?.permissions ?? [];
    const canManage =
      ["owner", "admin", "operator"].includes(membership.role) ||
      permissions.includes("campaigns.manage");
    if (!canManage || !membership.user.email) continue;

    const entry =
      targets.get(membership.workspaceId) ||
      ({
        workspaceId: membership.workspaceId,
        workspaceName: membership.workspace.name,
        pendingApprovals: byWorkspace.get(membership.workspaceId)?.approvals ?? 0,
        pendingDrafts: byWorkspace.get(membership.workspaceId)?.drafts ?? 0,
        oldestPendingAt: byWorkspace.get(membership.workspaceId)?.oldest ?? null,
        recipients: [],
      } satisfies DigestTarget);
    entry.recipients.push({
      email: membership.user.email,
      userId: membership.user.id,
    });
    targets.set(membership.workspaceId, entry);
  }

  return Array.from(targets.values()).filter(
    (target) => target.pendingApprovals + target.pendingDrafts > 0,
  );
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

function buildDigestEmail(target: DigestTarget): { subject: string; html: string; text: string } {
  const total = target.pendingApprovals + target.pendingDrafts;
  const subject = `[Komenin] ${total} item menunggu review di ${target.workspaceName}`;

  const approvalsRow =
    target.pendingApprovals > 0
      ? `<tr>
           <td style="padding:8px 12px;">Comment approvals</td>
           <td style="padding:8px 12px;font-weight:600;">${target.pendingApprovals}</td>
         </tr>`
      : "";
  const draftsRow =
    target.pendingDrafts > 0
      ? `<tr>
           <td style="padding:8px 12px;">Content drafts</td>
           <td style="padding:8px 12px;font-weight:600;">${target.pendingDrafts}</td>
         </tr>`
      : "";

  const oldestNote = target.oldestPendingAt
    ? `<p style="color:#6b7280;font-size:13px;">Item tertua menunggu sejak ${target.oldestPendingAt.toISOString().slice(0, 16).replace("T", " ")} UTC.</p>`
    : "";

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="color:#0b0f14;">${escapeHtml(target.workspaceName)}: ${total} item menunggu review</h2>
    <table style="border-collapse:collapse;width:100%;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;font-size:13px;color:#374151;">Jenis</th>
          <th style="padding:8px 12px;text-align:right;font-size:13px;color:#374151;">Jumlah</th>
        </tr>
      </thead>
      <tbody>
        ${approvalsRow}
        ${draftsRow}
      </tbody>
    </table>
    ${oldestNote}
    <p style="margin:24px 0;">
      <a href="${appUrl()}/app/approvals"
         style="background:#0b0f14;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Buka antrean approval
      </a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="color:#9ca3af;font-size:12px;">
      Email digest harian dari Komenin. Anda menerima ini karena memiliki akses approval di workspace ini.
    </p>
  </div>`;

  const text =
    `${target.workspaceName}: ${total} item menunggu review.\n\n` +
    (target.pendingApprovals ? `- Comment approvals: ${target.pendingApprovals}\n` : "") +
    (target.pendingDrafts ? `- Content drafts: ${target.pendingDrafts}\n` : "") +
    `\nBuka antrean: ${appUrl()}/app/approvals\n\n` +
    `Email digest harian dari Komenin.`;

  return { subject, html, text };
}

/**
 * Send the daily approval digest. Returns counts for the worker audit log.
 * Safe to run repeatedly: workspaces already digested today are skipped.
 */
export async function sendDailyApprovalDigest(now = new Date()): Promise<{
  sent: number;
  skipped: number;
  errors: number;
}> {
  if (!process.env.BREVO_API_KEY?.trim()) {
    return { sent: 0, skipped: 0, errors: 0 }; // email not configured — no-op
  }
  if (!digestSlotReached(now)) {
    return { sent: 0, skipped: 0, errors: 0 }; // before today's slot
  }

  const dayKey = digestDayKey(now);
  const targets = await collectDigestTargets();

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const target of targets) {
    // Once-per-day marker keyed to workspace + UTC day + kind. The unique
    // constraint on the marker makes the cron overlap-safe.
    try {
      const marker = await db.$transaction(async (tx) => {
        const existing = await tx.digestMarker.findUnique({
          where: {
            workspaceId_dayKey_kind: {
              workspaceId: target.workspaceId,
              dayKey,
              kind: "approval_digest",
            },
          },
          select: { id: true },
        });
        if (existing) return null;
        return tx.digestMarker.create({
          data: { workspaceId: target.workspaceId, dayKey, kind: "approval_digest" },
        });
      });
      if (!marker) {
        skipped += 1;
        continue;
      }
    } catch {
      // Marker table missing or race lost — skip rather than double-send
      skipped += 1;
      continue;
    }

    const email = buildDigestEmail(target);
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
        action: "digest.approval_sent",
        resourceType: "digest",
        resourceId: `${target.workspaceId}:${dayKey}`,
        metadata: {
          recipients: target.recipients.length,
          pendingApprovals: target.pendingApprovals,
          pendingDrafts: target.pendingDrafts,
        },
      }).catch(() => undefined);
    } else {
      errors += 1;
    }
  }

  return { sent, skipped, errors };
}
