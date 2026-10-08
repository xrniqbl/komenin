"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { assertWorkspacePermission } from "@/lib/rbac";
import { encryptSecret } from "@/lib/encryption";
import { ensureBuiltinSkills, runSkill } from "@/lib/skills/runtime";
import { assertSafeOutboundUrl, UnsafeUrlError } from "@/lib/url-safety";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { assertAgentInWorkspace } from "@/server/agent-scope";
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

/** Encrypt webhook bearer tokens at rest; never return raw token to list UIs. */
function sealSkillConfig(
  executor: "builtin" | "webhook" | undefined,
  configJson?: Record<string, unknown>,
): Record<string, unknown> {
  const base = { ...(configJson || {}) };
  if ((executor || "builtin") !== "webhook") return base;
  const token = typeof base.token === "string" ? base.token.trim() : "";
  delete base.token;
  if (token) {
    base.tokenEnc = encryptSecret(token);
    base.hasToken = true;
  }
  return base;
}

function redactSkillConfig(configJson: unknown): Record<string, unknown> {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return {};
  }
  const raw = { ...(configJson as Record<string, unknown>) };
  const hasToken = Boolean(raw.tokenEnc) || Boolean(raw.token) || Boolean(raw.hasToken);
  delete raw.token;
  delete raw.tokenEnc;
  if (hasToken) raw.hasToken = true;
  return raw;
}

export async function listSkills() {
  const { workspace } = await requireActiveWorkspace();
  await ensureBuiltinSkills(workspace.id);
  const rows = await db.skill.findMany({
    where: { workspaceId: workspace.id },
    include: {
      triggers: true,
      _count: { select: { runs: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    ...row,
    configJson: redactSkillConfig(row.configJson),
  }));
}

export async function getSkill(id: string) {
  const { workspace } = await requireActiveWorkspace();
  await ensureBuiltinSkills(workspace.id);
  const row = await db.skill.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      triggers: true,
      _count: { select: { runs: true } },
    },
  });
  if (!row) return null;
  return { ...row, configJson: redactSkillConfig(row.configJson) };
}

export async function updateSkill(
  id: string,
  input: {
    name?: string;
    description?: string;
    executor?: "builtin" | "webhook";
    highRisk?: boolean;
    isActive?: boolean;
    triggers?: string[];
    configJson?: Record<string, unknown>;
  },
) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "skills.manage");

  const existing = await db.skill.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Skill not found");

  const executor = input.executor || existing.executor;
  const configJson =
    input.configJson !== undefined
      ? input.configJson
      : (existing.configJson as Record<string, unknown> | null) || {};
  assertSkillWebhookConfig(executor, configJson);
  const sealedConfig = sealSkillConfig(executor, configJson);
  // Preserve the stored token when the editor omits it (it is redacted
  // from list/detail payloads, so a round-trip would otherwise wipe it).
  if (
    executor === "webhook" &&
    input.configJson !== undefined &&
    typeof input.configJson.token !== "string" &&
    !input.configJson.tokenEnc &&
    typeof (existing.configJson as Record<string, unknown> | null)
      ?.tokenEnc === "string"
  ) {
    sealedConfig.tokenEnc = (
      existing.configJson as Record<string, unknown>
    ).tokenEnc;
    sealedConfig.hasToken = true;
  }

  const data: Record<string, unknown> = {
    version: { increment: 1 },
  };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Skill name required");
    data.name = name;
  }
  if (input.description !== undefined) {
    data.description = input.description.trim() || null;
  }
  if (input.executor !== undefined) data.executor = input.executor;
  if (input.highRisk !== undefined) data.highRisk = Boolean(input.highRisk);
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
  if (input.configJson !== undefined) {
    data.configJson = sealedConfig as Prisma.InputJsonValue;
  }

  const triggers =
    input.triggers !== undefined
      ? input.triggers.map((pattern) => pattern.trim()).filter(Boolean)
      : undefined;

  const updated = await db.$transaction(async (tx) => {
    const skill = await tx.skill.update({ where: { id }, data });
    if (triggers !== undefined) {
      await tx.skillTrigger.deleteMany({ where: { skillId: id } });
      if (triggers.length > 0) {
        await tx.skillTrigger.createMany({
          data: triggers.map((pattern) => ({ skillId: id, pattern })),
        });
      }
    }
    return skill;
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "skill.updated",
    resourceType: "skill",
    resourceId: id,
    metadata: { version: updated.version },
  });

  revalidatePath("/app/skills");
  revalidatePath(`/app/skills/${id}`);
  return updated;
}

