"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-cookie";
import { listWorkspacesForUser } from "@/server/workspace-access";

export { ACTIVE_WORKSPACE_COOKIE };

export async function switchActiveWorkspace(workspaceId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const workspaces = await listWorkspacesForUser();
  const target = workspaces.find((workspace) => workspace.id === workspaceId);
  if (!target) throw new Error("Workspace not found or access denied");

  const jar = await cookies();
  jar.set(ACTIVE_WORKSPACE_COOKIE, target.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return { ok: true, workspaceId: target.id };
}