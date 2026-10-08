"use server";

import { revalidatePath } from "next/cache";
import { assertWorkspacePermission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import { runWorkerJob } from "@/server/worker-jobs";
import { renderTemplate } from "@/lib/template-engine";
import { resolveAssigneeId } from "@/server/triage";
import { triageSignalsForDrafts, type TriageSignals } from "@/lib/triage-signals";

export type MentionDraftItem = {
  id: string;
  content: string;
  status: string;
  riskFlags: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type MentionListItem = {
  id: string;
  platform: string;
  authorHandle: string;
  content: string;
  parentContent: string;
  url: string | null;
  status: string;
  assigneeId: string | null;
  assignee: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  socialAccount: { id: string; username: string; platform: string } | null;
  drafts: MentionDraftItem[];
  action: { id: string; status: string; executedAt: Date | null } | null;
  receivedAt: Date;
  processedAt: Date | null;
  /** Derived triage signals (risk + overdue) for card display/sort. */
  triage: TriageSignals;
};
/** @deprecated Use MentionListItem. */
export type MentionWithDraft = MentionListItem;

const MENTIONS_PAGE_SIZE = 100;

export type MentionSort = "risk" | "oldest" | "newest";

/**
 * Sort and filter the complete scoped result before cursor pagination.
 * Risk derives from draft flags rather than an indexed mention column, so
 * database pagination before triage would hide high-risk and older items.
 */
export async function listMentions(input?: {
  status?: string;
  assignee?: string;
  /** "high" limits to mentions with a high-risk draft flag. */
  priority?: string;
  sort?: MentionSort;
  cursor?: string;
}) {
  const { workspace } = await requireActiveWorkspace();
  const where: Record<string, unknown> & { workspaceId: string } = {
    workspaceId: workspace.id,
  };
  if (input?.status) where.status = input.status as never;
  if (input?.assignee === "unassigned") where.assigneeId = null;
  else if (input?.assignee) where.assigneeId = input.assignee;

  const rows = await db.mention.findMany({
    where,
    include: {
      socialAccount: { select: { id: true, username: true, platform: true } },
      assignee: { select: { id: true, name: true, email: true, image: true } },
      drafts: {
        select: {
          id: true,
          content: true,
          status: true,
          riskFlags: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      action: { select: { id: true, status: true, executedAt: true } },
    },
    // Risk is derived from draft flags, so it must be evaluated before
    // ordering and paging. No SQL limit can safely hide later high-risk rows.
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
  });

  let items: MentionListItem[] = rows.map((mention) => ({
    id: mention.id,
    platform: mention.platform,
    authorHandle: mention.authorHandle,
    content: mention.content,
    parentContent: mention.parentContent,
    url: mention.url,
    status: mention.status,
    assigneeId: mention.assigneeId,
    assignee: mention.assignee,
    socialAccount: mention.socialAccount,
    drafts: mention.drafts,
    action: mention.action,
    receivedAt: mention.receivedAt,
    processedAt: mention.processedAt,
    triage: triageSignalsForDrafts(mention.drafts),
  }));

  if (input?.priority === "high") {
    items = items.filter((item) => item.triage.highRisk);
  }

  const sort = input?.sort ?? "risk";
  if (sort === "oldest") {
    items.sort(
      (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id),
    );
  } else if (sort === "newest") {
    items.sort(
      (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime() || b.id.localeCompare(a.id),
    );
  } else {
    items.sort((a, b) => {
      if (b.triage.riskScore !== a.triage.riskScore) {
        return b.triage.riskScore - a.triage.riskScore;
      }
      if (a.triage.overdue !== b.triage.overdue) {
        return a.triage.overdue ? -1 : 1;
      }
      return a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id);
    });
  }

  const cursorIndex = input?.cursor ? items.findIndex((item) => item.id === input.cursor) : -1;
  const remaining = input?.cursor ? items.slice(cursorIndex + 1) : items;
  const hasMore = remaining.length > MENTIONS_PAGE_SIZE;
  const page = remaining.slice(0, MENTIONS_PAGE_SIZE);
  return {
    items: page,
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
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

/** Assign a mention to an active workspace member (null = unassign). */
export async function assignMention(input: {
  mentionId: string;
  assigneeId: string | null;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const mention = await db.mention.findFirst({
    where: { id: input.mentionId, workspaceId: workspace.id },
    select: { id: true, assigneeId: true },
  });
  if (!mention) throw new Error("Mention not found");

  const assigneeId = await resolveAssigneeId(workspace.id, input.assigneeId);

  await db.mention.update({
    where: { id: mention.id },
    data: { assigneeId },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "mention.assigned",
    resourceType: "mention",
    resourceId: mention.id,
    metadata: { from: mention.assigneeId, to: assigneeId },
  });

  revalidatePath("/app/mentions");
  return { ok: true, assigneeId };
}

/**
 * Saved reply: render a comment template into a new draft on the mention's
 * anchor post. Creates the draft + pending approval (never auto-sends), so
 * the normal approval flow stays the single send gate.
 */
export async function applyMentionTemplate(input: {
  mentionId: string;
  templateId: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const mention = await db.mention.findFirst({
    where: { id: input.mentionId, workspaceId: workspace.id },
    include: { socialAccount: { select: { id: true } } },
  });
  if (!mention) throw new Error("Mention not found");

  const template = await db.commentTemplate.findFirst({
    where: { id: input.templateId, workspaceId: workspace.id, isActive: true },
  });
  if (!template) throw new Error("Template not found");

  const content = renderTemplate(template.body, {
    authorHandle: mention.authorHandle,
    platform: mention.platform,
    postSnippet: mention.content.slice(0, 140),
    agentName: null,
    topic: mention.parentContent?.slice(0, 140) || null,
  }).trim();
  if (!content) throw new Error("Template renders empty for this mention");

  // Anchor post mirrors the worker pipeline: mention replies key off a
  // synthetic TargetPost for the parent thread.
  const parentExternalId = mention.parentExternalId || mention.externalId;
  const anchorPost = await db.targetPost.upsert({
    where: {
      workspaceId_platform_externalId: {
        workspaceId: workspace.id,
        platform: mention.platform,
        externalId: parentExternalId,
      },
    },
    create: {
      workspaceId: workspace.id,
      platform: mention.platform,
      externalId: parentExternalId,
      authorHandle: mention.authorHandle,
      content: mention.parentContent || mention.content,
      url: mention.url,
      status: "approved",
    },
    update: {},
    select: { id: true },
  });

  const draft = await db.$transaction(async (tx) => {
    const created = await tx.commentDraft.create({
      data: {
        workspaceId: workspace.id,
        targetPostId: anchorPost.id,
        content,
        status: "pending",
        model: "template",
        providerId: "template",
        riskFlags: ["template_reply"],
        mentionId: mention.id,
      },
    });
    await tx.approval.create({
      data: {
        workspaceId: workspace.id,
        targetPostId: anchorPost.id,
        commentDraftId: created.id,
        status: "pending",
      },
    });
    await tx.mention.update({
      where: { id: mention.id },
      data: { status: "drafted", processedAt: new Date() },
    });
    return created;
  });

  await db.commentTemplate.updateMany({
    where: { id: template.id, workspaceId: workspace.id },
    data: { usageCount: { increment: 1 } },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "mention.template_used",
    resourceType: "mention",
    resourceId: mention.id,
    metadata: { templateId: template.id, draftId: draft.id },
  });

  revalidatePath("/app/mentions");
  revalidatePath("/app/approvals");
  return { ok: true, draftId: draft.id };
}

/**
 * Approve a pending mention reply from the mentions inbox. Marks the draft
 * approved and schedules a mention_reply CommentAction from the owning
 * account; the actual send rides the normal comment.send pipeline.
 *
 * With multi-draft support the operator approves one draft explicitly
 * (draftId); when omitted the newest pending draft wins.
 */
export async function approveMentionReply(input: {
  mentionId: string;
  draftId?: string;
  editedContent?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const mention = await db.mention.findFirst({
    where: { id: input.mentionId, workspaceId: workspace.id },
    include: {
      drafts: {
        where: input.draftId ? { id: input.draftId } : { status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      socialAccount: true,
    },
  });
  if (!mention) throw new Error("Mention not found");
  const draft = mention.drafts[0];
  if (mention.status !== "drafted" || !draft) {
    throw new Error("Mention has no pending draft to approve");
  }

  const approval = await db.approval.findFirst({
    where: { commentDraftId: draft.id, status: "pending" },
    select: { id: true },
  });
  if (!approval) throw new Error("No pending approval for this draft");

  const accountId = mention.socialAccount?.id || null;
  if (!accountId) {
    throw new Error(
      "Cannot approve: mention is not linked to a social account. Connect the account first.",
    );
  }

  const finalContent = input.editedContent?.trim() || draft.content;
  const scheduledFor = new Date(Date.now() + 45 * 1000);

  await db.$transaction(async (tx) => {
    await tx.approval.update({
      where: { id: approval.id },
      data: { status: "approved", decidedAt: new Date(), decisionNote: "Approved from mentions" },
    });
    await tx.commentDraft.update({
      where: { id: draft.id },
      data: { status: "approved", content: finalContent },
    });
    await tx.commentAction.create({
      data: {
        workspaceId: workspace.id,
        targetPostId: draft.targetPostId,
        commentDraftId: draft.id,
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
    metadata: { draftId: draft.id },
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
