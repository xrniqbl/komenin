import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { appendPublishDelivery, type PublishDeliveryLog } from "@/lib/publish-delivery-log";

/**
 * Publish delivery persistence.
 *
 * The database (`DeliveryLog`, kind `publish_webhook`) is the source of
 * truth: serverless filesystems are read-only/ephemeral, so the JSONL file
 * is only a best-effort local mirror for development.
 */

export type PublishDeliveryInput = {
  workspaceId?: string | null;
  platform: string;
  username?: string | null;
  accountId?: string | null;
  title?: string | null;
  body: string;
  hashtags: string[];
  caption: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  sourceIp?: string | null;
  userAgent?: string | null;
};

/** Resolve the workspace (and real social account id) from a delivery payload. */
export async function resolveDeliveryScope(input: PublishDeliveryInput): Promise<{
  workspaceId: string | null;
  socialAccountId: string | null;
}> {
  // 1) Explicit workspaceId from the sender, if it exists.
  if (input.workspaceId) {
    const workspace = await db.workspace.findFirst({
      where: { id: input.workspaceId.slice(0, 64) },
      select: { id: true },
    });
    if (workspace) return { workspaceId: workspace.id, socialAccountId: null };
  }

  // 2) Map the social account by internal id or external id / username.
  const account = await db.socialAccount.findFirst({
    where: {
      deletedAt: null,
      OR: [
        ...(input.accountId
          ? [{ id: input.accountId.slice(0, 64) }, { externalId: input.accountId.slice(0, 190) }]
          : []),
        ...(input.username ? [{ username: input.username.slice(0, 190) }] : []),
      ],
    },
    select: { id: true, workspaceId: true },
  });
  if (account) {
    return { workspaceId: account.workspaceId, socialAccountId: account.id };
  }

  return { workspaceId: null, socialAccountId: null };
}

export async function recordPublishDelivery(input: PublishDeliveryInput): Promise<{
  id: string;
  ok: boolean;
}> {
  const scope = await resolveDeliveryScope(input);

  const payload = {
    platform: input.platform,
    username: input.username ?? null,
    accountId: input.accountId ?? null,
    title: input.title ?? null,
    body: input.body.slice(0, 10000),
    hashtags: input.hashtags,
    caption: input.caption.slice(0, 10000),
    scheduledFor: input.scheduledFor ?? null,
    publishedAt: input.publishedAt ?? null,
    sourceIp: input.sourceIp ?? null,
    userAgent: input.userAgent ?? null,
  } satisfies Record<string, unknown>;

  const row = await db.deliveryLog.create({
    data: {
      workspaceId: scope.workspaceId,
      socialAccountId: scope.socialAccountId,
      kind: "publish_webhook",
      connector: "webhook",
      mode: "live",
      ok: true,
      externalId: null,
      message: `Publish delivery received for ${input.platform}`,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  // Best-effort local JSONL mirror for development environments.
  try {
    await appendPublishDelivery({
      workspaceId: scope.workspaceId,
      platform: input.platform,
      username: input.username ?? null,
      accountId: scope.socialAccountId ?? input.accountId ?? null,
      title: input.title ?? null,
      body: payload.body,
      hashtags: input.hashtags,
      caption: payload.caption,
      scheduledFor: input.scheduledFor ?? null,
      publishedAt: input.publishedAt ?? null,
      sourceIp: input.sourceIp ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch {
    // Non-fatal: the DB row is the source of truth.
  }

  return { id: row.id, ok: true };
}

export async function listPublishDeliveriesFromDb(
  limit = 30,
  workspaceId?: string | null,
): Promise<PublishDeliveryLog[]> {
  const rows = await db.deliveryLog.findMany({
    where: {
      kind: "publish_webhook",
      ...(workspaceId ? { workspaceId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });

  return rows.map((row) => {
    const payload = (row.payload ?? {}) as Partial<PublishDeliveryInput>;
    return {
      id: row.id,
      receivedAt: row.createdAt.toISOString(),
      workspaceId: row.workspaceId ?? null,
      platform: String(payload.platform || "unknown"),
      username: payload.username ?? null,
      accountId: row.socialAccountId ?? payload.accountId ?? null,
      title: payload.title ?? null,
      body: String(payload.body || ""),
      hashtags: Array.isArray(payload.hashtags) ? payload.hashtags : [],
      caption: String(payload.caption || payload.body || ""),
      scheduledFor: payload.scheduledFor ?? null,
      publishedAt: payload.publishedAt ?? null,
      externalPostId: row.externalId || `db_${row.id}`,
      sourceIp: payload.sourceIp ?? null,
      userAgent: payload.userAgent ?? null,
    };
  });
}
