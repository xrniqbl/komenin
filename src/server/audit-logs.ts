"use server";

import { assertCan } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";

export async function listAuditLogs(input?: { q?: string; action?: string; limit?: number }) {
  const { workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "audit.view");

  const limit = input?.limit ?? 100;
  const where: Record<string, unknown> & { workspaceId: string } = {
    workspaceId: workspace.id,
  };
  if (input?.q) {
    where.OR = [
      { action: { contains: input.q, mode: "insensitive" as const } },
      { resourceType: { contains: input.q, mode: "insensitive" as const } },
    ];
  }
  if (input?.action) {
    where.action = { contains: input.action, mode: "insensitive" as const };
  }

  return db.auditLog.findMany({
    where,
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
}