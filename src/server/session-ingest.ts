"use server";

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/encryption";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { createAccount } from "@/server/accounts";
import { signSessionIngestToken, verifySessionIngestToken } from "@/lib/session-ingest-token";

/**
 * Wizard-facing server actions for the cookie-import bridge.
 *
 * The bridge itself (/api/connectors/session/ingest) is token-authenticated
 * because it is called cross-origin from the platform origin. Everything that
 * actually writes to the workspace happens here, behind a normal
 * `requireActiveWorkspace()` + `accounts.manage` check inside `createAccount`.
 */

export type IngestStatus =
  | { state: "idle" }
  | { state: "waiting"; expiresAt: string }
  | { state: "ready"; ingestId: string; cookieCount: number; expiresAt: string }
  | { state: "claimed"; accountId: string }
  | { state: "expired" };

export async function mintSessionIngestToken(
  platform: "instagram" | "threads" | "tiktok",
): Promise<{ token: string; expiresInMinutes: number }> {
  const { userId, workspace } = await requireActiveWorkspace();
  // Minting a token grants "write cookies into this workspace", so the same
  // permission that guards createAccount must guard the mint.
  const { assertWorkspacePermission } = await import("@/lib/rbac");
  assertWorkspacePermission(workspace, "accounts.manage");

  return {
    token: signSessionIngestToken({
      userId,
      workspaceId: workspace.id,
      platform,
    }),
    expiresInMinutes: 10,
  };
}

/**
 * Poll status for a minted token. The wizard drives its progress bar off this
 * while the user clicks the extension on the platform origin.
 */
export async function getSessionIngestStatus(token: string): Promise<IngestStatus> {
  const { workspace } = await requireActiveWorkspace();
  const payload = verifySessionIngestToken(token);
  if (!payload) return { state: "idle" };
  if (payload.workspaceId !== workspace.id) return { state: "idle" };

  const rows = await db.sessionIngest.findMany({
    where: {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      platform: payload.platform as never,
    },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      payloadEnc: true,
      expiresAt: true,
      consumedAt: true,
      createdAt: true,
    },
  });
  const row = rows[0];
  if (!row) return { state: "idle" };

  if (row.consumedAt) {
    // The account id is not stored on SessionIngest, so report the most
    // recent account on this platform instead of leaking an arbitrary id.
    const account = await db.socialAccount.findFirst({
      where: { workspaceId: workspace.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return { state: "claimed", accountId: account?.id ?? "" };
  }

  if (row.expiresAt.getTime() < Date.now()) {
    return { state: "expired" };
  }

  let cookieCount = 0;
  try {
    const parsed = JSON.parse(decryptSecret(row.payloadEnc)) as { cookies?: unknown[] };
    cookieCount = Array.isArray(parsed.cookies) ? parsed.cookies.length : 0;
  } catch {
    cookieCount = 0;
  }

  return {
    state: "ready",
    ingestId: row.id,
    cookieCount,
    expiresAt: row.expiresAt.toISOString(),
  };
}

/**
 * One-time claim: decrypt the stored payload, hand it to the normal
 * createAccount path (which re-validates, checks RBAC and entitlements), then
 * mark the slot consumed so a leaked ingest id cannot be replayed.
 */
export async function claimSessionIngest(
  token: string,
  input: { username: string; displayName?: string; proxyEndpointId?: string },
): Promise<{ ok: boolean; accountId?: string; message: string }> {
  const { workspace } = await requireActiveWorkspace();
  const payload = verifySessionIngestToken(token);
  if (!payload || payload.workspaceId !== workspace.id) {
    return { ok: false, message: "Token tidak valid. Muat ulang halaman Connect." };
  }

  const row = await db.sessionIngest.findFirst({
    where: {
      userId: payload.userId,
      workspaceId: workspace.id,
      platform: payload.platform as never,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    return {
      ok: false,
      message: "Sesi kedaluwarsa atau sudah dipakai. Ambil ulang cookie dari ekstensi.",
    };
  }

  let sessionPayload: string;
  try {
    sessionPayload = decryptSecret(row.payloadEnc);
  } catch {
    return { ok: false, message: "Gagal membuka sesi tersimpan. Ambil ulang cookie." };
  }

  try {
    const account = await createAccount({
      platform: row.platform,
      username: input.username,
      displayName: input.displayName,
      sessionPayload,
      proxyEndpointId: input.proxyEndpointId || undefined,
    });

    await db.sessionIngest.update({
      where: { id: row.id },
      data: { consumedAt: new Date() },
    });

    return { ok: true, accountId: account.id, message: `Akun @${input.username} tersambung.` };
  } catch (error) {
    // createAccount already translates limit/permission/validation errors into
    // readable messages; surface them instead of a generic failure.
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Gagal menyimpan akun.",
    };
  }
}
