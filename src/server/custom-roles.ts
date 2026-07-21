"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission, PERMISSION_DEFINITIONS, type Permission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

const VALID_PERMISSIONS = new Set((PERMISSION_DEFINITIONS || []).map((d) => d.key));

export async function listCustomRoles() {
  const { workspace } = await requireActiveWorkspace();
  return db.customRole.findMany({
    where: { workspaceId: workspace.id },
    include: { _count: { select: { memberships: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSystemRoles() {
  const { ROLE_PERMISSIONS } = await import("@/lib/rbac");
  return Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => ({
    role,
    permissions: perms,
    isSystem: true,
  }));
}

export async function createCustomRole(input: {
  name: string;
  description?: string;
  permissions: string[];
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const name = input.name.trim();
  if (!name) throw new Error("Role name required");
  if (name.length > 60) throw new Error("Name too long");
  if (!input.permissions || input.permissions.length === 0) throw new Error("At least one permission required");

  const perms = input.permissions.filter((p) => VALID_PERMISSIONS.has(p as Permission));
  if (perms.length === 0) throw new Error("No valid permissions");

  const slug = slugify(name);
  const existing = await db.customRole.findFirst({
    where: { workspaceId: workspace.id, slug },
  });
  if (existing) throw new Error("Role with similar name already exists");

  const role = await db.customRole.create({
    data: {
      workspaceId: workspace.id,
      name,
      slug,
      description: input.description?.trim() || null,
      permissions: perms,
      isSystem: false,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "custom_role.created",
    resourceType: "custom_role",
    resourceId: role.id,
    metadata: { name, permissions: perms },
  });

  revalidatePath("/app/settings/roles");
  return role;
}

export async function updateCustomRole(
  id: string,
  input: { name?: string; description?: string; permissions?: string[] },
) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const existing = await db.customRole.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Role not found");
  if (existing.isSystem) throw new Error("Cannot edit system role");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new Error("Name required");
    data.name = n;
    data.slug = slugify(n);
  }
  if (input.description !== undefined) data.description = input.description.trim() || null;
  if (input.permissions !== undefined) {
    const perms = input.permissions.filter((p) => VALID_PERMISSIONS.has(p as Permission));
    if (perms.length === 0) throw new Error("No valid permissions");
    data.permissions = perms;
  }

  const updated = await db.customRole.update({ where: { id }, data });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "custom_role.updated",
    resourceType: "custom_role",
    resourceId: id,
  });

  revalidatePath("/app/settings/roles");
  revalidatePath(`/app/settings/roles/${id}`);
  return updated;
}

export async function deleteCustomRole(id: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const existing = await db.customRole.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Role not found");
  if (existing.isSystem) throw new Error("Cannot delete system role");

  // Check if any membership uses it
  const count = await db.membership.count({ where: { customRoleId: id, workspaceId: workspace.id } });
  if (count > 0) throw new Error(`Cannot delete — ${count} member(s) still use this role`);

  await db.customRole.delete({ where: { id } });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "custom_role.deleted",
    resourceType: "custom_role",
    resourceId: id,
  });

  revalidatePath("/app/settings/roles");
  return { ok: true };
}
