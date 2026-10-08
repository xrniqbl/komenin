"use server";

import { revalidatePath } from "next/cache";
import { dailyActionIncrementData } from "@/lib/account-quota";
import { assertWorkspacePermission } from "@/lib/rbac";
import { generateContextualCommentHybrid, pickDelaySeconds } from "@/lib/comment-engine";
import { getPlatformGuardrail } from "@/lib/platform-rate-limits";

/** Approval→send delay floored at the platform safe interval so a campaign
 *  configured with a tiny delay cannot look like a spam burst. */
function pacedDelay(campaign: { minDelaySec?: number | null; maxDelaySec?: number | null; platform?: string | null } | null | undefined): number {
  const guardrail = getPlatformGuardrail(campaign?.platform);
  return pickDelaySeconds(
    Math.max(campaign?.minDelaySec ?? 180, guardrail.comments.minIntervalSec),
    Math.max(campaign?.maxDelaySec ?? 600, campaign?.minDelaySec ?? 180, guardrail.comments.minIntervalSec),
  );
}
import { db } from "@/lib/db";
import { runWorkerJob } from "@/server/worker-jobs";
import { renderTemplate } from "@/lib/template-engine";
import { claimTargetPost } from "@/lib/worker-claims";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import { resolveAssigneeId } from "@/server/triage";
import { triageSignalsForDrafts, type TriageSignals } from "@/lib/triage-signals";

export type InboxDraftItem = {
  id: string;
  content: string;
  status: string;
  riskFlags: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type InboxItem = {
  id: string;
  platform: string;
  authorHandle: string;
  content: string;
  url: string | null;
  status: string;
  assigneeId: string | null;
  assignee: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  drafts: InboxDraftItem[];
  campaign: { id: string; name: string } | null;
  listener: { id: string; query: string } | null;
  discoveredAt: Date;
  /** Derived triage signals (risk + overdue) for card display/sort. */
  triage: TriageSignals;
};

export type InboxSort = "risk" | "oldest" | "newest";

export async function listInbox(input?: {
  status?: string;
  platform?: string;
  q?: string;
  assignee?: string;
  /** "high" limits to posts with a high-risk draft flag. */
  priority?: string;
  sort?: InboxSort;
  onlyDrafted?: boolean;
  onlyUndrafted?: boolean;
}): Promise<InboxItem[]> {
  const { workspace } = await requireActiveWorkspace();
  const where: Record<string, unknown> & { workspaceId: string } = {
    workspaceId: workspace.id,
  };
  if (input?.status) where.status = input.status as never;
  if (input?.platform) where.platform = input.platform as never;
  if (input?.assignee === "unassigned") where.assigneeId = null;
  else if (input?.assignee) where.assigneeId = input.assignee;
  if (input?.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { authorHandle: { contains: q, mode: "insensitive" as const } },
      { content: { contains: q, mode: "insensitive" as const } },
    ];
  }
  const rows = await db.targetPost.findMany({
    where,
    include: {
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
      campaign: { select: { id: true, name: true } },
      listener: { select: { id: true, query: true } },
    },
    orderBy: { discoveredAt: "desc" },
    take: 50,
  });

  let items: InboxItem[] = rows.map((post) => ({
    id: post.id,
    platform: post.platform,
    authorHandle: post.authorHandle,
    content: post.content,
    url: post.url,
    status: post.status,
    assigneeId: post.assigneeId,
    assignee: post.assignee,
    drafts: post.drafts,
    campaign: post.campaign,
    listener: post.listener,
    discoveredAt: post.discoveredAt,
    triage: triageSignalsForDrafts(post.drafts),
  }));

  if (input?.priority === "high") {
    items = items.filter((item) => item.triage.highRisk);
  }
  if (input?.onlyDrafted) items = items.filter((item) => item.drafts.length > 0);
  if (input?.onlyUndrafted) items = items.filter((item) => item.drafts.length === 0);

  const sort = input?.sort ?? "risk";
  if (sort === "oldest") {
    items.sort((a, b) => a.discoveredAt.getTime() - b.discoveredAt.getTime());
  } else if (sort === "newest") {
    items.sort((a, b) => b.discoveredAt.getTime() - a.discoveredAt.getTime());
  } else {
    items.sort((a, b) => {
      if (b.triage.riskScore !== a.triage.riskScore) {
        return b.triage.riskScore - a.triage.riskScore;
      }
      if (a.triage.overdue !== b.triage.overdue) {
        return a.triage.overdue ? -1 : 1;
      }
      return a.discoveredAt.getTime() - b.discoveredAt.getTime();
    });
  }

  return items;
}

