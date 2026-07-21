"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { assertWorkspacePermission } from "@/lib/rbac";
import { ensureBuiltinSkills, runSkill } from "@/lib/skills/runtime";
import { assertSafeOutboundUrl, UnsafeUrlError } from "@/lib/url-safety";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";

function assertSkillWebhookConfig(
  executor: "builtin" | "webhook" | undefined,
  configJson?: Record<string, unknown>,
) {
  if ((executor || "builtin") !== "webhook") return;
  const url = typeof configJson?.url === "string" ? configJson.url : "";
  if (!url.trim()) throw new Error("Webhook skill requires configJson.url");
  try {
    assertSafeOutboundUrl(url);
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw new Error(error.message);
    throw new Error("Invalid webhook skill URL");
  }
}

export async function listSkills() {
  const { workspace } = await requireActiveWorkspace();
  await ensureBuiltinSkills(workspace.id);
  return db.skill.findMany({
    where: { workspaceId: workspace.id },
    include: {
      triggers: true,
      _count: { select: { runs: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSkill(input: {
  name: string;
  slug: string;
  description?: string;
  executor?: "builtin" | "webhook";
  highRisk?: boolean;
  triggers?: string[];
  configJson?: Record<string, unknown>;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "skills.manage");
  assertSkillWebhookConfig(input.executor, input.configJson);

  const skill = await db.skill.create({
    data: {
      workspaceId: workspace.id,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      description: input.description?.trim() || null,
      executor: input.executor || "builtin",
      highRisk: Boolean(input.highRisk),
      configJson: (input.configJson ?? {}) as Prisma.InputJsonValue,
      triggers: {
        create: (input.triggers || [])
          .map((pattern) => pattern.trim())
          .filter(Boolean)
          .map((pattern) => ({ pattern })),
      },
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "skill.created",
    resourceType: "skill",
    resourceId: skill.id,
  });

  revalidatePath("/app/skills");
  return skill;
}

export async function listSkillRuns(limit = 50) {
  const { workspace } = await requireActiveWorkspace();
  return db.skillRun.findMany({
    where: { workspaceId: workspace.id },
    include: {
      skill: true,
      steps: { orderBy: { ordinal: "asc" } },
      agent: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function executeSkillNow(input: {
  skillId: string;
  inputText: string;
  agentId?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "skills.manage");
  const skill = await db.skill.findFirst({
    where: { id: input.skillId, workspaceId: workspace.id },
    include: { triggers: true },
  });
  if (!skill) throw new Error("Skill not found");

  const result = await runSkill({
    workspaceId: workspace.id,
    skill,
    agentId: input.agentId,
    inputText: input.inputText,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "skill.executed",
    resourceType: "skill_run",
    resourceId: result.runId,
    metadata: { ok: result.ok, skillId: skill.id },
  });

  revalidatePath("/app/skills");
  revalidatePath("/app/runs");
  return result;
}
