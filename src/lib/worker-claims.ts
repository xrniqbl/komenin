import { db } from "@/lib/db";

/**
 * Atomic work claims for worker jobs.
 *
 * Cron invocations (every 5 minutes, maxDuration=60) can overlap, so every
 * job MUST claim work with an atomic status transition before performing
 * external side effects. Two workers claiming the same row would otherwise
 * double-send comments, duplicate drafts, or double-publish posts.
 */

export async function claimCommentAction(actionId: string): Promise<boolean> {
  const result = await db.commentAction.updateMany({
    where: { id: actionId, status: "scheduled" },
    data: { status: "sending" },
  });
  return result.count === 1;
}

export async function releaseCommentAction(actionId: string): Promise<void> {
  await db.commentAction.updateMany({
    where: { id: actionId, status: "sending" },
    data: { status: "scheduled" },
  });
}

export async function claimContentDraft(draftId: string): Promise<boolean> {
  const result = await db.contentDraft.updateMany({
    where: { id: draftId, status: "scheduled" },
    data: { status: "publishing" },
  });
  return result.count === 1;
}

export async function releaseContentDraft(draftId: string): Promise<void> {
  await db.contentDraft.updateMany({
    where: { id: draftId, status: "publishing" },
    data: { status: "scheduled" },
  });
}

export async function claimTargetPost(postId: string): Promise<boolean> {
  const result = await db.targetPost.updateMany({
    where: { id: postId, status: "new" },
    data: { status: "generating" },
  });
  return result.count === 1;
}

export async function releaseTargetPost(postId: string): Promise<void> {
  await db.targetPost.updateMany({
    where: { id: postId, status: "generating" },
    data: { status: "new" },
  });
}

export async function claimContentCampaign(campaignId: string): Promise<boolean> {
  const result = await db.contentCampaign.updateMany({
    where: { id: campaignId, status: { in: ["draft", "active"] } },
    data: { status: "generating" },
  });
  return result.count === 1;
}

export async function releaseContentCampaign(campaignId: string): Promise<void> {
  await db.contentCampaign.updateMany({
    where: { id: campaignId, status: "generating" },
    data: { status: "active" },
  });
}

/**
 * Recover work stranded in a transient claim state when its run is stale.
 * A claim older than maxAgeMs means the worker died (timeout/redeploy), so
 * the row is released for the next tick instead of being stuck forever.
 */
export async function releaseStaleClaims(
  maxAgeMs = 10 * 60 * 1000,
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const [comments, posts, drafts, campaigns] = await Promise.all([
    db.commentAction.updateMany({
      where: { status: "sending", executedAt: null, updatedAt: { lt: cutoff } },
      data: { status: "scheduled" },
    }),
    db.targetPost.updateMany({
      where: { status: "generating", updatedAt: { lt: cutoff } },
      data: { status: "new" },
    }),
    db.contentDraft.updateMany({
      where: { status: "publishing", updatedAt: { lt: cutoff } },
      data: { status: "scheduled" },
    }),
    db.contentCampaign.updateMany({
      where: { status: "generating", updatedAt: { lt: cutoff } },
      data: { status: "active" },
    }),
  ]);
  return comments.count + posts.count + drafts.count + campaigns.count;
}
