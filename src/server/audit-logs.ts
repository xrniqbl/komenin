"use server";

import { assertCan } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";

export async function listAuditLogs(limit = 100) {
  const { workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "audit.view");

  return db.auditLog.findMany({
    where: { workspaceId: workspace.id },
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