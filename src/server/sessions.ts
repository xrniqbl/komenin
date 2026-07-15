"use server";

import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";

export async function listSessions() {
  const { workspace } = await requireActiveWorkspace();
  return db.accountSession.findMany({
    where: { workspaceId: workspace.id },
    include: {
      socialAccount: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSession(sessionId: string) {
  const { workspace } = await requireActiveWorkspace();
  return db.accountSession.findFirst({
    where: { id: sessionId, workspaceId: workspace.id },
    include: {
      socialAccount: {
        include: {
          proxyAssignments: {
            where: { isActive: true },
            include: { proxyEndpoint: true },
          },
          healthChecks: { orderBy: { createdAt: "desc" }, take: 5 },
          rotationLogs: { orderBy: { createdAt: "desc" }, take: 5 },
        },
      },
    },
  });
}
