"use server";

import { createHash, randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { requireMembership } from "@/server/memberships";
import { writeAuditLog } from "@/server/audit";
import type { WorkspaceRole } from "@/types/workspace";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createInvite(input: {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
}) {
  const membership = await requireMembership(input.workspaceId);
  assertCan(membership.role, "members.manage");

  const token = randomBytes(24).toString("hex");
  const tokenHash = hashToken(token);
  const email = input.email.trim().toLowerCase();

  const invite = await db.invite.create({
    data: {
      workspaceId: input.workspaceId,
      email,
      role: input.role,
      tokenHash,
      invitedById: membership.userId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    actorUserId: membership.userId,
    action: "invite.created",
    resourceType: "invite",
    resourceId: invite.id,
    metadata: { email, role: input.role },
  });

  return { inviteId: invite.id, token };
}

export async function acceptInvite(token: string) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) throw new Error("Unauthorized");

  const invite = await db.invite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new Error("Invite invalid or expired");
  }
  if (invite.email !== session.user.email.toLowerCase()) {
    throw new Error("Invite email mismatch");
  }

  await db.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: session.user.id,
        },
      },
      update: { role: invite.role, status: "active" },
      create: {
        workspaceId: invite.workspaceId,
        userId: session.user.id,
        role: invite.role,
        status: "active",
      },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  });

  await writeAuditLog({
    workspaceId: invite.workspaceId,
    actorUserId: session.user.id,
    action: "invite.accepted",
    resourceType: "invite",
    resourceId: invite.id,
  });

  return { workspaceId: invite.workspaceId };
}
