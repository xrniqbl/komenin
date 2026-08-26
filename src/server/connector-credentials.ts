"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import { assertSafeOutboundUrl, UnsafeUrlError } from "@/lib/url-safety";

export type ConnectorProvider = "instagram" | "threads" | "tiktok" | string;

/** Safe list row — never includes encrypted token material. */
export type ConnectorCredentialSummary = {
  id: string;
  provider: string;
  label: string | null;
  socialAccountId: string | null;
  apiBaseUrl: string | null;
  scopes: string[];
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  hasRefreshToken: boolean;
};

const summarySelect = {
  id: true,
  provider: true,
  label: true,
  socialAccountId: true,
  apiBaseUrl: true,
  scopes: true,
  expiresAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  refreshTokenEnc: true,
} as const;

function toSummary(row: {
  id: string;
  provider: string;
  label: string | null;
  socialAccountId: string | null;
  apiBaseUrl: string | null;
  scopes: string[];
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  refreshTokenEnc: string | null;
}): ConnectorCredentialSummary {
  const { refreshTokenEnc, ...rest } = row;
  return { ...rest, hasRefreshToken: Boolean(refreshTokenEnc) };
}

export async function listConnectorCredentials(provider?: string) {
  const { workspace } = await requireActiveWorkspace();
  const rows = await db.connectorCredential.findMany({
    where: {
      workspaceId: workspace.id,
      ...(provider ? { provider } : {}),
    },
    select: summarySelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

async function upsertConnectorCredentialInternal(input: {
  userId: string;
  workspaceId: string;
  provider: ConnectorProvider;
  accessToken: string;
  refreshToken?: string | null;
  label?: string | null;
  socialAccountId?: string | null;
  apiBaseUrl?: string | null;
  scopes?: string[];
  expiresAt?: Date | null;
  isActive?: boolean;
}) {
  const provider = input.provider.trim().toLowerCase();
  const accessToken = input.accessToken.trim();
  if (!provider) throw new Error("Provider required");
  if (!accessToken) throw new Error("Access token required");

  if (input.socialAccountId) {
    const account = await db.socialAccount.findFirst({
      where: {
        id: input.socialAccountId,
        workspaceId: input.workspaceId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!account) throw new Error("Social account not found");
  }

  // Validate apiBaseUrl against safe outbound URL policy
  let validatedApiBaseUrl: string | null = null;
  if (input.apiBaseUrl?.trim()) {
    try {
      const url = assertSafeOutboundUrl(input.apiBaseUrl);
      // Restrict to known provider hosts only
      const allowedHosts = [
        "graph.facebook.com",
        "graph.tiktok.com",
        "api.tiktok.com",
        "open.tiktokapis.com",
      ];
      const host = url.hostname.toLowerCase();
      const isAllowed = allowedHosts.some((h) => host.endsWith(h));
      if (!isAllowed && !host.endsWith(".internal") && !host.endsWith(".local")) {
        throw new UnsafeUrlError(
          `API base URL hostname must be from an approved provider domain`,
        );
      }
      validatedApiBaseUrl = url.toString();
    } catch {
      throw new UnsafeUrlError("Invalid or unsafe API base URL");
    }
  }

  const data = {
    label: input.label?.trim() || null,
    accessTokenEnc: encryptSecret(accessToken),
    refreshTokenEnc: input.refreshToken?.trim()
      ? encryptSecret(input.refreshToken.trim())
      : null,
    apiBaseUrl: validatedApiBaseUrl,
    scopes: input.scopes || [],
    expiresAt: input.expiresAt || null,
    isActive: input.isActive ?? true,
  };

  // Transaction + advisory lock: two concurrent OAuth callbacks for the same
  // (workspace, provider, account) must not create two active credential rows.
  const lockKey = `${input.workspaceId}:${provider}:${input.socialAccountId || "none"}`;
  const { credential, wasUpdate } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const current = await tx.connectorCredential.findFirst({
      where: {
        workspaceId: input.workspaceId,
        provider,
        socialAccountId: input.socialAccountId || null,
        isActive: true,
      },
      select: { id: true },
    });
    if (current) {
      const updated = await tx.connectorCredential.update({
        where: { id: current.id },
        data,
        select: summarySelect,
      });
      return { credential: updated, wasUpdate: true };
    }
    const created = await tx.connectorCredential.create({
      data: {
        workspaceId: input.workspaceId,
        provider,
        socialAccountId: input.socialAccountId || null,
        ...data,
      },
      select: summarySelect,
    });
    return { credential: created, wasUpdate: false };
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    actorUserId: input.userId,
    action: wasUpdate ? "connector_credential.updated" : "connector_credential.created",
    resourceType: "connector_credential",
    resourceId: credential.id,
    metadata: {
      provider,
      socialAccountId: input.socialAccountId || null,
      hasRefreshToken: Boolean(input.refreshToken),
    },
  });

  revalidatePath("/app/settings/publisher");
  return toSummary(credential);
}

export async function upsertConnectorCredential(input: {
  provider: ConnectorProvider;
  accessToken: string;
  refreshToken?: string | null;
  label?: string | null;
  socialAccountId?: string | null;
  apiBaseUrl?: string | null;
  scopes?: string[];
  expiresAt?: Date | null;
  isActive?: boolean;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");
  return upsertConnectorCredentialInternal({
    userId,
    workspaceId: workspace.id,
    ...input,
  });
}

/** OAuth callback path: bind to signed state workspace after membership check. */
export async function upsertConnectorCredentialFromOAuth(input: {
  userId: string;
  workspaceId: string;
  provider: ConnectorProvider;
  accessToken: string;
  refreshToken?: string | null;
  label?: string | null;
  socialAccountId?: string | null;
  apiBaseUrl?: string | null;
  scopes?: string[];
  expiresAt?: Date | null;
}) {
  const membership = await db.membership.findFirst({
    where: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      status: "active",
    },
    include: {
      customRole: { select: { permissions: true } },
    },
  });
  if (!membership) throw new Error("Workspace access denied for OAuth state");
  assertWorkspacePermission(
    {
      role: membership.role,
      customPermissions: membership.customRole?.permissions ?? null,
    },
    "settings.manage",
  );

  return upsertConnectorCredentialInternal({
    ...input,
    isActive: true,
  });
}

export async function deactivateConnectorCredential(id: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const existing = await db.connectorCredential.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true, provider: true },
  });
  if (!existing) throw new Error("Credential not found");

  await db.connectorCredential.update({
    where: { id },
    data: { isActive: false },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "connector_credential.deactivated",
    resourceType: "connector_credential",
    resourceId: id,
    metadata: { provider: existing.provider },
  });

  revalidatePath("/app/settings/publisher");
  return { ok: true as const };
}

