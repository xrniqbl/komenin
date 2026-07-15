"use server";

import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";
import { writeAuditLog } from "@/server/audit";

export async function listAgents() {
  const { workspace } = await requireActiveWorkspace();
  return db.agent.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function ensureDefaultAgent() {
  const { userId, workspace } = await requireActiveWorkspace();
  const existing = await db.agent.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const agent = await db.agent.create({
    data: {
      workspaceId: workspace.id,
      name: "Sales Assist",
      tone: "professional",
      language: "id",
      systemPrompt:
        "Kamu asisten engagement brand. Tulis komentar relevan, sopan, dan tidak spam.",
      status: "active",
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "agent.created_default",
    resourceType: "agent",
    resourceId: agent.id,
  });

  revalidatePath("/app/agents");
  return agent;
}
