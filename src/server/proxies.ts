"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { encryptSecret } from "@/lib/encryption";
import { simulateIp } from "@/lib/session-routing";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import type { ProxyProtocol, ProxyType, RotationMode } from "@prisma/client";

/** List/detail fields without encrypted credentials. */
const proxySafeSelect = {
  id: true,
  workspaceId: true,
  label: true,
  protocol: true,
  host: true,
  port: true,
  provider: true,
  type: true,
  country: true,
  rotationMode: true,
  rotateEveryMin: true,
  isHealthy: true,
  lastCheckedAt: true,
  lastIp: true,
  createdAt: true,
  updatedAt: true,
  // usernameEnc / passwordEnc intentionally omitted
} as const;

export async function listProxies() {
  const { workspace } = await requireActiveWorkspace();
  return db.proxyEndpoint.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    select: {
      ...proxySafeSelect,
      assignments: {
        where: { isActive: true },
        select: {
          id: true,
          socialAccount: {
            select: {
              id: true,
              username: true,
              platform: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createProxy(input: {
  label: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  provider?: string;
  type: ProxyType;
  country?: string;
  rotationMode: RotationMode;
  rotateEveryMin?: number;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "accounts.manage");

  const label = input.label.trim();
  const host = input.host.trim();
  if (!label || !host || !input.port) {
    throw new Error("Proxy label, host, and port are required");
  }

  const proxy = await db.proxyEndpoint.create({
    data: {
      workspaceId: workspace.id,
      label,
      protocol: input.protocol,
      host,
      port: input.port,
      usernameEnc: input.username ? encryptSecret(input.username) : null,
      passwordEnc: input.password ? encryptSecret(input.password) : null,
      provider: input.provider?.trim() || null,
      type: input.type,
      country: input.country?.trim() || null,
      rotationMode: input.rotationMode,
      rotateEveryMin: input.rotateEveryMin,
      isHealthy: true,
      lastCheckedAt: new Date(),
      lastIp: simulateIp(`${host}:${input.port}`),
    },
    select: proxySafeSelect,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "proxy.created",
    resourceType: "proxy_endpoint",
    resourceId: proxy.id,
    metadata: { label: proxy.label, host: proxy.host, protocol: proxy.protocol },
  });

  revalidatePath("/app/proxies");
  revalidatePath("/app/accounts");
  return proxy;
}

export async function checkProxyHealth(proxyId: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "accounts.manage");

  const proxy = await db.proxyEndpoint.findFirst({
    where: { id: proxyId, workspaceId: workspace.id, deletedAt: null },
  });
  if (!proxy) throw new Error("Proxy not found");

  const ok = Boolean(proxy.host && proxy.port > 0);
  const lastIp = ok ? simulateIp(`${proxy.id}:${Date.now()}`) : proxy.lastIp;

  const updated = await db.proxyEndpoint.update({
    where: { id: proxy.id },
    data: {
      isHealthy: ok,
      lastCheckedAt: new Date(),
      lastIp,
    },
    select: proxySafeSelect,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "proxy.health_checked",
    resourceType: "proxy_endpoint",
    resourceId: proxy.id,
    metadata: { ok, lastIp },
  });

  revalidatePath("/app/proxies");
  return updated;
}
