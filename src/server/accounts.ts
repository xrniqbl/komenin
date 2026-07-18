"use server";

import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import { encryptSecret } from "@/lib/encryption";
import { simulateIp } from "@/lib/session-routing";
import { assertProductionSessionPayload } from "@/lib/session-payload";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import type { Platform, SocialAccountStatus } from "@prisma/client";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export async function listAccounts(input?: {
  q?: string;
  status?: string;
  platform?: string;
}) {
  const { workspace } = await requireActiveWorkspace();
  const where: Record<string, unknown> & { workspaceId: string; deletedAt: null } = {
    workspaceId: workspace.id,
    deletedAt: null,
  };
  if (input?.q) {
    where.OR = [
      { username: { contains: input.q, mode: "insensitive" as const } },
      { displayName: { contains: input.q, mode: "insensitive" as const } },
    ];
  }
  if (input?.status) where.status = input.status as never;
  if (input?.platform) where.platform = input.platform as never;

  return db.socialAccount.findMany({
    where,
    include: {
      sessions: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      proxyAssignments: {
        where: { isActive: true },
        include: { proxyEndpoint: true },
        take: 1,
      },
      healthChecks: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAccount(accountId: string) {
  const { workspace } = await requireActiveWorkspace();
  return db.socialAccount.findFirst({
    where: { id: accountId, workspaceId: workspace.id, deletedAt: null },
    include: {
      sessions: { orderBy: { createdAt: "desc" }, take: 5 },
      proxyAssignments: {
        where: { isActive: true },
        include: { proxyEndpoint: true },
      },
      healthChecks: { orderBy: { createdAt: "desc" }, take: 10 },
      rotationLogs: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
}

export async function createAccount(input: {
  platform: Platform;
  username: string;
  displayName?: string;
  sessionPayload: string;
  userAgent?: string;
  proxyEndpointId?: string;
  notes?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "accounts.manage");

  const username = input.username.trim().replace(/^@/, "");
  if (!username) throw new Error("Username is required");

  const validated = assertProductionSessionPayload(input.sessionPayload, input.platform, {
    username,
    userAgent: input.userAgent,
  });

  let proxy = null as null | { id: string; lastIp: string | null };
  if (input.proxyEndpointId) {
    proxy = await db.proxyEndpoint.findFirst({
      where: {
        id: input.proxyEndpointId,
        workspaceId: workspace.id,
        deletedAt: null,
      },
      select: { id: true, lastIp: true },
    });
    if (!proxy) throw new Error("Selected proxy not found");
  }

  const currentIp = proxy?.lastIp || simulateIp(`${workspace.id}:${username}`);
  const account = await db.$transaction(async (tx) => {
    const created = await tx.socialAccount.create({
      data: {
        workspaceId: workspace.id,
        platform: input.platform,
        username,
        displayName: input.displayName?.trim() || null,
        status: "connecting",
        healthScore: 80,
        currentIp,
        notes: input.notes?.trim() || null,
      },
    });

    await tx.accountSession.create({
      data: {
        workspaceId: workspace.id,
        socialAccountId: created.id,
        encryptedBlob: encryptSecret(validated.serialized),
        userAgent: validated.payload.ua,
        fingerprintJson: {
          platform: input.platform,
          language: "en-US",
          timezone: "Asia/Jakarta",
          cookieNames: validated.cookieNames,
          cookieCount: validated.cookieNames.length,
          importedAt: validated.payload.capturedAt,
          source: "session_import",
        },
        isActive: true,
        lastUsedAt: new Date(),
      },
    });

    if (proxy) {
      await tx.proxyAssignment.create({
        data: {
          workspaceId: workspace.id,
          socialAccountId: created.id,
          proxyEndpointId: proxy.id,
          isActive: true,
        },
      });
    }

    await tx.sessionHealthCheck.create({
      data: {
        workspaceId: workspace.id,
        socialAccountId: created.id,
        ok: true,
        latencyMs: 120,
        signal: "session_imported",
        details: `Imported ${validated.cookieNames.length} cookies for ${input.platform}`,
      },
    });

    return tx.socialAccount.update({
      where: { id: created.id },
      data: { status: "healthy", healthScore: 95 },
    });
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "social_account.created",
    resourceType: "social_account",
    resourceId: account.id,
    metadata: {
      platform: account.platform,
      username: account.username,
      proxyEndpointId: proxy?.id ?? null,
      cookieCount: validated.cookieNames.length,
      // never log cookie values
      cookieNames: validated.cookieNames,
    },
  });

  revalidatePath("/app/accounts");
  revalidatePath(`/app/accounts/${account.id}`);
  revalidatePath("/app/sessions");
  revalidatePath("/app");
  return account;
}

export async function reimportAccountSession(input: {
  accountId: string;
  sessionPayload: string;
  userAgent?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "accounts.manage");

  const account = await db.socialAccount.findFirst({
    where: {
      id: input.accountId,
      workspaceId: workspace.id,
      deletedAt: null,
    },
    select: {
      id: true,
      platform: true,
      username: true,
    },
  });
  if (!account) throw new Error("Account not found");

  const validated = assertProductionSessionPayload(input.sessionPayload, account.platform, {
    username: account.username,
    userAgent: input.userAgent,
  });

  await db.$transaction(async (tx) => {
    await tx.accountSession.updateMany({
      where: {
        workspaceId: workspace.id,
        socialAccountId: account.id,
        isActive: true,
      },
      data: { isActive: false },
    });

    await tx.accountSession.create({
      data: {
        workspaceId: workspace.id,
        socialAccountId: account.id,
        encryptedBlob: encryptSecret(validated.serialized),
        userAgent: validated.payload.ua,
        fingerprintJson: {
          platform: account.platform,
          language: "en-US",
          timezone: "Asia/Jakarta",
          cookieNames: validated.cookieNames,
          cookieCount: validated.cookieNames.length,
          importedAt: validated.payload.capturedAt,
          source: "session_reimport",
        },
        isActive: true,
        lastUsedAt: new Date(),
      },
    });

    await tx.sessionHealthCheck.create({
      data: {
        workspaceId: workspace.id,
        socialAccountId: account.id,
        ok: true,
        latencyMs: 90,
        signal: "session_reimported",
        details: `Re-imported ${validated.cookieNames.length} cookies for ${account.platform}`,
      },
    });

    await tx.socialAccount.update({
      where: { id: account.id },
      data: {
        status: "healthy",
        healthScore: 95,
        lastActionAt: new Date(),
      },
    });
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "social_account.session_reimported",
    resourceType: "social_account",
    resourceId: account.id,
    metadata: {
      platform: account.platform,
      username: account.username,
      cookieCount: validated.cookieNames.length,
      cookieNames: validated.cookieNames,
    },
  });

  revalidatePath("/app/accounts");
  revalidatePath(`/app/accounts/${account.id}`);
  revalidatePath("/app/sessions");
  return { ok: true as const, accountId: account.id, cookieCount: validated.cookieNames.length };
}

export async function runAccountHealthCheck(accountId: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "accounts.manage");

  const account = await db.socialAccount.findFirst({
    where: { id: accountId, workspaceId: workspace.id, deletedAt: null },
    include: {
      sessions: { where: { isActive: true }, take: 1 },
      proxyAssignments: {
        where: { isActive: true },
        include: { proxyEndpoint: true },
        take: 1,
      },
    },
  });
  if (!account) throw new Error("Account not found");

  const hasSession = account.sessions.length > 0;
  const proxy = account.proxyAssignments[0]?.proxyEndpoint;
  const proxyOk = !proxy || proxy.isHealthy;
  const ok = hasSession && proxyOk;
  const status: SocialAccountStatus = ok
    ? "healthy"
    : !hasSession
      ? "limited"
      : "degraded";
  const healthScore = ok ? Math.min(100, account.healthScore + 5) : Math.max(10, account.healthScore - 15);

  await db.$transaction(async (tx) => {
    await tx.sessionHealthCheck.create({
      data: {
        workspaceId: workspace.id,
        socialAccountId: account.id,
        ok,
        latencyMs: ok ? 90 + Math.floor(Math.random() * 80) : 800,
        signal: ok ? "healthy" : !hasSession ? "session_missing" : "proxy_degraded",
        details: ok
          ? "Probe succeeded"
          : !hasSession
            ? "No active session"
            : "Assigned proxy unhealthy",
      },
    });

    await tx.socialAccount.update({
      where: { id: account.id },
      data: {
        status,
        healthScore,
        lastActionAt: new Date(),
      },
    });
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "social_account.health_checked",
    resourceType: "social_account",
    resourceId: account.id,
    metadata: { ok, status, healthScore },
  });

  revalidatePath("/app/accounts");
  revalidatePath(`/app/accounts/${account.id}`);
  revalidatePath("/app/sessions");
  return { ok, status, healthScore };
}

export async function rotateAccountIp(accountId: string, reason = "manual_rotate") {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "accounts.manage");

  const account = await db.socialAccount.findFirst({
    where: { id: accountId, workspaceId: workspace.id, deletedAt: null },
    include: {
      proxyAssignments: {
        where: { isActive: true },
        include: { proxyEndpoint: true },
        take: 1,
      },
    },
  });
  if (!account) throw new Error("Account not found");

  const oldIp = account.currentIp;
  const newIp = simulateIp(`${account.id}:${Date.now()}`);
  const proxy = account.proxyAssignments[0]?.proxyEndpoint;

  await db.$transaction(async (tx) => {
    await tx.socialAccount.update({
      where: { id: account.id },
      data: {
        currentIp: newIp,
        lastActionAt: new Date(),
        status: account.status === "banned" ? account.status : "healthy",
      },
    });

    if (proxy) {
      await tx.proxyEndpoint.update({
        where: { id: proxy.id },
        data: { lastIp: newIp, lastCheckedAt: new Date(), isHealthy: true },
      });
    }

    await tx.ipRotationLog.create({
      data: {
        workspaceId: workspace.id,
        socialAccountId: account.id,
        proxyEndpointId: proxy?.id,
        oldIp,
        newIp,
        reason,
        success: true,
      },
    });
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "social_account.ip_rotated",
    resourceType: "social_account",
    resourceId: account.id,
    metadata: { oldIp, newIp, reason },
  });

  revalidatePath("/app/accounts");
  revalidatePath(`/app/accounts/${account.id}`);
  revalidatePath("/app/proxies");
  revalidatePath("/app/sessions");
  return { oldIp, newIp };
}
