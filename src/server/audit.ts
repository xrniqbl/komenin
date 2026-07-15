import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export async function writeAuditLog(input: {
  workspaceId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  ip?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return db.auditLog.create({
    data: {
      workspaceId: input.workspaceId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      ip: input.ip,
      metadata: input.metadata,
    },
  });
}