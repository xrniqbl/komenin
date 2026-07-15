"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listWorkspacesForUser } from "@/server/workspaces";
import type { WorkspaceSummary } from "@/types/workspace";

export async function requireActiveWorkspace(): Promise<{
  userId: string;
  workspace: WorkspaceSummary;
}> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const workspaces = await listWorkspacesForUser();
  if (workspaces.length === 0) redirect("/onboarding");

  return {
    userId: session.user.id,
    workspace: workspaces[0],
  };
}
