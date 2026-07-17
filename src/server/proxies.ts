"use server";

import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import { encryptSecret } from "@/lib/encryption";
import { simulateIp } from "@/lib/session-routing";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import type { ProxyProtocol, ProxyType, RotationMode } from "@prisma/client";

export async function listProxies() {
  const { workspace } = await requireActiveWorkspace();
  return db.proxyEndpoint.findMany({
    where: { workspaceId: workspace.id, deletedAt: null },
    include: {
      assignments: {
        where: { isActive: true },
        include: { socialAccount: true },
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
  assertCan(workspace.role, "accounts.manage");

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
  assertCan(workspace.role, "accounts.manage");

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
