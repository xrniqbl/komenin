"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { slugifyWorkspaceName } from "@/lib/workspace";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

export async function listClients() {
  const { workspace } = await requireActiveWorkspace();
  return db.clientProfile.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: { select: { leads: true, campaigns: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createClient(input: { name: string; notes?: string }) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const name = input.name.trim();
  if (name.length < 2) throw new Error("Client name is required");

  const base = slugifyWorkspaceName(name) || "client";
  let slug = base;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const exists = await db.clientProfile.findFirst({
      where: { workspaceId: workspace.id, slug },
      select: { id: true },
    });
    if (!exists) break;
  }

  const client = await db.clientProfile.create({
    data: {
      workspaceId: workspace.id,
      name,
      slug,
      notes: input.notes?.trim() || null,
      isActive: true,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "client.created",
    resourceType: "client_profile",
    resourceId: client.id,
    metadata: { name: client.name, slug: client.slug },
  });

  revalidatePath("/app/clients");
  revalidatePath("/app/settings/general");
  return client;
}

export async function updateClient(input: {
  clientId: string;
  name?: string;
  notes?: string;
  isActive?: boolean;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const existing = await db.clientProfile.findFirst({
    where: { id: input.clientId, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Client not found");

  const client = await db.clientProfile.update({
    where: { id: existing.id },
    data: {
      name: input.name?.trim() || existing.name,
      notes: input.notes !== undefined ? input.notes.trim() || null : existing.notes,
      isActive: input.isActive ?? existing.isActive,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "client.updated",
    resourceType: "client_profile",
    resourceId: client.id,
    metadata: { name: client.name, isActive: client.isActive },
  });

  revalidatePath("/app/clients");
  return client;
}

export async function updateAgencyLabel(input: { agencyLabel: string }) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const label = input.agencyLabel.trim();
  await db.workspace.update({
    where: { id: workspace.id },
    data: { agencyLabel: label || null },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "workspace.agency_label_updated",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: { agencyLabel: label || null },
  });

  revalidatePath("/app");
  revalidatePath("/app/settings/general");
  revalidatePath("/app/clients");
}