export async function deleteSkill(id: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "skills.manage");

  const existing = await db.skill.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      _count: { select: { runs: true } },
    },
  });
  if (!existing) throw new Error("Skill not found");

  const activeRuns = await db.skillRun.count({
    where: {
      skillId: id,
      workspaceId: workspace.id,
      status: { in: ["pending", "running"] },
    },
  });
  if (activeRuns > 0) {
    throw new Error(
      `Cannot delete skill with ${activeRuns} active run(s). Wait for them to finish first.`,
    );
  }

  await db.skill.delete({ where: { id } });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "skill.deleted",
    resourceType: "skill",
    resourceId: id,
    metadata: { slug: existing.slug, pastRuns: existing._count.runs },
  });

  revalidatePath("/app/skills");
  return { ok: true };
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
  const sealedConfig = sealSkillConfig(input.executor, input.configJson);

  const skill = await db.skill.create({
    data: {
      workspaceId: workspace.id,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      description: input.description?.trim() || null,
      executor: input.executor || "builtin",
      highRisk: Boolean(input.highRisk),
      configJson: sealedConfig as Prisma.InputJsonValue,
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

export async function listSkillRuns(
  limit = 50,
  filters?: { status?: string; skillId?: string },
) {
  const { workspace } = await requireActiveWorkspace();
  const status = (filters?.status || "").trim();
  const skillId = (filters?.skillId || "").trim();
  const validStatuses = ["pending", "running", "succeeded", "failed", "cancelled"];
  const runs = await db.skillRun.findMany({
    where: {
      workspaceId: workspace.id,
      ...(status && validStatuses.includes(status) ? { status: status as never } : {}),
      ...(skillId ? { skillId } : {}),
    },
    include: {
      skill: true,
      steps: { orderBy: { ordinal: "asc" } },
      agent: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Attach billed AI credits per run. Skills run locally (builtin) or via
  // outbound webhook — they do not call the AI router, so most runs bill 0.
  // Query stays for forward-compat if a future executor records refType skill_run.
  const runIds = runs.map((run) => run.id);
  const usageByRun = new Map<string, bigint>();

  return runs.map((run) => ({
    ...run,
    aiCreditsUsed: (usageByRun.get(run.id) || 0n).toString(),
  }));
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
  await assertAgentInWorkspace(workspace.id, input.agentId);

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

/** Retry a failed/cancelled run by re-executing its skill with the same input. */
export async function retrySkillRun(runId: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "skills.manage");
  const run = await db.skillRun.findFirst({
    where: { id: runId, workspaceId: workspace.id },
    include: { skill: { include: { triggers: true } } },
  });
  if (!run) throw new Error("Skill run not found");
  if (run.status !== "failed" && run.status !== "cancelled") {
    throw new Error("Only failed or cancelled runs can be retried");
  }
  const inputText =
    (run.inputJson as { text?: string } | null)?.text || "";

  const result = await runSkill({
    workspaceId: workspace.id,
    skill: run.skill,
    agentId: run.agentId,
    inputText,
    existingRunId: run.id,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "skill.retried",
    resourceType: "skill_run",
    resourceId: run.id,
    metadata: { ok: result.ok, skillId: run.skillId },
  });

  revalidatePath("/app/runs");
  return result;
}
