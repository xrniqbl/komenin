"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { parseVariables } from "@/lib/template-engine";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

export async function listCommentTemplates(input?: {
  q?: string;
  category?: string;
  isActive?: boolean;
}) {
  const { workspace } = await requireActiveWorkspace();
  const where: Record<string, unknown> & { workspaceId: string } = {
    workspaceId: workspace.id,
  };
  if (input?.q) {
    where.OR = [
      { name: { contains: input.q, mode: "insensitive" as const } },
      { body: { contains: input.q, mode: "insensitive" as const } },
    ];
  }
  if (input?.category) where.category = input.category;
  if (input?.isActive !== undefined) where.isActive = input.isActive;

  return db.commentTemplate.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCommentTemplate(id: string) {
  const { workspace } = await requireActiveWorkspace();
  return db.commentTemplate.findFirst({
    where: { id, workspaceId: workspace.id },
  });
}

export async function createCommentTemplate(input: {
  name: string;
  body: string;
  category?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const name = input.name.trim();
  const body = input.body.trim();
  if (!name) throw new Error("Template name required");
  if (!body) throw new Error("Template body required");
  if (name.length > 120) throw new Error("Name too long (max 120)");
  if (body.length > 5000) throw new Error("Body too long (max 5000)");

  const variables = parseVariables(body);

  const template = await db.commentTemplate.create({
    data: {
      workspaceId: workspace.id,
      name,
      body,
      category: input.category || "general",
      variables,
      isActive: true,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "template.created",
    resourceType: "comment_template",
    resourceId: template.id,
    metadata: { name, category: template.category },
  });

  revalidatePath("/app/templates");
  return template;
}

export async function updateCommentTemplate(
  id: string,
  input: { name?: string; body?: string; category?: string; isActive?: boolean },
) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const existing = await db.commentTemplate.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Template not found");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new Error("Name required");
    data.name = n;
  }
  if (input.body !== undefined) {
    const b = input.body.trim();
    if (!b) throw new Error("Body required");
    data.body = b;
    data.variables = parseVariables(b);
  }
  if (input.category !== undefined) data.category = input.category;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const updated = await db.commentTemplate.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "template.updated",
    resourceType: "comment_template",
    resourceId: id,
  });

  revalidatePath("/app/templates");
  revalidatePath(`/app/templates/${id}`);
  return updated;
}

export async function deleteCommentTemplate(id: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const existing = await db.commentTemplate.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Template not found");

  await db.commentTemplate.delete({ where: { id } });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "template.deleted",
    resourceType: "comment_template",
    resourceId: id,
  });

  revalidatePath("/app/templates");
  return { ok: true };
}

export async function incrementTemplateUsage(id: string) {
  const { workspace } = await requireActiveWorkspace();
  await db.commentTemplate.updateMany({
    where: { id, workspaceId: workspace.id },
    data: { usageCount: { increment: 1 } },
  });
}
