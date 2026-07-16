"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildUniqueSlugCandidate, slugifyWorkspaceName } from "@/lib/workspace";
import { writeAuditLog } from "@/server/audit";

export async function listWorkspacesForUser() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const memberships = await db.membership.findMany({
    where: { userId: session.user.id, status: "active" },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  return memberships
    .filter((m) => m.workspace.status === "active")
    .map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      connectorPolicy: m.workspace.connectorPolicy,
      planCode: m.workspace.planCode,
      monthlySendLimit: m.workspace.monthlySendLimit,
      monthlyPublishLimit: m.workspace.monthlyPublishLimit,
      homeRegion: m.workspace.homeRegion,
      ssoRequired: m.workspace.ssoRequired,
      billingEmail: m.workspace.billingEmail,
    }));
}

export async function createWorkspace(input: { name: string; timezone?: string }) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

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

  return workspace;
}

