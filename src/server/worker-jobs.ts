import { Prisma } from "@prisma/client";
import { dailyActionIncrementData, effectiveActionsToday } from "@/lib/account-quota";
import { FREE_ENTITLEMENTS } from "@/lib/billing/entitlements";
import { db } from "@/lib/db";
import { generateContextualCommentHybrid } from "@/lib/comment-engine";
import { executeSocialAction } from "@/lib/connectors/runtime";
import { buildContentSchedule, generateContentPosts } from "@/lib/content-engine";
import { publishSocialPost } from "@/lib/publish-connector";
import { refreshDueCredentials } from "@/lib/connectors/token-refresh";
import { describeSendResult, getRuntimeModeLabel } from "@/lib/runtime-mode";
import { simulateIp } from "@/lib/session-routing";
import { hourInTimezone, isInQuietHours } from "@/lib/workspace-time";
import {
  claimCommentAction,
  claimContentCampaign,
  claimContentDraft,
  claimTargetPost,
  releaseStaleClaims,
} from "@/lib/worker-claims";
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
  | "billing.expire"
  | "connector.refresh_tokens"
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
  const { probeEncryptedSession } = await import("@/lib/session-health");
  const accounts = await db.socialAccount.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      workspaceId: true,
      platform: true,
      username: true,
      healthScore: true,
      currentIp: true,
      sessions: {
        where: { isActive: true },
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { encryptedBlob: true },
      },
      proxyAssignments: {
        where: { isActive: true },
        take: 1,
        select: {
          id: true,
          proxyEndpointId: true,
          proxyEndpoint: {
            select: {
              id: true,
              isHealthy: true,
              rotationMode: true,
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  let checked = 0;
  let liveOk = 0;
  let rotated = 0;
  let reauthNotified = 0;

  for (const account of accounts) {
    const activeSession = account.sessions[0];
    const assignment = account.proxyAssignments[0];
    const proxy = assignment?.proxyEndpoint;
    let proxyOk = !proxy || proxy.isHealthy;
    let recovery: string | null = null;

    // Auto-recovery: unhealthy non-sticky proxy → rotate once, then re-probe path continues.
    if (activeSession?.encryptedBlob && proxy && !proxy.isHealthy && proxy.rotationMode !== "sticky") {
      try {
        const rotateResult = await executeSocialAction({
          action: "rotateProxy",
          workspaceId: account.workspaceId,
          target: {
            platform: account.platform,
            username: account.username,
            accountId: account.id,
            workspaceId: account.workspaceId,
          },
          payload: {
            proxyId: proxy.id,
            seed: account.id,
          },
        });
        const ip = rotateResult.ip || simulateIp(`${account.id}:${Date.now()}`);
        await db.$transaction(async (tx) => {
          await tx.ipRotationLog.create({
            data: {
              workspaceId: account.workspaceId,
              socialAccountId: account.id,
              proxyEndpointId: proxy.id,
              oldIp: account.currentIp,
              newIp: ip,
              reason: "worker.session.health_auto_rotate",
              success: rotateResult.ok,
            },
          });
          await tx.proxyEndpoint.update({
            where: { id: proxy.id },
            data: {
              lastIp: ip,
              lastCheckedAt: new Date(),
              isHealthy: rotateResult.ok,
            },
          });
          await tx.socialAccount.update({
            where: { id: account.id },
            data: { currentIp: ip },
          });
        });
        if (rotateResult.ok) {
          proxyOk = true;
          rotated += 1;
          recovery = `Proxy auto-rotated to ${ip}`;
          await createNotification({
            workspaceId: account.workspaceId,
            title: `Proxy rotated for @${account.username}`,
            body: recovery,
            href: `/app/accounts/${account.id}`,
          });
          try {
            const { dispatchExternal } = await import("@/lib/notify/dispatcher");
            await dispatchExternal("account.proxy_rotated", account.workspaceId, {
              title: `Proxy rotated for @${account.username}`,
              body: recovery,
              href: `/app/accounts/${account.id}`,
            });
          } catch {
            // non-fatal
          }
        } else {
          recovery = `Proxy rotate attempted but failed: ${rotateResult.message}`;
        }
      } catch (error) {
        recovery =
          error instanceof Error
            ? `Proxy rotate error: ${error.message}`
            : "Proxy rotate error";
      }
    }

    let ok = false;
    let signal = "session_missing";
    let details = "No active session";
    let latencyMs: number | null = null;
    let healthScore = Math.max(10, account.healthScore - 8);
    let status: "healthy" | "limited" | "degraded" = "limited";
    let mode = "missing";

    if (!activeSession?.encryptedBlob) {
      status = "limited";
      details = "No active session — re-import cookies from the account page";
      signal = "session_missing";
    } else if (!proxyOk) {
      signal = "proxy_degraded";
      details = recovery || "Assigned proxy marked unhealthy";
      status = "degraded";
      mode = "proxy";
    } else {
      const probe = await probeEncryptedSession({
        encryptedBlob: activeSession.encryptedBlob,
        platform: account.platform,
        username: account.username,
      });
      ok = probe.ok;
      signal = probe.signal;
      details = recovery ? `${probe.details} · ${recovery}` : probe.details;
      latencyMs = probe.latencyMs;
      mode = probe.mode;
      healthScore = probe.ok
        ? Math.min(100, Math.max(probe.healthScore, account.healthScore))
        : Math.max(10, Math.min(probe.healthScore, account.healthScore - 5));
      status = probe.ok
        ? "healthy"
        : probe.signal.includes("expired") || probe.signal.includes("unauthorized")
          ? "limited"
          : "degraded";
      if (probe.ok) liveOk += 1;
    }

    await db.$transaction(async (tx) => {
      await tx.sessionHealthCheck.create({
        data: {
          workspaceId: account.workspaceId,
          socialAccountId: account.id,
          ok,
          latencyMs,
          signal,
          details,
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
          connector: "session_cookie",
          mode,
          ok,
          message: details,
          payload: { signal, latencyMs, recovery } as Prisma.InputJsonValue,
        },
      });
    });

    if (!ok) {
      const needsReauth =
        signal.includes("expired") ||
        signal.includes("unauthorized") ||
        signal === "session_missing";
      const title = needsReauth
        ? `Re-auth required for @${account.username}`
        : `Account @${account.username} degraded`;
      const body = needsReauth
        ? `${details}. Open the account page → re-import session cookies, then run a health check.`
        : details;

      await createNotification({
        workspaceId: account.workspaceId,
        title,
        body,
        href: `/app/accounts/${account.id}`,
      });
      try {
        const { dispatchExternal } = await import("@/lib/notify/dispatcher");
        await dispatchExternal(
          needsReauth ? "account.reauth_required" : "account.degraded",
          account.workspaceId,
          {
            title: `${title} — ${status}`,
            body,
            href: `/app/accounts/${account.id}`,
          },
        );
      } catch {
        // non-fatal
      }
      if (needsReauth) reauthNotified += 1;
    }
    checked += 1;
  }

  return {
    job: "session.health_check",
    ok: true,
    message: `Checked ${checked} accounts (${liveOk} live-ok, ${rotated} proxy rotated, ${reauthNotified} reauth)`,
    count: checked,
    details: { liveOk, rotated, reauthNotified },
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
      workspaceId: assignment.socialAccount.workspaceId,
      target: {
        platform: assignment.socialAccount.platform,
        username: assignment.socialAccount.username,
        accountId: assignment.socialAccountId,
        workspaceId: assignment.socialAccount.workspaceId,
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

  const mode = getRuntimeModeLabel();
  let created = 0;
  for (const listener of listeners) {
    try {
    const discovery = await executeSocialAction({
      action: "discoverPosts",
      workspaceId: listener.workspaceId,
      target: {
        platform: listener.platform,
        username: "listener",
        workspaceId: listener.workspaceId,
      },
      payload: {
        query: listener.query,
        limit: 3,
        listenerId: listener.id,
      },
    });

    const realPosts =
      discovery.posts && discovery.posts.length > 0 ? discovery.posts : [];

    // Live fail-closed: never invent targets. Empty success or hard failure both
    // skip inserts so comment.send cannot fire against example.com placeholders.
    if (mode === "live") {
      if (!discovery.ok) {
        await createNotification({
          workspaceId: listener.workspaceId,
          title: "Listener poll failed",
          body: discovery.message,
          href: "/app/listeners",
        });
      }

      for (const post of realPosts) {
        try {
          const row = await db.targetPost.upsert({
            where: {
              workspaceId_platform_externalId: {
                workspaceId: listener.workspaceId,
                platform: listener.platform,
                externalId: post.externalId,
              },
            },
            create: {
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
            update: {
              authorHandle: post.authorHandle,
              content: post.content,
              url: post.url,
              listenerId: listener.id,
              campaignId: listener.campaignId,
            },
            select: { id: true, status: true },
          });
          if (row.status === "new") created += 1;
        } catch {
          // Ignore unique races / bad rows so one listener cannot fail the tick.
        }
      }

      await db.deliveryLog.create({
        data: {
          workspaceId: listener.workspaceId,
          kind: "discover_posts",
          connector: discovery.connector,
          mode: discovery.mode,
          ok: discovery.ok,
          message: discovery.message,
          payload: {
            listenerId: listener.id,
            created: realPosts.length,
            invented: false,
          },
        },
      });
      continue;
    }

    // Simulator only: seed demo posts when the connector returns nothing so the
    // rest of the comment pipeline can be exercised end-to-end offline.
    const posts =
      realPosts.length > 0
        ? realPosts
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

    for (const post of posts) {
      try {
        const row = await db.targetPost.upsert({
          where: {
            workspaceId_platform_externalId: {
              workspaceId: listener.workspaceId,
              platform: listener.platform,
              externalId: post.externalId,
            },
          },
          create: {
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
          update: {
            authorHandle: post.authorHandle,
            content: post.content,
            url: post.url,
            listenerId: listener.id,
            campaignId: listener.campaignId,
          },
          select: { id: true, status: true },
        });
        if (row.status === "new") created += 1;
      } catch {
        // Ignore unique races in simulator seed too.
      }
    }

    await db.deliveryLog.create({
      data: {
        workspaceId: listener.workspaceId,
        kind: "discover_posts",
        connector: discovery.connector,
        mode: discovery.mode,
        ok: discovery.ok || true,
        message: discovery.message,
        payload: {
          listenerId: listener.id,
          created: posts.length,
          invented: realPosts.length === 0,
        },
      },
    });
    } catch (error) {
      await createNotification({
        workspaceId: listener.workspaceId,
        title: "Listener poll error",
        body:
          error instanceof Error
            ? error.message
            : "Unexpected listener poll failure",
        href: "/app/listeners",
      }).catch(() => undefined);
    }
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
    // Atomic claim: overlapping cron ticks must not generate two drafts for
    // the same post. The claim is released only if generation throws.
    const claimed = await claimTargetPost(post.id);
    if (!claimed) continue;
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
      workspaceId: post.workspaceId,
      preferredProviderId: agent?.aiProviderId,
      preferredModel: agent?.model,
      temperature: agent?.temperature,
      maxTokens: agent?.maxTokens,
      style: agent?.style,
      formality: agent?.formality,
      emojiPolicy: agent?.emojiPolicy,
      ctaStyle: agent?.ctaStyle,
      maxSentences: agent?.maxSentences,
      bannedTopics: agent?.bannedTopics,
      mustInclude: agent?.mustInclude,
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
  const { runSendPreflight } = await import("@/lib/send-preflight");
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
  let blockedPreflight = 0;
  for (const action of due) {
    // Atomic claim before any side effect: overlapping cron ticks must not
    // deliver the same comment twice.
    const claimed = await claimCommentAction(action.id);
    if (!claimed) continue;

    const workspace = await db.workspace.findUnique({
      where: { id: action.workspaceId },
    });

    // Quiet hours: release the claim and leave the action scheduled so it is
    // retried once the window ends — never fail a send for being too early.
    if (
      workspace &&
      isInQuietHours({
        date: new Date(),
        timeZone: workspace.timezone,
        startHour: workspace.quietHoursStart,
        endHour: workspace.quietHoursEnd,
      })
    ) {
      await db.commentAction.updateMany({
        where: { id: action.id, status: "sending" },
        data: { status: "scheduled" },
      });
      continue;
    }
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

    const [riskRules, recentDupes] = await Promise.all([
      db.riskRule.findMany({
        where: { workspaceId: action.workspaceId, isActive: true },
        select: { type: true, pattern: true, severity: true },
        take: 100,
      }),
      action.targetPostId
        ? db.commentAction.findMany({
            where: {
              workspaceId: action.workspaceId,
              targetPostId: action.targetPostId,
              status: "sent",
              id: { not: action.id },
            },
            include: { commentDraft: { select: { content: true } } },
            orderBy: { executedAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

    const preflight = runSendPreflight({
      body,
      postContent: action.targetPost?.content,
      customRules: riskRules,
      account: action.socialAccount
        ? {
            status: action.socialAccount.status,
            healthScore: action.socialAccount.healthScore,
            actionsToday: effectiveActionsToday(action.socialAccount),
            dailyQuota: action.socialAccount.dailyQuota,
          }
        : null,
      recentBodies: recentDupes
        .map((row) => row.commentDraft?.content || "")
        .filter(Boolean),
      monthly: workspace
        ? {
            sendsUsed: usage?.sends ?? 0,
            sendLimit: workspace.monthlySendLimit,
          }
        : null,
    });

    if (preflight.blocked) {
      const message = `Preflight blocked: ${preflight.reasons.join("; ")}`;
      await db.$transaction(async (tx) => {
        await tx.commentAction.update({
          where: { id: action.id },
          data: {
            status: "failed",
            resultMessage: message,
            executedAt: new Date(),
          },
        });
        await tx.riskScanLog.create({
          data: {
            workspaceId: action.workspaceId,
            targetType: "comment_action",
            targetId: action.id,
            flags: preflight.risk.flags,
            score: preflight.risk.riskScore,
            details: {
              reasons: preflight.reasons,
              warnings: preflight.warnings,
              risk: preflight.risk.details,
            } as Prisma.InputJsonValue,
          },
        });
        await tx.deliveryLog.create({
          data: {
            workspaceId: action.workspaceId,
            socialAccountId: action.socialAccountId,
            kind: "send_comment_preflight",
            connector: "preflight",
            mode: getRuntimeModeLabel(),
            ok: false,
            message,
            payload: {
              stage: "preflight",
              reasons: preflight.reasons,
              warnings: preflight.warnings,
              riskScore: preflight.risk.riskScore,
            } as Prisma.InputJsonValue,
          },
        });
      });
      blockedPreflight += 1;
      failed += 1;
      continue;
    }

    const result = await executeSocialAction({
      action: "sendComment",
      workspaceId: action.workspaceId,
      target: {
        platform: action.targetPost.platform,
        username: action.socialAccount?.username,
        accountId: action.socialAccountId,
        workspaceId: action.workspaceId,
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
      if (result.ok && action.socialAccountId && action.socialAccount) {
        await tx.socialAccount.update({
          where: { id: action.socialAccountId },
          data: {
            ...dailyActionIncrementData(action.socialAccount),
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
    message: `Sent ${sent}, failed ${failed} (${blockedPreflight} preflight)`,
    count: sent,
    details: { failed, blockedPreflight, mode: getRuntimeModeLabel() },
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
    // Atomic claim: overlapping ticks must not generate a full draft set
    // twice for the same campaign.
    const claimed = await claimContentCampaign(campaign.id);
    if (!claimed) continue;
    const posts = await generateContentPosts({
      topic: campaign.topic,
      postCount: campaign.postCount,
      platform: campaign.platform,
      language: campaign.agent?.language,
      tone: campaign.agent?.tone,
      systemPrompt: campaign.agent?.systemPrompt,
      agentName: campaign.agent?.name,
      workspaceId: campaign.workspaceId,
      preferredProviderId: campaign.agent?.aiProviderId,
      preferredModel: campaign.agent?.model,
      temperature: campaign.agent?.temperature,
      maxTokens: campaign.agent?.maxTokens,
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
    // Atomic claim before publishing: overlapping ticks must not publish the
    // same draft twice.
    const claimed = await claimContentDraft(draft.id);
    if (!claimed) continue;

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
        workspaceId: draft.workspaceId,
      },
      payload: {
        title: draft.title,
        body: draft.body,
        hashtags: draft.hashtags,
        scheduledFor: draft.scheduledFor,
        mediaUrl: draft.mediaUrl,
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
  } catch (error) {
    // Surface the failure instead of pretending the dispatcher is healthy —
    // operators watching jobRun/status would otherwise never see a breakage.
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[notify.dispatch] failed", error);
    const unread = await db.notification.findMany({
      where: { status: "unread" },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return {
      job: "notify.dispatch",
      ok: false,
      message: `Dispatch failed: ${message} (unread in queue: ${unread.length})`,
      count: unread.length,
    };
  }
}

/**
 * Expire paid periods whose endsAt has passed and drop the workspace to free
 * limits when no other active/trialing period remains.
 */
async function runBillingExpire(limit = 50): Promise<WorkerJobResult> {
  const now = new Date();
  const due = await db.subscription.findMany({
    where: {
      status: { in: ["active", "trialing"] },
      endsAt: { lte: now },
    },
    orderBy: { endsAt: "asc" },
    take: limit,
    select: { id: true, workspaceId: true },
  });

  let expired = 0;
  let workspacesDowngraded = 0;

  for (const sub of due) {
    const outcome = await db.$transaction(async (tx) => {
      // Claim the row so concurrent ticks don't double-notify / double-write.
      const claim = await tx.subscription.updateMany({
        where: {
          id: sub.id,
          status: { in: ["active", "trialing"] },
          endsAt: { lte: now },
        },
        data: { status: "expired" },
      });
      if (claim.count === 0) {
        return { claimed: false, downgraded: false };
      }

      const stillActive = await tx.subscription.findFirst({
        where: {
          workspaceId: sub.workspaceId,
          status: { in: ["active", "trialing"] },
          endsAt: { gt: now },
        },
        select: { id: true },
      });

      if (stillActive) {
        return { claimed: true, downgraded: false };
      }

      await tx.workspace.update({
        where: { id: sub.workspaceId },
        data: {
          planCode: "free",
          monthlySendLimit: FREE_ENTITLEMENTS.monthlySendLimit,
          monthlyPublishLimit: FREE_ENTITLEMENTS.monthlyPublishLimit,
        },
      });

      await tx.notification.create({
        data: {
          workspaceId: sub.workspaceId,
          title: "Subscription expired",
          body: "Your paid plan period ended. Workspace limits were reset to the free tier.",
          href: "/app/settings/billing",
        },
      });

      return { claimed: true, downgraded: true };
    });

    if (outcome.claimed) expired += 1;
    if (outcome.downgraded) workspacesDowngraded += 1;
  }

  return {
    job: "billing.expire",
    ok: true,
    message: `Expired ${expired} subscriptions (${workspacesDowngraded} workspaces → free)`,
    count: expired,
    details: { workspacesDowngraded },
  };
}

/**
 * Refresh OAuth connector tokens before they expire (IG/Threads ~60d,
 * TikTok ~24h). Without this, official adapters start failing silently once
 * credentials expire.
 */
async function runConnectorRefreshTokens(limit = 20): Promise<WorkerJobResult> {
  const { checked, refreshed, failures } = await refreshDueCredentials(limit);

  // Surface failures as in-app notifications so operators can reconnect.
  for (const failure of failures.slice(0, 5)) {
    const credential = await db.connectorCredential.findUnique({
      where: { id: failure.credentialId },
      select: { workspaceId: true },
    });
    if (!credential) continue;
    await createNotification({
      workspaceId: credential.workspaceId,
      title: `Connector token refresh failed (${failure.provider})`,
      body: failure.message.slice(0, 200),
      href: "/app/settings/publisher",
    });
  }

  return {
    job: "connector.refresh_tokens",
    ok: failures.length === 0,
    message: `Refreshed ${refreshed}/${checked} due credentials`,
    count: refreshed,
    details: { checked, failures: failures.length },
  };
}

export async function runWorkerJob(job: WorkerJobName): Promise<WorkerJobResult> {
  // Re-entrancy guard: cron invocations can overlap (5-minute schedule vs
  // 60s function timeout), so skip the job if a run is already in flight.
  // Runs older than 15 minutes are considered stale leftovers from a dead
  // function and do not block — the per-row atomic claims still protect
  // against duplicate side effects.
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const inFlight = await db.jobRun.findFirst({
    where: {
      job,
      status: "running",
      startedAt: { gt: staleCutoff },
    },
    select: { id: true },
  });
  if (inFlight) {
    return {
      job,
      ok: true,
      message: `Skipped: ${job} is already running (${inFlight.id})`,
      count: 0,
      details: { skipped: true },
    };
  }

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
      case "billing.expire":
        result = await runBillingExpire();
        break;
      case "connector.refresh_tokens":
        result = await runConnectorRefreshTokens();
        break;
      case "worker.tick": {
        // Recover work stranded in a transient claim state from a crashed or
        // timed-out previous tick before fanning out.
        await releaseStaleClaims().catch(() => 0);
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
          runBillingExpire(),
          runConnectorRefreshTokens(),
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
  "billing.expire",
  "connector.refresh_tokens",
];

