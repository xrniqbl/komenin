import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-cookie";
import type { WorkspaceSummary } from "@/types/workspace";

export async function listWorkspacesForUser(): Promise<WorkspaceSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  // TOTP-gated sessions (2FA enabled, code not yet re-verified) see nothing.
  if (session.user.totpGate) return [];

  const memberships = await db.membership.findMany({
    where: { userId: session.user.id, status: "active" },
    include: {
      workspace: true,
      customRole: { select: { id: true, permissions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships
    .filter((m) => m.workspace.status === "active")
    .map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      customRoleId: m.customRoleId,
      customPermissions: m.customRole?.permissions ?? null,
      connectorPolicy: m.workspace.connectorPolicy,
      planCode: m.workspace.planCode,
      monthlySendLimit: m.workspace.monthlySendLimit,
      monthlyPublishLimit: m.workspace.monthlyPublishLimit,
      homeRegion: m.workspace.homeRegion,
      ssoRequired: m.workspace.ssoRequired,
      billingEmail: m.workspace.billingEmail,
    }));
}

async function readPreferredWorkspaceId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ACTIVE_WORKSPACE_COOKIE)?.value || null;
}

export async function resolveActiveWorkspace(
  workspaces: WorkspaceSummary[],
): Promise<WorkspaceSummary | null> {
  if (workspaces.length === 0) return null;
  const preferred = await readPreferredWorkspaceId();
  if (preferred) {
    const matched = workspaces.find((workspace) => workspace.id === preferred);
    if (matched) return matched;
  }
  return workspaces[0] || null;
}

export async function requireActiveWorkspace(): Promise<{
  userId: string;
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
}> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // 2FA challenge: users with TOTP enabled must re-verify before any data loads.
  if (session.user.totpGate) redirect("/auth/totp-gate");

  const workspaces = await listWorkspacesForUser();
  if (workspaces.length === 0) redirect("/onboarding");

  const workspace = await resolveActiveWorkspace(workspaces);
  if (!workspace) redirect("/onboarding");

  return {
    userId: session.user.id,
    workspace,
    workspaces,
  };
}
