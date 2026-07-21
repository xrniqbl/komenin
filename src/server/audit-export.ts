"use server";

import { assertWorkspacePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

export async function exportAuditLogsCsv(limit = 1000) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "audit.export");

  const rows = await db.auditLog.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 5000),
  });

  const header = [
    "id",
    "createdAt",
    "actorUserId",
    "action",
    "resourceType",
    "resourceId",
    "ip",
    "metadata",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.createdAt.toISOString(),
        row.actorUserId || "",
        row.action,
        row.resourceType,
        row.resourceId || "",
        row.ip || "",
        JSON.stringify(row.metadata ?? {}),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "audit.exported",
    resourceType: "audit_log",
    resourceId: workspace.id,
    metadata: { count: rows.length },
  });

  return {
    filename: `aether-audit-${workspace.slug}-${Date.now()}.csv`,
    csv: lines.join("\n"),
    count: rows.length,
  };
}
