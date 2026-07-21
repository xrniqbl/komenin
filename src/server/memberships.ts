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
  const membership = await getActiveMembership(workspaceId);
  if (!membership) throw new Error("Workspace not found or access denied");
  if (minimum && !minimum.includes(membership.role)) {
    throw new Error("Insufficient role");
  }
  return membership;
}