/** Assign a target post to an active workspace member (null = unassign). */
export async function assignTargetPost(input: {
  postId: string;
  assigneeId: string | null;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const post = await db.targetPost.findFirst({
    where: { id: input.postId, workspaceId: workspace.id },
    select: { id: true, assigneeId: true },
  });
  if (!post) throw new Error("Post not found");

  const assigneeId = await resolveAssigneeId(workspace.id, input.assigneeId);

  await db.targetPost.update({
    where: { id: post.id },
    data: { assigneeId },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "inbox.assigned",
    resourceType: "targetPost",
    resourceId: post.id,
    metadata: { from: post.assigneeId, to: assigneeId },
  });

  revalidatePath("/app/inbox");
  return { ok: true, assigneeId };
}

/**
 * Saved reply for inbox: render a comment template into a new draft on the
 * post. Creates the draft + pending approval (never auto-sends), so the
 * normal approval flow stays the single send gate.
 */
export async function applyInboxTemplate(input: {
  postId: string;
  templateId: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const post = await db.targetPost.findFirst({
    where: { id: input.postId, workspaceId: workspace.id },
    include: { campaign: { select: { id: true, agentId: true } } },
  });
  if (!post) throw new Error("Post not found");

  const template = await db.commentTemplate.findFirst({
    where: { id: input.templateId, workspaceId: workspace.id, isActive: true },
  });
  if (!template) throw new Error("Template not found");

  const content = renderTemplate(template.body, {
    authorHandle: post.authorHandle,
    platform: post.platform,
    postSnippet: post.content.slice(0, 140),
    agentName: null,
    topic: null,
  }).trim();
  if (!content) throw new Error("Template renders empty for this post");

  const draft = await db.$transaction(async (tx) => {
    const created = await tx.commentDraft.create({
      data: {
        workspaceId: workspace.id,
        campaignId: post.campaignId,
        targetPostId: post.id,
        agentId: post.campaign?.agentId,
        content,
        status: "pending",
        model: "template",
        providerId: "template",
        riskFlags: ["template_reply"],
      },
    });
    await tx.approval.create({
      data: {
        workspaceId: workspace.id,
        campaignId: post.campaignId,
        targetPostId: post.id,
        commentDraftId: created.id,
        status: "pending",
      },
    });
    await tx.targetPost.update({
      where: { id: post.id },
      data: { status: "drafted" },
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
    action: "inbox.template_used",
    resourceType: "targetPost",
    resourceId: post.id,
    metadata: { templateId: template.id, draftId: draft.id },
  });

  revalidatePath("/app/inbox");
  revalidatePath("/app/approvals");
  return { ok: true, draftId: draft.id };
}

/** Status values accepted by the approvals queue `?status=` URL filter. */
function normalizeApprovalStatus(raw?: string): "pending" | "approved" | "rejected" | undefined {
  if (!raw || raw === "pending") return "pending";
  if (raw === "all") return undefined;
  if (raw === "approved" || raw === "rejected") return raw;
  return "pending";
}

export async function listApprovals(input?: {
  status?: string;
  campaignId?: string;
}) {
  const { workspace } = await requireActiveWorkspace();
  const status = normalizeApprovalStatus(input?.status);
  const campaignId = input?.campaignId?.trim() || undefined;
  return db.approval.findMany({
    where: {
      workspaceId: workspace.id,
      ...(status ? { status } : {}),
      ...(campaignId ? { campaignId } : {}),
    },
    include: {
      targetPost: true,
      commentDraft: true,
      campaign: true,
    },
    // Oldest first: the queue is triaged as an SLA backlog, so the items
    // waiting longest surface at the top.
    orderBy: { createdAt: "asc" },
    take: 200,
  });
}

/** Distinct campaigns that have at least one approval — options for the
 *  queue `?campaign=` URL filter. */
export async function listApprovalCampaigns() {
  const { workspace } = await requireActiveWorkspace();
  return db.campaign.findMany({
    where: { workspaceId: workspace.id, approvals: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listActivity() {
  const { workspace } = await requireActiveWorkspace();
  return db.commentAction.findMany({
    where: { workspaceId: workspace.id },
    include: {
      targetPost: true,
      campaign: true,
      socialAccount: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function generateDraftsForCampaign(campaignId: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId: workspace.id },
    include: { agent: true },
  });
  if (!campaign) throw new Error("Campaign not found");

  const posts = await db.targetPost.findMany({
    where: {
      workspaceId: workspace.id,
      campaignId,
      status: "new",
    },
    orderBy: { discoveredAt: "desc" },
    take: 10,
  });

  let created = 0;
  for (const post of posts) {
    // Atomic claim so a concurrent manual run and the worker cannot both
    // generate a draft for the same post.
    const claimed = await claimTargetPost(post.id);
    if (!claimed) continue;
    const generated = await generateContextualCommentHybrid({
      postContent: post.content,
      goal: campaign.goal,
      tone: campaign.agent?.tone,
      agentName: campaign.agent?.name,
      systemPrompt: campaign.agent?.systemPrompt,
      language: campaign.agent?.language,
      workspaceId: workspace.id,
      preferredProviderId: campaign.agent?.aiProviderId,
      preferredModel: campaign.agent?.model,
      temperature: campaign.agent?.temperature,
      maxTokens: campaign.agent?.maxTokens,
      style: campaign.agent?.style,
      formality: campaign.agent?.formality,
      emojiPolicy: campaign.agent?.emojiPolicy,
      ctaStyle: campaign.agent?.ctaStyle,
      maxSentences: campaign.agent?.maxSentences,
      bannedTopics: campaign.agent?.bannedTopics,
      mustInclude: campaign.agent?.mustInclude,
    });

    await db.$transaction(async (tx) => {
      const draft = await tx.commentDraft.create({
        data: {
          workspaceId: workspace.id,
          campaignId: campaign.id,
          targetPostId: post.id,
          agentId: campaign.agentId,
          content: generated.content,
          status: "pending",
          riskFlags: generated.riskFlags,
        },
      });

      await tx.approval.create({
        data: {
          workspaceId: workspace.id,
          campaignId: campaign.id,
          targetPostId: post.id,
          commentDraftId: draft.id,
          status: "pending",
        },
      });

      await tx.targetPost.update({
        where: { id: post.id },
        data: { status: "drafted" },
      });
    });

    created += 1;
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "comment.drafts_generated",
    resourceType: "campaign",
    resourceId: campaign.id,
    metadata: { created },
  });

  if (created > 0) {
    try {
      const { dispatchExternal } = await import("@/lib/notify/dispatcher");
      await dispatchExternal("approval.new", workspace.id, {
        title: `${created} new approval${created === 1 ? "" : "s"} ready`,
        body: `Campaign “${campaign.name}” generated drafts waiting for review.`,
        href: "/app/approvals",
      });
    } catch {
      // non-fatal outbound webhook
    }
  }

  revalidatePath("/app/campaigns");
  revalidatePath(`/app/campaigns/${campaignId}`);
  revalidatePath("/app/approvals");
  revalidatePath("/app/inbox");
  return { created };
}

/** Generate a single draft for an individual target post from the inbox.
 *  Used when a post has no draft yet and the user wants one on demand. */
export async function generateDraftForPost(postId: string) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const post = await db.targetPost.findFirst({
    where: { id: postId, workspaceId: workspace.id },
    include: { campaign: { include: { agent: true } } },
  });
  if (!post) throw new Error("Post not found");
  if (post.status !== "new") throw new Error("Post already has a draft or was processed");

  const claimed = await claimTargetPost(post.id);
  if (!claimed) throw new Error("Post is being processed");

  const campaign = post.campaign;
  const generated = await generateContextualCommentHybrid({
    postContent: post.content,
    goal: campaign?.goal,
    tone: campaign?.agent?.tone,
    agentName: campaign?.agent?.name,
    systemPrompt: campaign?.agent?.systemPrompt,
    language: campaign?.agent?.language,
    workspaceId: workspace.id,
    preferredProviderId: campaign?.agent?.aiProviderId,
    preferredModel: campaign?.agent?.model,
    temperature: campaign?.agent?.temperature,
    maxTokens: campaign?.agent?.maxTokens,
    style: campaign?.agent?.style,
    formality: campaign?.agent?.formality,
    emojiPolicy: campaign?.agent?.emojiPolicy,
    ctaStyle: campaign?.agent?.ctaStyle,
    maxSentences: campaign?.agent?.maxSentences,
    bannedTopics: campaign?.agent?.bannedTopics,
    mustInclude: campaign?.agent?.mustInclude,
  });

  await db.$transaction(async (tx) => {
    const draft = await tx.commentDraft.create({
      data: {
        workspaceId: workspace.id,
        campaignId: campaign?.id,
        targetPostId: post.id,
        agentId: campaign?.agentId,
        content: generated.content,
        status: "pending",
        riskFlags: generated.riskFlags,
      },
    });

    await tx.approval.create({
      data: {
        workspaceId: workspace.id,
        campaignId: campaign?.id,
        targetPostId: post.id,
        commentDraftId: draft.id,
        status: "pending",
      },
    });

    await tx.targetPost.update({
      where: { id: post.id },
      data: { status: "drafted" },
    });
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "comment.draft_generated",
    resourceType: "targetPost",
    resourceId: post.id,
    metadata: { campaignId: campaign?.id },
  });

  revalidatePath("/app/approvals");
  revalidatePath("/app/inbox");
  return { ok: true };
}

export async function decideApproval(input: {
  approvalId: string;
  decision: "approved" | "rejected";
  editedContent?: string;
  note?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const approval = await db.approval.findFirst({
    where: { id: input.approvalId, workspaceId: workspace.id },
    include: {
      commentDraft: true,
      campaign: { include: { accounts: true } },
      targetPost: true,
    },
  });
  if (!approval) throw new Error("Approval not found");
  if (approval.status !== "pending") throw new Error("Approval already decided");

  if (input.decision === "rejected") {
    await db.$transaction(async (tx) => {
      await tx.approval.update({
        where: { id: approval.id },
        data: {
          status: "rejected",
          decisionNote: input.note || "Rejected by operator",
          decidedAt: new Date(),
        },
      });
      await tx.commentDraft.update({
        where: { id: approval.commentDraftId },
        data: { status: "rejected" },
      });
      await tx.targetPost.update({
        where: { id: approval.targetPostId },
        data: { status: "skipped" },
      });
    });
  } else {
    const finalContent = input.editedContent?.trim() || approval.commentDraft.content;
    const accountId = approval.campaign?.accounts[0]?.socialAccountId || null;
    if (!accountId) {
      throw new Error(
        "Cannot approve: campaign has no linked social account. Attach an account on the campaign first.",
      );
    }
    const delay = pacedDelay(approval.campaign);
    const scheduledFor = new Date(Date.now() + delay * 1000);

    await db.$transaction(async (tx) => {
      await tx.approval.update({
        where: { id: approval.id },
        data: {
          status: "approved",
          decisionNote: input.note || "Approved",
          decidedAt: new Date(),
        },
      });
      await tx.commentDraft.update({
        where: { id: approval.commentDraftId },
        data: { status: "approved", content: finalContent },
      });
      await tx.commentAction.create({
        data: {
          workspaceId: workspace.id,
          campaignId: approval.campaignId,
          targetPostId: approval.targetPostId,
          commentDraftId: approval.commentDraftId,
          socialAccountId: accountId,
          status: "scheduled",
          resultMessage: `Scheduled with ${delay}s human-like delay`,
          scheduledFor,
        },
      });
      await tx.targetPost.update({
        where: { id: approval.targetPostId },
        data: { status: "approved" },
      });
    });
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: `approval.${input.decision}`,
    resourceType: "approval",
    resourceId: approval.id,
  });

  revalidatePath("/app/approvals");
  revalidatePath("/app/activity");
  revalidatePath("/app/inbox");
  revalidatePath("/app");
  return { ok: true };
}

export async function bulkDecideApprovals(input: {
  approvalIds: string[];
  decision: "approved" | "rejected";
  note?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  if (input.approvalIds.length === 0) return { processed: 0 };
  if (input.approvalIds.length > 100) throw new Error("Bulk limit is 100");

  let approved = 0;
  let rejected = 0;

  for (const approvalId of input.approvalIds) {
    const approval = await db.approval.findFirst({
      where: { id: approvalId, workspaceId: workspace.id },
      include: {
        commentDraft: true,
        campaign: { include: { accounts: true } },
        targetPost: true,
      },
    });
    if (!approval || approval.status !== "pending") continue;

    if (input.decision === "rejected") {
      await db.$transaction(async (tx) => {
        await tx.approval.update({
          where: { id: approval.id },
          data: {
            status: "rejected",
            decisionNote: input.note || "Bulk rejected",
            decidedAt: new Date(),
          },
        });
        await tx.commentDraft.update({
          where: { id: approval.commentDraftId },
          data: { status: "rejected" },
        });
        await tx.targetPost.update({
          where: { id: approval.targetPostId },
          data: { status: "skipped" },
        });
      });
      rejected += 1;
      await writeAuditLog({
        workspaceId: workspace.id,
        actorUserId: userId,
        action: "approval.rejected",
        resourceType: "approval",
        resourceId: approval.id,
        metadata: { bulk: true, note: input.note || "Bulk rejected" },
      });
    } else {
      const accountId = approval.campaign?.accounts[0]?.socialAccountId || null;
      const delay = pacedDelay(approval.campaign);
      const scheduledFor = new Date(Date.now() + delay * 1000);

      await db.$transaction(async (tx) => {
        await tx.approval.update({
          where: { id: approval.id },
          data: {
            status: "approved",
            decisionNote: input.note || "Bulk approved",
            decidedAt: new Date(),
          },
        });
        await tx.commentDraft.update({
          where: { id: approval.commentDraftId },
          data: { status: "approved" },
        });
        await tx.commentAction.create({
          data: {
            workspaceId: workspace.id,
            campaignId: approval.campaignId,
            targetPostId: approval.targetPostId,
            commentDraftId: approval.commentDraftId,
            socialAccountId: accountId,
            status: "scheduled",
            resultMessage: `Bulk approved with ${delay}s delay`,
            scheduledFor,
          },
        });
        await tx.targetPost.update({
          where: { id: approval.targetPostId },
          data: { status: "approved" },
        });
      });
      approved += 1;
      await writeAuditLog({
        workspaceId: workspace.id,
        actorUserId: userId,
        action: "approval.approved",
        resourceType: "approval",
        resourceId: approval.id,
        metadata: { bulk: true, note: input.note || "Bulk approved" },
      });
    }
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: `approval.bulk_${input.decision}`,
    resourceType: "approval",
    resourceId: input.approvalIds.join(","),
    metadata: { approved, rejected, ids: input.approvalIds },
  });

  revalidatePath("/app/approvals");
  revalidatePath("/app/activity");
  revalidatePath("/app/inbox");
  revalidatePath("/app");
  return { processed: approved + rejected, approved, rejected };
}

export async function executeDueSends() {
  const { userId, workspace } = await requireActiveWorkspace();
  assertWorkspacePermission(workspace, "campaigns.manage");

  const due = await db.commentAction.count({
    where: {
      workspaceId: workspace.id,
      status: "scheduled",
      scheduledFor: { lte: new Date() },
    },
  });

  // Delegate to the real send pipeline (connector + preflight + quota +
  // delivery log). The previous implementation marked actions "sent" without
  // ever contacting the platform.
  const result = await runWorkerJob("comment.send");

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "comment.due_sends_executed",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: {
      due,
      ok: result.ok,
      message: result.message,
      sent: result.count ?? 0,
    },
  });

  revalidatePath("/app/activity");
  revalidatePath("/app/accounts");
  revalidatePath("/app");
  return { executed: result.count ?? 0, due, ok: result.ok, message: result.message };
}
