import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateContextualCommentHybrid } from "@/lib/comment-engine";
import { executeSocialAction } from "@/lib/connectors/runtime";
import { buildContentSchedule, generateContentPosts } from "@/lib/content-engine";
import { publishSocialPost } from "@/lib/publish-connector";
import { describeSendResult, getRuntimeModeLabel } from "@/lib/runtime-mode";
import { simulateIp } from "@/lib/session-routing";
import {
  chunkText,
  rankChunks,
  tokenize,
} from "@/lib/knowledge/retrieve";
import {
  ensureBuiltinSkills,
  matchSkillsForText,
  runSkill,
} from "@/lib/skills/runtime";

export type WorkerJobName =
  | "session.health_check"
  | "proxy.rotate"
  | "listener.poll"
  | "comment.generate"
  | "comment.send"
  | "content.generate"
  | "content.publish"
  | "knowledge.ingest"
  | "skill.execute"
  | "usage.rollup"
  | "notify.dispatch"
  | "worker.tick";

export type WorkerJobResult = {
  job: WorkerJobName;
  ok: boolean;
  message: string;
  count?: number;
  details?: Record<string, unknown>;
};

function currentPeriodKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function bumpUsage(
  workspaceId: string,
  field: "sends" | "publishes" | "generates" | "skillRuns",
  by = 1,
) {
  const periodKey = currentPeriodKey();
  await db.usageCounter.upsert({
    where: { workspaceId_periodKey: { workspaceId, periodKey } },
    create: {
      workspaceId,
      periodKey,
      sends: field === "sends" ? by : 0,
      publishes: field === "publishes" ? by : 0,
      generates: field === "generates" ? by : 0,
      skillRuns: field === "skillRuns" ? by : 0,
    },
    update: {
      [field]: { increment: by },
    },
  });
}

async function createNotification(input: {
  workspaceId: string;
  title: string;
  body: string;
  href?: string;
}) {
  await db.notification.create({
    data: {
      workspaceId: input.workspaceId,
      title: input.title,
      body: input.body,
      href: input.href,
    },
  });
}

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
    const probe = await executeSocialAction({
      action: "healthProbe",
      target: {
        platform: account.platform,
        username: account.username,
        accountId: account.id,
      },
      payload: {
        hasSession,
        proxyHealthy: proxyOk,
      },
    });

    const ok = probe.ok && probe.healthy !== false && hasSession && proxyOk;
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
          details: probe.message,
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
      await tx.deliveryLog.create({
        data: {
          workspaceId: account.workspaceId,
          socialAccountId: account.id,
          kind: "health_probe",
          connector: probe.connector,
          mode: probe.mode,
          ok,
          message: probe.message,
          payload: (probe.details ?? {}) as Prisma.InputJsonValue,
        },
      });
    });

    if (!ok) {
      await createNotification({
        workspaceId: account.workspaceId,
        title: `Account @${account.username} degraded`,
        body: probe.message,
        href: `/app/accounts/${account.id}`,
      });
      try {
        const { dispatchExternal } = await import("@/lib/notify/dispatcher");
        await dispatchExternal("account.degraded", account.workspaceId, {
          title: `Account @${account.username} degraded — ${status}`,
          body: probe.message,
          href: `/app/accounts/${account.id}`,
        });
      } catch {}
    }
    checked += 1;
  }

  return {
    job: "session.health_check",
    ok: true,
    message: `Checked ${checked} accounts`,
    count: checked,
  };
}

