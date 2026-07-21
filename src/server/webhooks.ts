"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { encryptSecret } from "@/lib/encryption";
import { assertSafeOutboundUrl, UnsafeUrlError } from "@/lib/url-safety";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

async function normalizeWebhookUrl(raw: string): Promise<string> {
  try {
    const url = assertSafeOutboundUrl(raw);
    return url.toString();
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw new Error(error.message);
    throw new Error("Invalid URL");
  }
}

export async function listWebhookEndpoints() {
  const { workspace } = await requireActiveWorkspace();
  const rows = await db.webhookEndpoint.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      url: true,
      actions: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      secretEnc: true, // used only to derive hasSecret, stripped below
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(({ secretEnc, ...endpoint }) => ({
    ...endpoint,
    hasSecret: Boolean(secretEnc),
  }));
}

export async function createWebhookEndpoint(input: {
  name: string;
  url: string;
  actions?: string[];
  secret?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const name = input.name.trim();
  if (!name) throw new Error("Name required");
  const url = await normalizeWebhookUrl(input.url);

  const endpoint = await db.webhookEndpoint.create({
    data: {
      workspaceId: workspace.id,
      name,
      url,
      actions: input.actions || [],
      secretEnc: input.secret ? encryptSecret(input.secret) : null,
      isActive: true,
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      url: true,
      actions: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "webhook_endpoint.created",
    resourceType: "webhook_endpoint",
    resourceId: endpoint.id,
    metadata: { name, url, actions: endpoint.actions },
  });

  revalidatePath("/app/settings/webhooks");
  return { ...endpoint, hasSecret: Boolean(input.secret) };
}

export async function updateWebhookEndpoint(
  id: string,
  data: { name?: string; url?: string; actions?: string[]; isActive?: boolean; secret?: string },
) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const existing = await db.webhookEndpoint.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Webhook endpoint not found");

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.url !== undefined) {
    updateData.url = await normalizeWebhookUrl(data.url);
  }
  if (data.actions !== undefined) updateData.actions = data.actions;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.secret !== undefined) {
    updateData.secretEnc = data.secret ? encryptSecret(data.secret) : null;
  }

  const updated = await db.webhookEndpoint.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      workspaceId: true,
      name: true,
      url: true,
      actions: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      secretEnc: true,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "webhook_endpoint.updated",
    resourceType: "webhook_endpoint",
    resourceId: id,
  });

  revalidatePath("/app/settings/webhooks");
  const { secretEnc, ...safe } = updated;
  return { ...safe, hasSecret: Boolean(secretEnc) };
}

export async function deleteWebhookEndpoint(id: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const existing = await db.webhookEndpoint.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Webhook endpoint not found");

  await db.webhookEndpoint.delete({ where: { id } });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "webhook_endpoint.deleted",
    resourceType: "webhook_endpoint",
    resourceId: id,
  });

  revalidatePath("/app/settings/webhooks");
  return { ok: true };
}

export async function testWebhookEndpoint(id: string) {
  const { workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!endpoint) throw new Error("Webhook endpoint not found");

  const { dispatchExternal } = await import("@/lib/notify/dispatcher");
  const result = await dispatchExternal("account.degraded", workspace.id, {
    title: `Test notification from Aether`,
    body: `This is a test from workspace ${workspace.name} to verify webhook delivery. Endpoint: ${endpoint.name}`,
    href: "/app/settings/webhooks",
  });

  return { ok: true, dispatched: result.dispatched, results: result.results };
}