/**
 * Decrypt active official credentials for connector runtime.
 * Prefer account-scoped credential, else workspace-level provider credential.
 */
export async function resolveOfficialCredential(input: {
  workspaceId: string;
  provider: string;
  socialAccountId?: string | null;
}): Promise<{
  provider: string;
  accessToken: string;
  apiBaseUrl: string | null;
  credentialId: string;
} | null> {
  const provider = input.provider.trim().toLowerCase();
  const rows = await db.connectorCredential.findMany({
    where: {
      workspaceId: input.workspaceId,
      provider,
      isActive: true,
      OR: [
        input.socialAccountId ? { socialAccountId: input.socialAccountId } : undefined,
        { socialAccountId: null },
      ].filter(Boolean) as object[],
    },
    orderBy: [{ socialAccountId: "desc" }, { updatedAt: "desc" }],
    take: 5,
  });

  const row =
    rows.find((r) => r.socialAccountId && r.socialAccountId === input.socialAccountId) ||
    rows.find((r) => r.socialAccountId == null) ||
    rows[0];
  if (!row) return null;

  try {
    return {
      provider: row.provider,
      accessToken: decryptSecret(row.accessTokenEnc),
      apiBaseUrl: row.apiBaseUrl,
      credentialId: row.id,
    };
  } catch {
    return null;
  }
}
