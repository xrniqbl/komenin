"use server";

import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

export async function listRiskRules() {
  const { workspace } = await requireActiveWorkspace();
  return db.riskRule.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function createRiskRule(input: {
  type?: string;
  pattern: string;
  severity?: string;
  agentId?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "settings.manage");

  const pattern = input.pattern.trim();
  if (!pattern) throw new Error("Pattern is required");
  if (pattern.length > 2000) throw new Error("Pattern too long");

  const rule = await db.riskRule.create({
    data: {
      workspaceId: workspace.id,
      agentId: input.agentId || null,
      type: input.type || "banned_phrase",
      pattern,
      severity: input.severity || "medium",
      isActive: true,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "risk_rule.created",
    resourceType: "risk_rule",
    resourceId: rule.id,
    metadata: { type: rule.type, severity: rule.severity },
  });

  revalidatePath("/app/settings/risk-rules");
  revalidatePath("/app/settings/ai");
  return rule;
}

export async function updateRiskRule(
  id: string,
  data: { pattern?: string; severity?: string; isActive?: boolean; type?: string },
) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "settings.manage");

  const existing = await db.riskRule.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Risk rule not found");

  const updated = await db.riskRule.update({
    where: { id },
    data: {
      ...(data.pattern ? { pattern: data.pattern.trim() } : {}),
      ...(data.severity ? { severity: data.severity } : {}),
      ...(data.type ? { type: data.type } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "risk_rule.updated",
    resourceType: "risk_rule",
    resourceId: id,
  });

  revalidatePath("/app/settings/risk-rules");
  revalidatePath("/app/settings/ai");
  return updated;
}

export async function deleteRiskRule(id: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "settings.manage");

  const existing = await db.riskRule.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Risk rule not found");

  await db.riskRule.delete({ where: { id } });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "risk_rule.deleted",
    resourceType: "risk_rule",
    resourceId: id,
  });

  revalidatePath("/app/settings/risk-rules");
  revalidatePath("/app/settings/ai");
  return { ok: true };
}