async function runProxyRotate(limit = 10): Promise<WorkerJobResult> {
  const assignments = await db.proxyAssignment.findMany({
    where: { isActive: true },
    include: {
      proxyEndpoint: true,
      socialAccount: true,
    },
    orderBy: { assignedAt: "asc" },
    take: limit,
  });

  let rotated = 0;
  for (const assignment of assignments) {
    if (!assignment.proxyEndpoint || !assignment.socialAccount) continue;
    if (assignment.proxyEndpoint.rotationMode === "sticky") continue;

    const result = await executeSocialAction({
      action: "rotateProxy",
      target: {
        platform: assignment.socialAccount.platform,
        username: assignment.socialAccount.username,
        accountId: assignment.socialAccountId,
      },
      payload: {
        proxyId: assignment.proxyEndpointId,
        seed: assignment.socialAccountId,
      },
    });

    const ip = result.ip || simulateIp(`${assignment.id}:${Date.now()}`);
    await db.$transaction(async (tx) => {
      await tx.ipRotationLog.create({
        data: {
          workspaceId: assignment.workspaceId,
          socialAccountId: assignment.socialAccountId,
          proxyEndpointId: assignment.proxyEndpointId,
          oldIp: assignment.socialAccount?.currentIp || null,
          newIp: ip,
          reason: "worker.proxy.rotate",
          success: result.ok,
        },
      });
      await tx.proxyEndpoint.update({
        where: { id: assignment.proxyEndpointId },
        data: {
          lastIp: ip,
          lastCheckedAt: new Date(),
          isHealthy: result.ok,
        },
      });
      await tx.socialAccount.update({
        where: { id: assignment.socialAccountId },
        data: { currentIp: ip, lastActionAt: new Date() },
      });
    });
    rotated += 1;
  }

  return {
    job: "proxy.rotate",
    ok: true,
    message: `Rotated ${rotated} proxies`,
    count: rotated,
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
    const discovery = await executeSocialAction({
      action: "discoverPosts",
      target: {
        platform: listener.platform,
        username: "listener",
      },
      payload: {
        query: listener.query,
        limit: 3,
        listenerId: listener.id,
      },
    });

    const posts =
      discovery.posts && discovery.posts.length > 0
        ? discovery.posts
        : discovery.ok
          ? []
          : [];

    // Fail-closed live discovery: if connector fails, skip create.
    if (!discovery.ok && getRuntimeModeLabel() === "live") {
      await createNotification({
        workspaceId: listener.workspaceId,
        title: "Listener poll failed",
        body: discovery.message,
        href: "/app/listeners",
      });
      continue;
    }

    const fallbackPosts =
      posts.length > 0
        ? posts
        : [0, 1, 2].map((i) => {
            const externalId = `${listener.platform}_${listener.id}_${Date.now()}_${i}`;
            return {
              externalId,
              authorHandle: `user_${Math.floor(Math.random() * 9000 + 1000)}`,
              content: `Baru bahas ${listener.query} (#${i + 1}). Ada rekomendasi praktis?`,
              url: `https://example.com/p/${externalId}`,
              platform: listener.platform,
            };
          });

    for (const post of fallbackPosts) {
      await db.targetPost.create({
        data: {
          workspaceId: listener.workspaceId,
          listenerId: listener.id,
          campaignId: listener.campaignId,
          platform: listener.platform,
          externalId: post.externalId,
          authorHandle: post.authorHandle,
          content: post.content,
          url: post.url,
          status: "new",
        },
      });
      created += 1;
    }

    await db.deliveryLog.create({
      data: {
        workspaceId: listener.workspaceId,
        kind: "discover_posts",
        connector: discovery.connector,
        mode: discovery.mode,
        ok: discovery.ok || getRuntimeModeLabel() === "simulator",
        message: discovery.message,
        payload: { listenerId: listener.id, created: fallbackPosts.length },
      },
    });
  }

  return {
    job: "listener.poll",
    ok: true,
    message: `Discovered ${created} posts`,
    count: created,
  };
}

