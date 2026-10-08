"use server";

import { db } from "@/lib/db";
import { scanContentRisk } from "@/lib/risk-scanner";
import { requireActiveWorkspace } from "@/server/workspace-access";

/**
 * Fresh risk scan for card display when an item has no drafts yet (e.g. an
 * unprocessed mention). Runs in-process against workspace risk rules; cheap
 * enough for a 100-row page because it loads rules once.
 */
export async function triageScoreForText(
  workspaceId: string,
  text: string,
  postContent?: string,
): Promise<{ riskScore: number; highRisk: boolean }> {
  const rules = await db.riskRule.findMany({
    where: { workspaceId, isActive: true },
    select: { type: true, pattern: true, severity: true },
    take: 100,
  });
  const result = scanContentRisk({
    text,
    postContent,
    customRules: rules.map((rule, index) => ({
      id: String(index),
      type: rule.type,
      pattern: rule.pattern,
      severity: rule.severity,
      isActive: true,
    })),
  });
  return {
    riskScore: result.riskScore,
    highRisk:
      result.blocked ||
      result.details.some((flag) => flag.severity === "high"),
  };
}

/** Active workspace members for the assignee picker (id, name, email, image). */
export async function listWorkspaceAssignees() {
  const { workspace } = await requireActiveWorkspace();
  const memberships = await db.membership.findMany({
    where: { workspaceId: workspace.id, status: "active" },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return memberships.map((membership) => ({
    id: membership.user.id,
    name: membership.user.name,
    email: membership.user.email,
    image: membership.user.image,
    role: membership.role,
  }));
}

/**
 * Validate an assignee id against active membership of THIS workspace.
 * Returns null for "unassign". Throws when the id is not a member — mirrors
 * the leads owner guard so operators cannot attribute work to foreign users.
 */
export async function resolveAssigneeId(
  workspaceId: string,
  assigneeId: string | null | undefined,
): Promise<string | null> {
  const trimmed = assigneeId?.trim() || null;
  if (!trimmed) return null;
  const member = await db.membership.findFirst({
    where: { userId: trimmed, workspaceId, status: "active" },
    select: { userId: true },
  });
  if (!member) {
    throw new Error("Assignee must be an active member of this workspace");
  }
  return member.userId;
}
