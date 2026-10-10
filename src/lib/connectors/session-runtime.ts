import type { Platform } from "@prisma/client";
import { db } from "@/lib/db";
import type { ConnectorSessionConfig } from "@/lib/connectors/types";

/**
 * Resolve the imported session cookie for an account, workspace-scoped.
 *
 * Returns null rather than throwing when nothing is found so callers can keep
 * walking the connector chain (webhook → official → session) without a failed
 * lookup aborting the action. Never logs the blob — only the handle.
 */
export async function resolveSessionConfigForAccount(input: {
  platform?: string | null;
  workspaceId?: string | null;
  accountId?: string | null;
}): Promise<ConnectorSessionConfig | null> {
  if (!input.workspaceId) return null;
  if (!input.accountId && !input.platform) return null;

  const session = await db.accountSession.findFirst({
    where: {
      workspaceId: input.workspaceId,
      isActive: true,
      // Session expiry is enforced at probe time too; skipping here would
      // hand a dead cookie to the private API and burn a rate-limit slot.
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(input.accountId
        ? { socialAccountId: input.accountId }
        : { socialAccount: { platform: (input.platform || "instagram") as Platform } }),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      encryptedBlob: true,
      socialAccount: {
        select: { platform: true, username: true, id: true },
      },
    },
  });

  if (!session?.encryptedBlob) return null;

  return {
    platform: session.socialAccount.platform,
    encryptedBlob: session.encryptedBlob,
    accountId: session.socialAccount.id,
    username: session.socialAccount.username,
  };
}
