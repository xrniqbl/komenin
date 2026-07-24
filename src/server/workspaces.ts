"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildUniqueSlugCandidate, slugifyWorkspaceName } from "@/lib/workspace";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-cookie";
import { writeAuditLog } from "@/server/audit";
import { listWorkspacesForUser } from "@/server/workspace-access";

export { listWorkspacesForUser };

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