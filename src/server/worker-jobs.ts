import { db } from "@/lib/db";
import { generateContextualComment } from "@/lib/comment-engine";
import { describeSendResult, getRuntimeModeLabel } from "@/lib/runtime-mode";
import { simulateIp } from "@/lib/session-routing";

export type WorkerJobName =
  | "session.health_check"
  | "listener.poll"
  | "comment.generate"
  | "comment.send"
  | "worker.tick";

export type WorkerJobResult = {
  job: WorkerJobName;
  ok: boolean;
  message: string;
  count?: number;
  details?: Record<string, unknown>;
};

async function runSessionHealthChecks(limit = 20): Promise<WorkerJobResult> {
  const accounts = await db.socialAccount.findMany({
    where: { deletedAt: null },
    include: {
      sessions: { where: { isActive: true }, take: 1 },
      proxyAssignments: {
        where: { isActive: true },
        include: { proxyEndpoint: true },
        take: 1,
      },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  let checked = 0;
  for (const account of accounts) {
    const hasSession = account.sessions.length > 0;
    const proxy = account.proxyAssignments[0]?.proxyEndpoint;
    const proxyOk = !proxy || proxy.isHealthy;
    const ok = hasSession && proxyOk;
    const status = ok ? "healthy" : !hasSession ? "limited" : "degraded";
    const healthScore = ok
      ? Math.min(100, account.healthScore + 2)
      : Math.max(10, account.healthScore - 8);

    await db.$transaction(async (tx) => {
      await tx.sessionHealthCheck.create({
        data: {
          workspaceId: account.workspaceId,
          socialAccountId: account.id,
          ok,
          latencyMs: ok ? 80 + Math.floor(Math.random() * 60) : 700,
          signal: ok ? "healthy" : !hasSession ? "session_missing" : "proxy_degraded",
          details: ok
            ? "Worker health probe succeeded"
            : !hasSession
              ? "No active session"
              : "Assigned proxy unhealthy",
        },
      });
      await tx.socialAccount.update({
        where: { id: account.id },
        data: {
          status,
          healthScore,
          lastActionAt: new Date(),
        },
      });
    });
    checked += 1;
  }

  return {
    job: "session.health_check",
    ok: true,
    message: `Checked ${checked} accounts`,
    count: checked,
  };
}

async function runListenerPolls(limit = 10): Promise<WorkerJobResult> {
  const listeners = await db.listener.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  let created = 0;
  for (const listener of listeners) {
    const samples = [
      `Baru coba ${listener.query} dan hasilnya lumayan. Ada tips biar lebih optimal?`,
      `Lagi riset ${listener.query}. Rekomendasi tools yang worth it buat tim kecil?`,
      `Diskusi ${listener.query} lagi rame. Siapa yang sudah implement end-to-end?`,
    ];

    for (let i = 0; i < samples.length; i += 1) {
      const externalId = `${listener.platform}_${listener.id}_${Date.now()}_${i}`;
      await db.targetPost.create({
        data: {
          workspaceId: listener.workspaceId,
          listenerId: listener.id,
          campaignId: listener.campaignId,
          platform: listener.platform,
          externalId,
          authorHandle: `user_${Math.floor(Math.random() * 9000 + 1000)}`,
          content: samples[i],
          url: `https://example.com/p/${externalId}`,
          status: "new",
        },
      });
      created += 1;
    }

    await db.listener.update({
      where: { id: listener.id },
      data: { isActive: true },
    });
  }

  return {
    job: "listener.poll",
    ok: true,
    message: `Polled ${listeners.length} listeners, created ${created} posts`,
    count: created,
    details: { listeners: listeners.length },
  };
}

async function runCommentGenerate(limit = 20): Promise<WorkerJobResult> {
  const posts = await db.targetPost.findMany({
    where: { status: "new", campaignId: { not: null } },
    include: {
      campaign: { include: { agent: true } },
    },
    orderBy: { discoveredAt: "asc" },
    take: limit,
  });

  let created = 0;
  for (const post of posts) {
    if (!post.campaign) continue;
    const generated = generateContextualComment({
      postContent: post.content,
      goal: post.campaign.goal,
      tone: post.campaign.agent?.tone,
      agentName: post.campaign.agent?.name,
    });

    await db.$transaction(async (tx) => {
      const draft = await tx.commentDraft.create({
        data: {
          workspaceId: post.workspaceId,
          campaignId: post.campaignId,
          targetPostId: post.id,
          agentId: post.campaign?.agentId,
          content: generated.content,
          status: "pending",
          riskFlags: generated.riskFlags,
        },
      });
      await tx.approval.create({
        data: {
          workspaceId: post.workspaceId,
          campaignId: post.campaignId,
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

  return {
    job: "comment.generate",
    ok: true,
    message: `Generated ${created} drafts`,
    count: created,
  };
}

async function runCommentSend(limit = 30): Promise<WorkerJobResult> {
  const due = await db.commentAction.findMany({
    where: {
      status: "scheduled",
      scheduledFor: { lte: new Date() },
    },
    include: { commentDraft: true },
    take: limit,
  });

  const mode = getRuntimeModeLabel();
  for (const action of due) {
    await db.$transaction(async (tx) => {
      await tx.commentAction.update({
        where: { id: action.id },
        data: {
          status: "sent",
          executedAt: new Date(),
          resultMessage: describeSendResult(mode),
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
            ...(mode === "simulator"
              ? { currentIp: simulateIp(`${action.socialAccountId}:${Date.now()}`) }
              : {}),
          },
        });
      }
    });
  }

  return {
    job: "comment.send",
    ok: true,
    message: `Executed ${due.length} due sends (${mode})`,
    count: due.length,
    details: { mode },
  };
}

export async function runWorkerJob(job: WorkerJobName): Promise<WorkerJobResult> {
  switch (job) {
    case "session.health_check":
      return runSessionHealthChecks();
    case "listener.poll":
      return runListenerPolls();
    case "comment.generate":
      return runCommentGenerate();
    case "comment.send":
      return runCommentSend();
    case "worker.tick": {
      const results = await Promise.all([
        runSessionHealthChecks(),
        runListenerPolls(),
        runCommentGenerate(),
        runCommentSend(),
      ]);
      return {
        job: "worker.tick",
        ok: results.every((item) => item.ok),
        message: results.map((item) => item.message).join(" | "),
        details: {
          results,
          mode: getRuntimeModeLabel(),
        },
      };
    }
    default:
      return {
        job,
        ok: false,
        message: `Unknown job: ${job}`,
      };
  }
}

export const WORKER_JOBS: WorkerJobName[] = [
  "worker.tick",
  "session.health_check",
  "listener.poll",
  "comment.generate",
  "comment.send",
];