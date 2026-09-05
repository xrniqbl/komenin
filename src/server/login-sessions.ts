"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/server/audit";

async function requireUserId(): Promise<{ userId: string; jti?: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return { userId: session.user.id, jti: session.currentJti };
}

export type LoginDevice = {
  id: string;
  provider: string | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  current: boolean;
};

export async function listLoginDevices(): Promise<LoginDevice[]> {
  const { userId, jti } = await requireUserId();
  const rows = await db.loginSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    take: 30,
  });
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    userAgent: row.userAgent,
    ip: row.ip,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    current: row.jti === jti,
  }));
}

/** Revoke one device by row id — rows are always scoped to the caller. */
export async function revokeLoginDevice(id: string): Promise<{ ok: boolean }> {
  const { userId } = await requireUserId();
  const result = await db.loginSession.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count > 0) {
    await writeAuditLog({
      actorUserId: userId,
      action: "user.device.revoked",
      resourceType: "login_session",
      resourceId: id,
    });
  }
  return { ok: result.count > 0 };
}

/** Sign out everywhere except the current device. */
export async function revokeOtherLoginDevices(): Promise<{ count: number }> {
  const { userId, jti } = await requireUserId();
  const result = await db.loginSession.updateMany({
    where: { userId, revokedAt: null, ...(jti ? { jti: { not: jti } } : {}) },
    data: { revokedAt: new Date() },
  });
  if (result.count > 0) {
    await writeAuditLog({
      actorUserId: userId,
      action: "user.device.revoke_others",
      resourceType: "login_session",
    });
  }
  return { count: result.count };
}
