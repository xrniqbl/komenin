"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { SCOPES, generateApiKey, isValidScope } from "@/lib/api-keys";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

export async function listApiKeys() {
  const { workspace } = await requireActiveWorkspace();
  // Never return hashedKey to the client — it is a password-equivalent verifier.
  return db.apiKey.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      isActive: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      createdBy: true,
    },
  });
}

export async function createApiKey(input: {
  name: string;
  scopes: string[];
  expiresAt?: string | null;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const name = input.name.trim();
  if (!name) throw new Error("Name required");
  if (name.length > 80) throw new Error("Name too long");
  if (!input.scopes || input.scopes.length === 0) throw new Error("At least one scope required");

  for (const s of input.scopes) {
    if (!isValidScope(s)) throw new Error(`Invalid scope: ${s}`);
  }

  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) throw new Error("Invalid expiration date");
    if (expiresAt < new Date()) throw new Error("Expiration must be in the future");
  }

  const { raw, prefix, hashed } = generateApiKey();

  const key = await db.apiKey.create({
    data: {
      workspaceId: workspace.id,
      name,
      prefix,
      hashedKey: hashed,
      scopes: input.scopes,
      expiresAt,
      createdBy: userId,
      isActive: true,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "api_key.created",
    resourceType: "api_key",
    resourceId: key.id,
    metadata: { name, scopes: input.scopes, prefix },
  });

  revalidatePath("/app/settings/api-keys");
  // rawKey once only — never echo hashedKey to the client.
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    isActive: key.isActive,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    createdAt: key.createdAt,
    rawKey: raw,
  };
}

export async function revokeApiKey(id: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const existing = await db.apiKey.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("API key not found");

  await db.apiKey.update({
    where: { id },
    data: { isActive: false },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "api_key.revoked",
    resourceType: "api_key",
    resourceId: id,
  });

  revalidatePath("/app/settings/api-keys");
  return { ok: true };
}

export async function deleteApiKey(id: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const existing = await db.apiKey.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("API key not found");

  await db.apiKey.delete({ where: { id } });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "api_key.deleted",
    resourceType: "api_key",
    resourceId: id,
  });

  revalidatePath("/app/settings/api-keys");
  return { ok: true };
}

// SCOPES lives in lib/api-keys.ts

