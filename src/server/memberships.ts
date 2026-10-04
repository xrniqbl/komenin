"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { WorkspaceRole } from "@/types/workspace";

export async function getActiveMembership(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  return db.membership.findFirst({
    where: {
      workspaceId,
      userId: session.user.id,
      status: "active",
    },
    include: {
      workspace: true,
      customRole: { select: { id: true, permissions: true } },
    },
  });
}

export async function requireMembership(
  workspaceId: string,
  minimum?: WorkspaceRole[],
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  // M3: invite flows go through requireMembership instead of
  // requireActiveWorkspace, so the TOTP gate must be enforced here too —
  // otherwise a still-gated session (password/OTP passed, 2FA pending) can
  // invite outsiders or join new workspaces.
  if (session.user.totpGate) throw new Error("Two-factor verification required");
  const membership = await getActiveMembership(workspaceId);
  if (!membership) throw new Error("Workspace not found or access denied");
  if (minimum && !minimum.includes(membership.role)) {
    throw new Error("Insufficient role");
  }
  return membership;
}
