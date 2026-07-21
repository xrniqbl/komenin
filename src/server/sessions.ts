"use server";

import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";

/** Public session fields — never return encryptedBlob to the UI layer. */
const sessionSafeSelect = {
  id: true,
  workspaceId: true,
  socialAccountId: true,
  userAgent: true,
  fingerprintJson: true,
  isActive: true,
  keyVersion: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listSessions() {
  const { workspace } = await requireActiveWorkspace();
  return db.accountSession.findMany({
    where: { workspaceId: workspace.id },
    select: {
      ...sessionSafeSelect,
      socialAccount: {
        select: {
          id: true,
          username: true,
          platform: true,
          status: true,
          displayName: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSession(sessionId: string) {
  const { workspace } = await requireActiveWorkspace();
  return db.accountSession.findFirst({
    where: { id: sessionId, workspaceId: workspace.id },
    select: {
      ...sessionSafeSelect,
      // encryptedBlob intentionally omitted
      socialAccount: {
        select: {
          id: true,
          username: true,
          platform: true,
          status: true,
          displayName: true,
          proxyAssignments: {
            where: { isActive: true },
            select: {
              id: true,
              proxyEndpoint: {
                select: {
                  id: true,
                  label: true,
                  protocol: true,
                  host: true,
                  port: true,
                  isHealthy: true,
                  lastIp: true,
                  // usernameEnc / passwordEnc omitted
                },
              },
            },
          },
          healthChecks: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              ok: true,
              signal: true,
              latencyMs: true,
              details: true,
              createdAt: true,
            },
          },
          rotationLogs: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              fromIp: true,
              toIp: true,
              reason: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
}
