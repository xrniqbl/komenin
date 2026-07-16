"use server";

import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import { generateContextualCommentHybrid } from "@/lib/comment-engine";
import { rankChunks } from "@/lib/knowledge/retrieve";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";
import { writeAuditLog } from "@/server/audit";

export async function listAgents() {
  const { workspace } = await requireActiveWorkspace();
  return db.agent.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: {
        select: {
          knowledgeDocuments: true,
          memoryEntries: true,
          campaigns: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAgent(agentId: string) {
  const { workspace } = await requireActiveWorkspace();
  return db.agent.findFirst({
    where: { id: agentId, workspaceId: workspace.id },
    include: {
      guardrails: true,
      knowledgeDocuments: { orderBy: { createdAt: "desc" }, take: 20 },
      memoryEntries: { orderBy: { updatedAt: "desc" }, take: 20 },
    },
  });
}

export async function ensureDefaultAgent() {
  const { userId, workspace } = await requireActiveWorkspace();
  const existing = await db.agent.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const agent = await db.agent.create({
    data: {
      workspaceId: workspace.id,
      name: "Sales Assist",
      tone: "professional",
      language: "id",
      systemPrompt:
        "Kamu asisten engagement brand. Tulis komentar relevan, sopan, dan tidak spam.",
      status: "active",
      guardrails: {
        create: [
          { workspaceId: workspace.id, key: "no_spam", value: "true" },
          { workspaceId: workspace.id, key: "max_sentences", value: "3" },
        ],
      },
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "agent.created_default",
    resourceType: "agent",
    resourceId: agent.id,
  });

  revalidatePath("/app/agents");
  return agent;
}

export async function createAgent(input: {
  name: string;
  tone?: string;
  language?: string;
  systemPrompt?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "agents.manage");

  const agent = await db.agent.create({
    data: {
      workspaceId: workspace.id,
      name: input.name.trim(),
      tone: input.tone?.trim() || "professional",
      language: input.language?.trim() || "id",
      systemPrompt:
        input.systemPrompt?.trim() ||
        "Kamu asisten engagement brand. Tulis komentar relevan, sopan, dan tidak spam.",
      status: "active",
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "agent.created",
    resourceType: "agent",
    resourceId: agent.id,
  });

  revalidatePath("/app/agents");
  return agent;
}

export async function updateAgent(input: {
  agentId: string;
  name?: string;
  tone?: string;
  language?: string;
  systemPrompt?: string;
  status?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "agents.manage");
  const existing = await db.agent.findFirst({
    where: { id: input.agentId, workspaceId: workspace.id },
  });
  if (!existing) throw new Error("Agent not found");

  const agent = await db.agent.update({
    where: { id: existing.id },
    data: {
      name: input.name?.trim() || existing.name,
      tone: input.tone?.trim() || existing.tone,
      language: input.language?.trim() || existing.language,
      systemPrompt: input.systemPrompt?.trim() || existing.systemPrompt,
      status: input.status?.trim() || existing.status,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "agent.updated",
    resourceType: "agent",
    resourceId: agent.id,
  });

  revalidatePath("/app/agents");
  revalidatePath(`/app/agents/${agent.id}`);
  return agent;
}

export async function addKnowledgeDocument(input: {
  agentId?: string;
  title: string;
  rawText: string;
  sourceType?: string;
  sourceUrl?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "agents.manage");

  const doc = await db.knowledgeDocument.create({
    data: {
      workspaceId: workspace.id,
      agentId: input.agentId || null,
      title: input.title.trim(),
      rawText: input.rawText.trim(),
      sourceType: input.sourceType || "text",
      sourceUrl: input.sourceUrl || null,
      status: "pending",
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "knowledge.created",
    resourceType: "knowledge_document",
    resourceId: doc.id,
  });

  revalidatePath("/app/agents");
  if (input.agentId) revalidatePath(`/app/agents/${input.agentId}`);
  return doc;
}

export async function addMemoryEntry(input: {
  agentId?: string;
  entityType: string;
  entityKey: string;
  fact: string;
  confidence?: number;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "agents.manage");

  const entry = await db.memoryEntry.create({
    data: {
      workspaceId: workspace.id,
      agentId: input.agentId || null,
      entityType: input.entityType.trim(),
      entityKey: input.entityKey.trim(),
      fact: input.fact.trim(),
      confidence: input.confidence ?? 0.7,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "memory.created",
    resourceType: "memory_entry",
    resourceId: entry.id,
  });

  revalidatePath("/app/agents");
  return entry;
}

export async function runAgentPlayground(input: {
  agentId: string;
  postContent: string;
}) {
  const { workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "agents.manage");
  const agent = await db.agent.findFirst({
    where: { id: input.agentId, workspaceId: workspace.id },
  });
  if (!agent) throw new Error("Agent not found");

  const chunks = await db.knowledgeChunk.findMany({
    where: {
      workspaceId: workspace.id,
      document: {
        status: "ready",
        OR: [{ agentId: agent.id }, { agentId: null }],
      },
    },
    take: 40,
  });
  const ranked = rankChunks(
    input.postContent,
    chunks.map((chunk) => ({ id: chunk.id, content: chunk.content })),
    3,
  );

  const draft = await generateContextualCommentHybrid({
    postContent: input.postContent,
    language: agent.language,
    tone: agent.tone,
    systemPrompt: agent.systemPrompt,
    agentName: agent.name,
    knowledgeContext: ranked.map((item) => item.content),
  });

  return {
    draft,
    citations: ranked,
  };
}
