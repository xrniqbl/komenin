"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertWorkspacePermission } from "@/lib/rbac";
import { buildUniqueSlugCandidate, slugifyWorkspaceName } from "@/lib/workspace";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-cookie";
import { writeAuditLog } from "@/server/audit";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { listWorkspacesForUser } from "@/server/workspace-access";

export { listWorkspacesForUser };

export async function updateWorkspaceSettings(input: {
  timezone?: string;
  quietHoursStart?: number;
  quietHoursEnd?: number;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const data: { timezone?: string; quietHoursStart?: number; quietHoursEnd?: number } = {};

  if (input.timezone !== undefined) {
    const tz = input.timezone.trim();
    if (tz) {
      // Validate the IANA name instead of storing garbage.
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: tz });
      } catch {
        throw new Error(`Invalid timezone: ${tz}`);
      }
      data.timezone = tz.slice(0, 64);
    }
  }

  const parseHour = (value: number | undefined, label: string) => {
    if (value === undefined) return undefined;
    if (!Number.isInteger(value) || value < 0 || value > 23) {
      throw new Error(`${label} must be an hour between 0 and 23`);
    }
    return value;
  };

  const start = parseHour(input.quietHoursStart, "Quiet hours start");
  const end = parseHour(input.quietHoursEnd, "Quiet hours end");
  if (start !== undefined) data.quietHoursStart = start;
  if (end !== undefined) data.quietHoursEnd = end;

  if (Object.keys(data).length === 0) return { ok: true };

  await db.workspace.update({ where: { id: workspace.id }, data });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "workspace.settings_updated",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: data,
  });

  revalidatePath("/app/settings/general");
  return { ok: true };
}

export async function createWorkspace(input: { name: string; timezone?: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (session.user.totpGate) throw new Error("Two-factor verification required");

  const name = input.name.trim();
  if (name.length < 2) throw new Error("Workspace name is required");

  const base = slugifyWorkspaceName(name) || "workspace";
  let slug = base;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    slug = buildUniqueSlugCandidate(base, attempt);
    const exists = await db.workspace.findUnique({ where: { slug } });
    if (!exists) break;
  }

  const workspace = await db.$transaction(async (tx) => {
    const created = await tx.workspace.create({
      data: {
        name,
        slug,
        timezone: input.timezone ?? "Asia/Jakarta",
        // Free tier until a paid plan is applied via checkout.
        planCode: "free",
        monthlySendLimit: 500,
        monthlyPublishLimit: 50,
      },
    });

    await tx.membership.create({
      data: {
        workspaceId: created.id,
        userId: session.user.id,
        role: "owner",
        status: "active",
      },
    });

    return created;
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: session.user.id,
    action: "workspace.created",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: { name: workspace.name, slug: workspace.slug },
  });

  const jar = await cookies();
  jar.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return workspace;
}