async function runCommentGenerate(limit = 20): Promise<WorkerJobResult> {
  const posts = await db.targetPost.findMany({
    where: { status: "new" },
    include: {
      campaign: { include: { agent: true } },
    },
    orderBy: { discoveredAt: "asc" },
    take: limit,
  });

  let generated = 0;
  for (const post of posts) {
    const agent = post.campaign?.agent;
    const chunks = agent
      ? await db.knowledgeChunk.findMany({
          where: {
            workspaceId: post.workspaceId,
            document: {
              status: "ready",
              OR: [{ agentId: agent.id }, { agentId: null }],
            },
          },
          take: 50,
          orderBy: { createdAt: "desc" },
        })
      : [];

    const ranked = rankChunks(
      post.content,
      chunks.map((chunk) => ({ id: chunk.id, content: chunk.content })),
      3,
    );
    const knowledgeContext = ranked.map((item) => item.content);

    const skills = await ensureBuiltinSkills(post.workspaceId);
    const matched = matchSkillsForText(post.content, skills);
    let skillContext: string[] = [];
    let forceApproval = false;
    for (const skill of matched.slice(0, 1)) {
      const run = await runSkill({
        workspaceId: post.workspaceId,
        skill,
        agentId: agent?.id,
        inputText: post.content,
      });
      if (run.outputText) skillContext.push(run.outputText);
      if (skill.highRisk) forceApproval = true;
      await bumpUsage(post.workspaceId, "skillRuns", 1);
    }

    const draft = await generateContextualCommentHybrid({
      postContent: post.content,
      authorHandle: post.authorHandle,
      platform: post.platform,
      language: agent?.language,
      tone: agent?.tone,
      systemPrompt: agent?.systemPrompt,
      agentName: agent?.name,
      knowledgeContext,
      skillContext,
    });

    await db.$transaction(async (tx) => {
      const created = await tx.commentDraft.create({
        data: {
          workspaceId: post.workspaceId,
          campaignId: post.campaignId,
          targetPostId: post.id,
          agentId: agent?.id,
          content: draft.content,
          status: "pending",
          model: draft.model,
          providerId: draft.providerId,
          riskFlags: [
            ...draft.riskFlags,
            ...(forceApproval ? ["skill_high_risk"] : []),
            ...(ranked.length ? ["knowledge_grounded"] : []),
          ],
        },
      });
      await tx.approval.create({
        data: {
          workspaceId: post.workspaceId,
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
    });

    await bumpUsage(post.workspaceId, "generates", 1);
    await createNotification({
      workspaceId: post.workspaceId,
      title: "New comment draft needs review",
      body: draft.content.slice(0, 140),
      href: "/app/approvals",
    });
    generated += 1;
  }

  return {
    job: "comment.generate",
    ok: true,
    message: `Generated ${generated} drafts`,
    count: generated,
  };
}

async function runCommentSend(limit = 20): Promise<WorkerJobResult> {
  const due = await db.commentAction.findMany({
    where: {
      status: "scheduled",
      scheduledFor: { lte: new Date() },
    },
    include: {
      commentDraft: true,
      targetPost: true,
      socialAccount: true,
      campaign: true,
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  for (const action of due) {
    const workspace = await db.workspace.findUnique({
      where: { id: action.workspaceId },
    });
    const periodKey = currentPeriodKey();
    const usage = await db.usageCounter.findUnique({
      where: {
        workspaceId_periodKey: {
          workspaceId: action.workspaceId,
          periodKey,
        },
      },
    });
    if (
      workspace &&
      usage &&
      usage.sends >= workspace.monthlySendLimit
    ) {
      await db.commentAction.update({
        where: { id: action.id },
        data: {
          status: "failed",
          resultMessage: "Monthly send limit reached",
          executedAt: new Date(),
        },
      });
      failed += 1;
      continue;
    }

    const body = action.commentDraft?.content || "";
    const result = await executeSocialAction({
      action: "sendComment",
      target: {
        platform: action.targetPost.platform,
        username: action.socialAccount?.username,
        accountId: action.socialAccountId,
      },
      payload: {
        body,
        targetPostExternalId: action.targetPost.externalId,
        targetPostUrl: action.targetPost.url,
        authorHandle: action.targetPost.authorHandle,
      },
    });

    await db.$transaction(async (tx) => {
      await tx.commentAction.update({
        where: { id: action.id },
        data: {
          status: result.ok ? "sent" : "failed",
          executedAt: new Date(),
          resultMessage: result.ok
            ? describeSendResult(result.mode)
            : result.message,
        },
      });
      if (action.commentDraftId) {
        await tx.commentDraft.update({
          where: { id: action.commentDraftId },
          data: { status: result.ok ? "sent" : "rejected" },
        });
      }
      await tx.targetPost.update({
        where: { id: action.targetPostId },
        data: { status: result.ok ? "sent" : "failed" },
      });
      if (result.ok && action.socialAccountId) {
        await tx.socialAccount.update({
          where: { id: action.socialAccountId },
          data: {
            actionsToday: { increment: 1 },
            lastActionAt: new Date(),
            currentIp:
              result.mode === "simulator"
                ? simulateIp(`${action.socialAccountId}:${Date.now()}`)
                : undefined,
          },
        });
      }
      await tx.deliveryLog.create({
        data: {
          workspaceId: action.workspaceId,
          socialAccountId: action.socialAccountId,
          kind: "send_comment",
          connector: result.connector,
          mode: result.mode,
          ok: result.ok,
          externalId: result.externalId,
          message: result.message,
          payload: (result.details ?? {}) as Prisma.InputJsonValue,
        },
      });
    });

    if (result.ok) {
      await bumpUsage(action.workspaceId, "sends", 1);
      sent += 1;
    } else {
      await createNotification({
        workspaceId: action.workspaceId,
        title: "Comment send failed",
        body: result.message,
        href: "/app/activity",
      });
      failed += 1;
    }
  }

  return {
    job: "comment.send",
    ok: failed === 0,
    message: `Sent ${sent}, failed ${failed}`,
    count: sent,
    details: { failed, mode: getRuntimeModeLabel() },
  };
}

async function runContentGenerate(limit = 10): Promise<WorkerJobResult> {
  const campaigns = await db.contentCampaign.findMany({
    where: { status: { in: ["draft", "active"] } },
    include: { agent: true, drafts: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let generated = 0;
  for (const campaign of campaigns) {
    if (campaign.drafts.length > 0) continue;
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
    await bumpUsage(campaign.workspaceId, "generates", posts.length);
    generated += posts.length;
  }

  return {
    job: "content.generate",
    ok: true,
    message: `Generated ${generated} content drafts`,
    count: generated,
  };
}

async function runContentPublish(limit = 30): Promise<WorkerJobResult> {
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
  for (const draft of due) {
    const workspace = await db.workspace.findUnique({
      where: { id: draft.workspaceId },
    });
    const periodKey = currentPeriodKey();
    const usage = await db.usageCounter.findUnique({
      where: {
        workspaceId_periodKey: {
          workspaceId: draft.workspaceId,
          periodKey,
        },
      },
    });
    if (
      workspace &&
      usage &&
      usage.publishes >= workspace.monthlyPublishLimit
    ) {
      await db.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: "failed",
          resultMessage: "Monthly publish limit reached",
        },
      });
      failed += 1;
      continue;
    }

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
      policy: workspace?.connectorPolicy,
    });

    await db.$transaction(async (tx) => {
      await tx.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: result.ok ? "published" : "failed",
          publishedAt: result.ok ? result.publishedAt : null,
          resultMessage: result.message,
        },
      });
      if (result.ok) {
        await tx.contentCampaign.update({
          where: { id: draft.contentCampaignId },
          data: { publishedCount: { increment: 1 } },
        });
      }
      await tx.deliveryLog.create({
        data: {
          workspaceId: draft.workspaceId,
          socialAccountId: draft.socialAccountId,
          kind: "publish_post",
          connector: String(result.connector),
          mode: result.mode,
          ok: result.ok,
          externalId: result.externalPostId,
          message: result.message,
          payload: (result.details ?? {}) as Prisma.InputJsonValue,
        },
      });
    });

    if (result.ok) {
      await bumpUsage(draft.workspaceId, "publishes", 1);
      published += 1;
    } else {
      await createNotification({
        workspaceId: draft.workspaceId,
        title: "Content publish failed",
        body: result.message,
        href: `/app/content/${draft.contentCampaignId}`,
      });
      failed += 1;
    }
  }

  return {
    job: "content.publish",
    ok: failed === 0,
    message: `Published ${published}, failed ${failed}`,
    count: published,
    details: { failed },
  };
}

async function runKnowledgeIngest(limit = 10): Promise<WorkerJobResult> {
  const docs = await db.knowledgeDocument.findMany({
    where: { status: { in: ["pending", "processing"] } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let ingested = 0;
  for (const doc of docs) {
    await db.knowledgeDocument.update({
      where: { id: doc.id },
      data: { status: "processing" },
    });
    try {
      const chunks = chunkText(doc.rawText);
      await db.$transaction(async (tx) => {
        await tx.knowledgeChunk.deleteMany({ where: { documentId: doc.id } });
        for (const [index, content] of chunks.entries()) {
          await tx.knowledgeChunk.create({
            data: {
              workspaceId: doc.workspaceId,
              documentId: doc.id,
              ordinal: index + 1,
              content,
              tokenCount: tokenize(content).length,
              embedding: tokenize(content).slice(0, 32),
            },
          });
        }
        await tx.knowledgeDocument.update({
          where: { id: doc.id },
          data: {
            status: "ready",
            chunkCount: chunks.length,
            error: null,
          },
        });
      });
      ingested += 1;
    } catch (error) {
      await db.knowledgeDocument.update({
        where: { id: doc.id },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "ingest failed",
        },
      });
    }
  }

  return {
    job: "knowledge.ingest",
    ok: true,
    message: `Ingested ${ingested} documents`,
    count: ingested,
  };
}

async function runSkillExecute(limit = 10): Promise<WorkerJobResult> {
  const pending = await db.skillRun.findMany({
    where: { status: "pending" },
    include: { skill: { include: { triggers: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let executed = 0;
  for (const run of pending) {
    const result = await runSkill({
      workspaceId: run.workspaceId,
      skill: run.skill,
      agentId: run.agentId || undefined,
      inputText: String((run.inputJson as { text?: string } | null)?.text || ""),
      existingRunId: run.id,
    });
    if (result.ok) executed += 1;
    await bumpUsage(run.workspaceId, "skillRuns", 1);
  }

  return {
    job: "skill.execute",
    ok: true,
    message: `Executed ${executed} skill runs`,
    count: executed,
  };
}

async function runUsageRollup(): Promise<WorkerJobResult> {
  const workspaces = await db.workspace.findMany({
    where: { status: "active" },
    select: { id: true },
  });
  const periodKey = currentPeriodKey();
  for (const workspace of workspaces) {
    await db.usageCounter.upsert({
      where: {
        workspaceId_periodKey: {
          workspaceId: workspace.id,
          periodKey,
        },
      },
      create: { workspaceId: workspace.id, periodKey },
      update: {},
    });
  }

  // Dispatch usage warnings
  try {
    const { dispatchUsageWarningsForAllWorkspaces } = await import("./usage-alerts");
    await dispatchUsageWarningsForAllWorkspaces();
  } catch {
    // non-critical
  }

  return {
    job: "usage.rollup",
    ok: true,
    message: `Rolled usage for ${workspaces.length} workspaces`,
    count: workspaces.length,
  };
}

async function runNotifyDispatch(limit = 20): Promise<WorkerJobResult> {
  try {
    const { dispatchForUnreadNotifications } = await import("@/lib/notify/dispatcher");
    const workspaces = await db.workspace.findMany({
      where: { status: "active" },
      select: { id: true },
    });
    let totalDispatched = 0;
    for (const ws of workspaces) {
      const res = await dispatchForUnreadNotifications(ws.id, Math.floor(limit / Math.max(1, workspaces.length)) || 5);
      totalDispatched += res.processed;
    }

    // Check approval timeouts: pending >24h
    const staleMs = 24 * 60 * 60 * 1000;
    const staleCutoff = new Date(Date.now() - staleMs);
    const staleApprovals = await db.approval.findMany({
      where: { status: "pending", createdAt: { lt: staleCutoff } },
      include: { workspace: true, targetPost: true },
      take: 20,
    });
    for (const approval of staleApprovals) {
      await db.notification.create({
        data: {
          workspaceId: approval.workspaceId,
          title: `Approval pending for 24h: ${approval.targetPost?.authorHandle || "unknown"}`,
          body: `Post "${(approval.targetPost?.content || "").slice(0, 80)}" has been waiting for approval >24h.`,
          href: "/app/approvals",
        },
      });
      try {
        const { dispatchExternal } = await import("@/lib/notify/dispatcher");
        await dispatchExternal("approval.timeout", approval.workspaceId, {
          title: `Approval timeout: @${approval.targetPost?.authorHandle || "unknown"}`,
          body: `Pending >24h — campaign needs attention.`,
          href: "/app/approvals",
        });
      } catch {}
    }

    return {
      job: "notify.dispatch",
      ok: true,
      message: `Dispatched ${totalDispatched} notifications, checked ${staleApprovals.length} stale approvals`,
      count: totalDispatched,
    };
  } catch {
    const unread = await db.notification.findMany({
      where: { status: "unread" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return {
      job: "notify.dispatch",
      ok: true,
      message: `Unread notifications in queue: ${unread.length}`,
      count: unread.length,
    };
  }
}

export async function runWorkerJob(job: WorkerJobName): Promise<WorkerJobResult> {
  const started = await db.jobRun.create({
    data: {
      job,
      status: "running",
      message: "started",
    },
  });

  try {
    let result: WorkerJobResult;
    switch (job) {
      case "session.health_check":
        result = await runSessionHealthChecks();
        break;
      case "proxy.rotate":
        result = await runProxyRotate();
        break;
      case "listener.poll":
        result = await runListenerPolls();
        break;
      case "comment.generate":
        result = await runCommentGenerate();
        break;
      case "comment.send":
        result = await runCommentSend();
        break;
      case "content.generate":
        result = await runContentGenerate();
        break;
      case "content.publish":
        result = await runContentPublish();
        break;
      case "knowledge.ingest":
        result = await runKnowledgeIngest();
        break;
      case "skill.execute":
        result = await runSkillExecute();
        break;
      case "usage.rollup":
        result = await runUsageRollup();
        break;
      case "notify.dispatch":
        result = await runNotifyDispatch();
        break;
      case "worker.tick": {
        const settled = await Promise.allSettled([
          runSessionHealthChecks(),
          runProxyRotate(),
          runListenerPolls(),
          runKnowledgeIngest(),
          runCommentGenerate(),
          runCommentSend(),
          runContentGenerate(),
          runContentPublish(),
          runSkillExecute(),
          runUsageRollup(),
          runNotifyDispatch(),
        ]);
        const results = settled.map((s) =>
          s.status === "fulfilled"
            ? s.value
            : {
                job: "worker.tick" as const,
                ok: false,
                message: s.reason instanceof Error ? s.reason.message : String(s.reason),
              },
        );
        result = {
          job: "worker.tick",
          ok: results.every((item) => item.ok),
          message: results.map((item) => item.message).join(" | "),
          details: { results, mode: getRuntimeModeLabel() },
        };
        break;
      }
      default:
        result = { job, ok: false, message: `Unknown job: ${job}` };
    }

    await db.jobRun.update({
      where: { id: started.id },
      data: {
        status: result.ok ? "succeeded" : "failed",
        message: result.message,
        count: result.count,
        details: (result.details ?? {}) as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker failed";
    await db.jobRun.update({
      where: { id: started.id },
      data: {
        status: "failed",
        message,
        finishedAt: new Date(),
      },
    });
    return { job, ok: false, message };
  }
}

export const WORKER_JOBS: WorkerJobName[] = [
  "worker.tick",
  "session.health_check",
  "proxy.rotate",
  "listener.poll",
  "comment.generate",
  "comment.send",
  "content.generate",
  "content.publish",
  "knowledge.ingest",
  "skill.execute",
  "usage.rollup",
  "notify.dispatch",
];

