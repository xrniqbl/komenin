// Plain module — deliberately NOT "use server". This is an internal guard
// used by server actions; exporting it from a "use server" file would make it
// remotely callable.

import { db } from "@/lib/db";

/**
 * Reject cross-workspace agent references before they are attached to rows
 * (skills, risk rules, knowledge, memory). Without this check a member could
 * store another workspace's agentId on their own rows, polluting referential
 * integrity. The message starts with the "Invalid " prefix so it passes the
 * vetted client-error allowlist in src/lib/api-route.ts.
 */
export async function assertAgentInWorkspace(
  workspaceId: string,
  agentId?: string | null,
): Promise<void> {
  if (!agentId) return;
  const agent = await db.agent.findFirst({
    where: { id: agentId, workspaceId },
    select: { id: true },
  });
  if (!agent) throw new Error("Invalid agent for this workspace");
}
