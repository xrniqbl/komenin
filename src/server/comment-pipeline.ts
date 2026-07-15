"use server";

import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import { generateContextualComment, pickDelaySeconds } from "@/lib/comment-engine";
import { describeSendResult } from "@/lib/runtime-mode";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";
import { writeAuditLog } from "@/server/audit";

export async function listInbox() {
  const { workspace } = await requireActiveWorkspace();
  return db.targetPost.findMany({
    where: { workspaceId: workspace.id },
    include: {
      drafts: { orderBy: { createdAt: "desc" }, take: 1 },
      campaign: true,
      listener: true,
    },
    orderBy: { discoveredAt: "desc" },
    take: 50,
  });
}

export async function listApprovals() {
  const { workspace } = await requireActiveWorkspace();
  return db.approval.findMany({
    where: { workspaceId: workspace.id, status: "pending" },
    include: {
      targetPost: true,
      commentDraft: true,
      campaign: true,
    },
    orderBy: { createdAt: "desc" },
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
  assertCan(workspace.role, "campaigns.manage");

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
    const generated = generateContextualComment({
      postContent: post.content,
      goal: campaign.goal,
      tone: campaign.agent?.tone,
      agentName: campaign.agent?.name,
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

  revalidatePath("/app/campaigns");
  revalidatePath(`/app/campaigns/${campaignId}`);
  revalidatePath("/app/approvals");
  revalidatePath("/app/inbox");
  return { created };
}

export async function decideApproval(input: {
  approvalId: string;
  decision: "approved" | "rejected";
  editedContent?: string;
  note?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "campaigns.manage");

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
    const delay = pickDelaySeconds(
      approval.campaign?.minDelaySec ?? 45,
      approval.campaign?.maxDelaySec ?? 180,
    );
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

export async function executeDueSends() {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "campaigns.manage");

  const due = await db.commentAction.findMany({
    where: {
      workspaceId: workspace.id,
      status: "scheduled",
      scheduledFor: { lte: new Date() },
    },
    include: { commentDraft: true, targetPost: true },
    take: 20,
  });

  for (const action of due) {
    await db.$transaction(async (tx) => {
      await tx.commentAction.update({
        where: { id: action.id },
        data: {
          status: "sent",
          executedAt: new Date(),
          resultMessage: describeSendResult(),
        },
      });
      if (action.commentDraftId) {
        await tx.commentDraft.update({
          where: { id: action.commentDraftId },
          data: { status: "sent" },
        });
      }
      await tx.targetPost.update({
        where: { id: action.targetPostId },
        data: { status: "sent" },
      });
      if (action.socialAccountId) {
        await tx.socialAccount.update({
          where: { id: action.socialAccountId },
          data: {
            actionsToday: { increment: 1 },
            lastActionAt: new Date(),
          },
        });
      }
    });
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "comment.due_sends_executed",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: { executed: due.length },
  });

  revalidatePath("/app/activity");
  revalidatePath("/app/accounts");
  revalidatePath("/app");
  return { executed: due.length };
}
