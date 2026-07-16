const fs = require("fs");

function rewriteFunction(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Bounds not found for ${startMarker}`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

// content-campaigns.ts
{
  const path = "src/server/content-campaigns.ts";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes('publishSocialPost')) {
    t = t.replace(
      'import { buildContentSchedule, generateContentPosts } from "@/lib/content-engine";',
      'import { buildContentSchedule, generateContentPosts } from "@/lib/content-engine";\nimport { publishSocialPost } from "@/lib/publish-connector";'
    );
  }
  t = t.replace(
    'import { describeSendResult, getRuntimeModeLabel } from "@/lib/runtime-mode";',
    'import { getRuntimeModeLabel } from "@/lib/runtime-mode";'
  );
  t = t.replace(
    'import { describeSendResult } from "@/lib/runtime-mode";\nimport { getRuntimeModeLabel } from "@/lib/runtime-mode";',
    'import { getRuntimeModeLabel } from "@/lib/runtime-mode";'
  );

  const newPublishFn = `export async function publishDueContentDrafts(limit = 30) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "campaigns.manage");

  const due = await db.contentDraft.findMany({
    where: {
      workspaceId: workspace.id,
      status: "scheduled",
      scheduledFor: { lte: new Date() },
    },
    include: {
      contentCampaign: true,
      socialAccount: true,
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  let published = 0;
  let failed = 0;

  for (const draft of due) {
    const result = await publishSocialPost({
      target: {
        platform: draft.contentCampaign.platform,
        username: draft.socialAccount?.username,
        accountId: draft.socialAccountId,
      },
      payload: {
        title: draft.title,
        body: draft.body,
        hashtags: draft.hashtags,
        scheduledFor: draft.scheduledFor,
      },
    });

    if (result.ok) {
      published += 1;
      await db.$transaction(async (tx) => {
        await tx.contentDraft.update({
          where: { id: draft.id },
          data: {
            status: "published",
            publishedAt: result.publishedAt,
            resultMessage: result.externalPostId
              ? result.message + " · id=" + result.externalPostId
              : result.message,
          },
        });
        await tx.contentCampaign.update({
          where: { id: draft.contentCampaignId },
          data: { publishedCount: { increment: 1 } },
        });
        if (draft.socialAccountId) {
          await tx.socialAccount.update({
            where: { id: draft.socialAccountId },
            data: {
              actionsToday: { increment: 1 },
              lastActionAt: new Date(),
            },
          });
        }
      });
    } else {
      failed += 1;
      await db.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: "failed",
          resultMessage: result.message,
        },
      });
    }
  }

  const active = await db.contentCampaign.findMany({
    where: { workspaceId: workspace.id, status: "active" },
    include: {
      drafts: { select: { status: true } },
    },
  });
  for (const campaign of active) {
    const remaining = campaign.drafts.filter((d) =>
      ["pending", "scheduled", "approved"].includes(d.status),
    ).length;
    if (remaining === 0 && campaign.drafts.length > 0) {
      await db.contentCampaign.update({
        where: { id: campaign.id },
        data: { status: "completed" },
      });
    }
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "content_drafts.published_due",
    resourceType: "workspace",
    resourceId: workspace.id,
    metadata: { published, failed, mode: getRuntimeModeLabel() },
  });

  revalidateContentPaths();
  return { published, failed, mode: getRuntimeModeLabel() };
}

export async function listContentSchedule(limit = 100) {
  const { workspace } = await requireActiveWorkspace();
  return db.contentDraft.findMany({
    where: {
      workspaceId: workspace.id,
      status: { in: ["pending", "scheduled", "published", "failed"] },
    },
    include: {
      contentCampaign: true,
      socialAccount: true,
    },
    orderBy: [{ scheduledFor: "asc" }, { sequence: "asc" }],
    take: Math.min(Math.max(limit, 1), 300),
  });
}

export async function listPendingContentDrafts() {
`;

  t = rewriteFunction(
    t,
    "export async function publishDueContentDrafts(limit = 30) {",
    "export async function listPendingContentDrafts() {",
    newPublishFn
  );
  fs.writeFileSync(path, t);
  console.log("content-campaigns patched");
}

// worker-jobs.ts
{
  const path = "src/server/worker-jobs.ts";
  let t = fs.readFileSync(path, "utf8");
  if (!t.includes("publishSocialPost")) {
    t = t.replace(
      'import { buildContentSchedule, generateContentPosts } from "@/lib/content-engine";',
      'import { buildContentSchedule, generateContentPosts } from "@/lib/content-engine";\nimport { publishSocialPost } from "@/lib/publish-connector";'
    );
  }

  const newFn = `async function runContentPublish(limit = 30): Promise<WorkerJobResult> {
  const due = await db.contentDraft.findMany({
    where: {
      status: "scheduled",
      scheduledFor: { lte: new Date() },
    },
    include: {
      contentCampaign: true,
      socialAccount: true,
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  let published = 0;
  let failed = 0;
  const mode = getRuntimeModeLabel();

  for (const draft of due) {
    const result = await publishSocialPost({
      target: {
        platform: draft.contentCampaign.platform,
        username: draft.socialAccount?.username,
        accountId: draft.socialAccountId,
      },
      payload: {
        title: draft.title,
        body: draft.body,
        hashtags: draft.hashtags,
        scheduledFor: draft.scheduledFor,
      },
    });

    if (result.ok) {
      published += 1;
      await db.$transaction(async (tx) => {
        await tx.contentDraft.update({
          where: { id: draft.id },
          data: {
            status: "published",
            publishedAt: result.publishedAt,
            resultMessage: result.externalPostId
              ? result.message + " · id=" + result.externalPostId
              : result.message,
          },
        });
        await tx.contentCampaign.update({
          where: { id: draft.contentCampaignId },
          data: { publishedCount: { increment: 1 } },
        });
        if (draft.socialAccountId) {
          await tx.socialAccount.update({
            where: { id: draft.socialAccountId },
            data: {
              actionsToday: { increment: 1 },
              lastActionAt: new Date(),
            },
          });
        }
      });
    } else {
      failed += 1;
      await db.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: "failed",
          resultMessage: result.message,
        },
      });
    }
  }

  return {
    job: "content.publish",
    ok: failed === 0,
    message: "Content publish done: " + published + " published, " + failed + " failed (" + mode + ")",
    count: published,
    details: { published, failed, mode },
  };
}

`;

  t = rewriteFunction(
    t,
    "async function runContentPublish(limit = 30): Promise<WorkerJobResult> {",
    "export async function runWorkerJob(job: WorkerJobName): Promise<WorkerJobResult> {",
    newFn
  );
  fs.writeFileSync(path, t);
  console.log("worker patched");
}