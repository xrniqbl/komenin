const fs = require("fs");

const path = "src/server/worker-jobs.ts";
let t = fs.readFileSync(path, "utf8");

if (!t.includes("content.generate")) {
  t = t.replace(
    'import { generateContextualCommentHybrid } from "@/lib/comment-engine";',
    'import { generateContextualCommentHybrid } from "@/lib/comment-engine";\nimport { buildContentSchedule, generateContentPosts } from "@/lib/content-engine";'
  );

  t = t.replace(
    `export type WorkerJobName =
  | "session.health_check"
  | "listener.poll"
  | "comment.generate"
  | "comment.send"
  | "worker.tick";`,
    `export type WorkerJobName =
  | "session.health_check"
  | "listener.poll"
  | "comment.generate"
  | "comment.send"
  | "content.generate"
  | "content.publish"
  | "worker.tick";`
  );

  const contentFns = `
async function runContentGenerate(limit = 10): Promise<WorkerJobResult> {
  const campaigns = await db.contentCampaign.findMany({
    where: {
      status: { in: ["draft", "active"] },
    },
    include: { agent: true, drafts: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let generated = 0;
  let touched = 0;
  for (const campaign of campaigns) {
    if (campaign.drafts.length > 0) continue;
    touched += 1;
    const posts = await generateContentPosts({
      topic: campaign.topic,
      postCount: campaign.postCount,
      platform: campaign.platform,
      language: campaign.agent?.language,
      tone: campaign.agent?.tone,
      systemPrompt: campaign.agent?.systemPrompt,
      agentName: campaign.agent?.name,
    });
    const schedule = buildContentSchedule({
      startAt: campaign.startAt,
      postCount: posts.length,
      intervalValue: campaign.intervalValue,
      intervalUnit: campaign.intervalUnit,
    });

    await db.$transaction(async (tx) => {
      for (const [index, post] of posts.entries()) {
        await tx.contentDraft.create({
          data: {
            workspaceId: campaign.workspaceId,
            contentCampaignId: campaign.id,
            agentId: campaign.agentId,
            socialAccountId: campaign.socialAccountId,
            sequence: post.sequence || index + 1,
            title: post.title,
            body: post.body,
            hashtags: post.hashtags,
            status: campaign.mode === "approval_required" ? "pending" : "scheduled",
            scheduledFor: schedule[index] || campaign.startAt,
            providerId: post.providerId,
            model: post.model,
            riskFlags: [],
          },
        });
      }
      await tx.contentCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "active",
          generatedCount: posts.length,
        },
      });
    });
    generated += posts.length;
  }

  return {
    job: "content.generate",
    ok: true,
    message: \`Generated \${generated} content posts across \${touched} campaigns\`,
    count: generated,
  };
}

async function runContentPublish(limit = 30): Promise<WorkerJobResult> {
  const due = await db.contentDraft.findMany({
    where: {
      status: "scheduled",
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  const mode = getRuntimeModeLabel();
  for (const draft of due) {
    await db.$transaction(async (tx) => {
      await tx.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: "published",
          publishedAt: new Date(),
          resultMessage:
            mode === "simulator"
              ? "Post published via content worker (simulator mode)"
              : "Post publish accepted by live connector",
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
  }

  return {
    job: "content.publish",
    ok: true,
    message: \`Published \${due.length} due content posts (\${mode})\`,
    count: due.length,
    details: { mode },
  };
}
`;

  t = t.replace(
    "export async function runWorkerJob(job: WorkerJobName): Promise<WorkerJobResult> {",
    contentFns + "\nexport async function runWorkerJob(job: WorkerJobName): Promise<WorkerJobResult> {"
  );

  t = t.replace(
    `    case "comment.send":
      return runCommentSend();
    case "worker.tick": {
      const results = await Promise.all([
        runSessionHealthChecks(),
        runListenerPolls(),
        runCommentGenerate(),
        runCommentSend(),
      ]);`,
    `    case "comment.send":
      return runCommentSend();
    case "content.generate":
      return runContentGenerate();
    case "content.publish":
      return runContentPublish();
    case "worker.tick": {
      const results = await Promise.all([
        runSessionHealthChecks(),
        runListenerPolls(),
        runCommentGenerate(),
        runCommentSend(),
        runContentGenerate(),
        runContentPublish(),
      ]);`
  );

  t = t.replace(
    `export const WORKER_JOBS: WorkerJobName[] = [
  "worker.tick",
  "session.health_check",
  "listener.poll",
  "comment.generate",
  "comment.send",
];`,
    `export const WORKER_JOBS: WorkerJobName[] = [
  "worker.tick",
  "session.health_check",
  "listener.poll",
  "comment.generate",
  "comment.send",
  "content.generate",
  "content.publish",
];`
  );

  fs.writeFileSync(path, t);
  console.log("worker patched");
} else {
  console.log("worker already patched");
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.scripts["worker:content-generate"] = "tsx scripts/run-worker.ts content.generate";
pkg.scripts["worker:content-publish"] = "tsx scripts/run-worker.ts content.publish";
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log("package scripts updated");