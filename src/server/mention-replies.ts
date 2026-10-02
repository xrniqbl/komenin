"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import { runWorkerJob } from "@/server/worker-jobs";

export type MentionListItem = Awaited<
  ReturnType<typeof listMentions>
>["items"][number];
/** @deprecated Use MentionListItem. */
export type MentionWithDraft = MentionListItem;

const MENTIONS_PAGE_SIZE = 100;

/**
 * Inbox listing with a truncation signal: the query fetches one extra row so
 * `hasMore` tells the UI there are older mentions beyond this page instead of
 * silently hiding them.
 */
export async function listMentions(input?: { status?: string; cursor?: string }) {
  const { workspace } = await requireActiveWorkspace();
  const where: Record<string, unknown> & { workspaceId: string } = {
    workspaceId: workspace.id,
  };
  if (input?.status) where.status = input.status as never;

  const rows = await db.mention.findMany({
    where,
    include: {
      socialAccount: { select: { id: true, username: true, platform: true } },
      draft: { select: { id: true, content: true, status: true } },
      action: { select: { id: true, status: true, executedAt: true } },
    },
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    take: MENTIONS_PAGE_SIZE + 1,
    ...(input?.cursor
      ? { cursor: { id: input.cursor }, skip: 1 }
      : {}),
  });

  const hasMore = rows.length > MENTIONS_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, MENTIONS_PAGE_SIZE) : rows;
  return {
    items,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function getAutoReplySettings() {
  const { workspace } = await requireActiveWorkspace();
  const settings = await db.autoReplySettings.findUnique({
    where: { workspaceId: workspace.id },
    include: { agent: { select: { id: true, name: true } } },
  });
  return settings;
}

export async function updateAutoReplySettings(input: {
  enabled: boolean;
  agentId?: string | null;
  mode?: "approval_required" | "auto";
  maxRepliesPerDay?: number;
  quietHoursApply?: boolean;
  /** Static reply template; when non-empty it overrides AI generation (F3). */
  templateText?: string | null;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "settings.manage");

  const agentId = input.agentId?.trim() || null;
  if (agentId) {
    const agent = await db.agent.findFirst({
      where: { id: agentId, workspaceId: workspace.id },
      select: { id: true },
    });
    if (!agent) throw new Error("Agent not found");
  }

  const mode =
    input.mode === "auto" || input.mode === "approval_required"
      ? input.mode
      : "approval_required";
  const maxRepliesPerDay = Math.min(500, Math.max(1, input.maxRepliesPerDay ?? 20));
  // Trim; null/empty clears the template so AI generation resumes.
  const templateText = input.templateText?.trim() || null;

  const saved = await db.autoReplySettings.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      enabled: input.enabled,
      agentId,
      mode,
      maxRepliesPerDay,
      quietHoursApply: input.quietHoursApply ?? true,
      templateText,
    },
    update: {
      enabled: input.enabled,
      agentId,
      mode,
      maxRepliesPerDay,
      quietHoursApply: input.quietHoursApply ?? true,
      templateText,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "auto_reply.settings_updated",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: {
      enabled: saved.enabled,
      mode: saved.mode,
      agentId: saved.agentId,
      maxRepliesPerDay: saved.maxRepliesPerDay,
      hasTemplate: Boolean(saved.templateText),
    },
  });

  revalidatePath("/app/mentions");
  revalidatePath("/app/settings/publisher");
  return saved;
}

/** Ignore a mention without generating a reply (operator triage). */
export async function ignoreMention(mentionId: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const mention = await db.mention.findFirst({
    where: { id: mentionId, workspaceId: workspace.id },
    select: { id: true, status: true },
  });
  if (!mention) throw new Error("Mention not found");

  await db.mention.update({
    where: { id: mention.id },
    data: { status: "ignored", processedAt: new Date() },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "mention.ignored",
    resourceType: "mention",
    resourceId: mention.id,
  });

  revalidatePath("/app/mentions");
  return { ok: true };
}

/**
 * Approve a pending mention reply from the mentions inbox. Marks the draft
 * approved and schedules a mention_reply CommentAction from the owning
 * account; the actual send rides the normal comment.send pipeline.
 */
export async function approveMentionReply(input: {
  mentionId: string;
  editedContent?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const mention = await db.mention.findFirst({
    where: { id: input.mentionId, workspaceId: workspace.id },
    include: {
      draft: true,
      socialAccount: true,
    },
  });
  if (!mention) throw new Error("Mention not found");
  if (mention.status !== "drafted" || !mention.draft) {
    throw new Error("Mention has no pending draft to approve");
  }

  const approval = await db.approval.findFirst({
    where: { commentDraftId: mention.draft.id, status: "pending" },
    select: { id: true },
  });
  if (!approval) throw new Error("No pending approval for this draft");

  const accountId = mention.socialAccount?.id || null;
  if (!accountId) {
    throw new Error(
      "Cannot approve: mention is not linked to a social account. Connect the account first.",
    );
  }

  const finalContent = input.editedContent?.trim() || mention.draft.content;
  const scheduledFor = new Date(Date.now() + 45 * 1000);

  await db.$transaction(async (tx) => {
    await tx.approval.update({
      where: { id: approval.id },
      data: { status: "approved", decidedAt: new Date(), decisionNote: "Approved from mentions" },
    });
    await tx.commentDraft.update({
      where: { id: mention.draft!.id },
      data: { status: "approved", content: finalContent },
    });
    await tx.commentAction.create({
      data: {
        workspaceId: workspace.id,
        targetPostId: mention.draft!.targetPostId,
        commentDraftId: mention.draft!.id,
        socialAccountId: accountId,
        status: "scheduled",
        scheduledFor,
        resultMessage: `Mention reply scheduled with 45s human-like delay`,
        source: "mention_reply",
        // Reply target is the mention comment itself — replying to the media
        // id would post a new top-level comment instead of a threaded reply.
        replyToExternalId: mention.externalId,
        replyToAuthor: mention.authorHandle,
        mentionId: mention.id,
      },
    });
    await tx.mention.update({
      where: { id: mention.id },
      data: { status: "approved", processedAt: new Date() },
    });
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "mention.reply_approved",
    resourceType: "mention",
    resourceId: mention.id,
  });

  revalidatePath("/app/mentions");
  revalidatePath("/app/activity");
  return { ok: true };
}

/** Manual trigger for the mention pipeline (button on /app/mentions). */
export async function runMentionProcessNow() {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const result = await runWorkerJob("mention.process");
  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "mention.manual_run",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: { ok: result.ok, message: result.message, count: result.count ?? 0 },
  });
  revalidatePath("/app/mentions");
  return { ok: result.ok, message: result.message, count: result.count ?? 0 };
}
