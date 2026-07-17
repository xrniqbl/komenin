"use server";

import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import { encryptSecret } from "@/lib/encryption";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

export async function listWebhookEndpoints() {
  const { workspace } = await requireActiveWorkspace();
  return db.webhookEndpoint.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function createWebhookEndpoint(input: {
  name: string;
  url: string;
  actions?: string[];
  secret?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "settings.manage");

  const name = input.name.trim();
  const url = input.url.trim();
  if (!name) throw new Error("Name required");
  if (!url) throw new Error("URL required");
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL must be http(s)");
  } catch {
    throw new Error("Invalid URL");
  }

  const endpoint = await db.webhookEndpoint.create({
    data: {
      workspaceId: workspace.id,
      name,
      url,
      actions: input.actions || [],
      secretEnc: input.secret ? encryptSecret(input.secret) : null,
      isActive: true,
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
  return endpoint;
}

export async function updateWebhookEndpoint(
  id: string,
  data: { name?: string; url?: string; actions?: string[]; isActive?: boolean; secret?: string },
) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "settings.manage");

  const existing = await db.webhookEndpoint.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Webhook endpoint not found");

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.url !== undefined) {
    const u = data.url.trim();
    try {
      new URL(u);
    } catch {
      throw new Error("Invalid URL");
    }
    updateData.url = u;
  }
  if (data.actions !== undefined) updateData.actions = data.actions;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.secret !== undefined) {
    updateData.secretEnc = data.secret ? encryptSecret(data.secret) : null;
  }

  const updated = await db.webhookEndpoint.update({ where: { id }, data: updateData });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "webhook_endpoint.updated",
    resourceType: "webhook_endpoint",
    resourceId: id,
  });

  revalidatePath("/app/settings/webhooks");
  return updated;
}

export async function deleteWebhookEndpoint(id: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "settings.manage");

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
  assertCan(workspace.role, "settings.manage");

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
