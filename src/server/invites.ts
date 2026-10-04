"use server";

import { createHash, randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";
import { assertCanWithCustom } from "@/lib/rbac";
import { requireMembership } from "@/server/memberships";
import { cookies } from "next/headers";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-cookie";
import { writeAuditLog } from "@/server/audit";
import type { WorkspaceRole } from "@/types/workspace";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Roles that may be granted via invite. Never owner (must transfer deliberately). */
const INVITEABLE_ROLES: WorkspaceRole[] = [
  "admin",
  "operator",
  "analyst",
  "auditor",
  "viewer",
];

const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 100,
  admin: 80,
  operator: 60,
  analyst: 40,
  auditor: 30,
  viewer: 10,
};

function assertInviteableRole(
  inviterRole: WorkspaceRole,
  targetRole: WorkspaceRole,
) {
  if (!INVITEABLE_ROLES.includes(targetRole)) {
    throw new Error("Invalid invite role (owner cannot be granted via invite)");
  }
  // Inviter cannot grant a role at or above their own rank (except owner inviting admin).
  if (inviterRole !== "owner" && ROLE_RANK[targetRole] >= ROLE_RANK[inviterRole]) {
    throw new Error("Cannot invite a role at or above your own");
  }
  if (inviterRole !== "owner" && targetRole === "admin") {
    throw new Error("Only the workspace owner can invite admins");
  }
}

export async function createInvite(input: {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
}) {
  const membership = await requireMembership(input.workspaceId);
  assertCanWithCustom(
    membership.role,
    membership.customRole?.permissions,
    "members.manage",
  );

  assertInviteableRole(membership.role as WorkspaceRole, input.role);

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

  // Best-effort email delivery; the token still surfaces in the UI as the
  // manual fallback when BREVO_API_KEY is not configured.
  const delivery = await sendInviteEmail({
    to: email,
    workspaceName: membership.workspace.name,
    role: input.role,
    token,
  }).catch(() => ({ delivered: false }));

  return { inviteId: invite.id, token, emailDelivered: delivery.delivered };
}

export async function acceptInvite(token: string) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) throw new Error("Unauthorized");
  // M3: accepting an invite grants a new workspace membership — a still-gated
  // session (2FA pending) must complete the challenge first.
  if (session.user.totpGate) throw new Error("Two-factor verification required");

  const invite = await db.invite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new Error("Invite invalid or expired");
  }
  if (invite.email !== session.user.email.toLowerCase()) {
    throw new Error("Invite email mismatch");
  }

  // Never accept an invite that smuggles owner (defense in depth vs old rows).
  if (!INVITEABLE_ROLES.includes(invite.role as WorkspaceRole)) {
    throw new Error("Invite role is no longer valid; ask an owner to re-issue");
  }

  await db.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: session.user.id,
        },
      },
    });

    if (existing) {
      // Do not demote or overwrite an existing owner via invite accept.
      if (existing.role === "owner") {
        await tx.membership.update({
          where: { id: existing.id },
          data: { status: "active" },
        });
      } else if (ROLE_RANK[invite.role as WorkspaceRole] > ROLE_RANK[existing.role as WorkspaceRole]) {
        // Only elevate; never demote via invite.
        await tx.membership.update({
          where: { id: existing.id },
          data: { role: invite.role, status: "active" },
        });
      } else {
        await tx.membership.update({
          where: { id: existing.id },
          data: { status: "active" },
        });
      }
    } else {
      await tx.membership.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: session.user.id,
          role: invite.role,
          status: "active",
        },
      });
    }

    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  });

  // Land the user in the invited workspace on next app load.
  const jar = await cookies();
  jar.set(ACTIVE_WORKSPACE_COOKIE, invite.workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  await writeAuditLog({
    workspaceId: invite.workspaceId,
    actorUserId: session.user.id,
    action: "invite.accepted",
    resourceType: "invite",
    resourceId: invite.id,
    metadata: { role: invite.role },
  });

  return { workspaceId: invite.workspaceId };
}
