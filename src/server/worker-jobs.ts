import { Prisma } from "@prisma/client";
import { dailyActionIncrementData, effectiveActionsToday } from "@/lib/account-quota";
import { FREE_ENTITLEMENTS } from "@/lib/billing/entitlements";
import { db } from "@/lib/db";
import { generateContextualCommentHybrid, pickDelaySeconds } from "@/lib/comment-engine";
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
  claimMention,
  claimTargetPost,
  releaseStaleClaims,
} from "@/lib/worker-claims";
import {
  chunkText,
  rankChunks,
  tokenize,
} from "@/lib/knowledge/retrieve";
import { renderTemplate } from "@/lib/template-engine";
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
  | "mention.process"
  | "content.generate"
  | "content.publish"
  | "knowledge.ingest"
  | "skill.execute"
  | "usage.rollup"
  | "notify.dispatch"
  | "digest.approvals"
  | "billing.expire"
  | "ai.quota_notify"
  | "ai.expire"
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
    // Native Instagram hashtag discovery needs the platform-side account id
    // (SocialAccount.externalId); resolve any active account on the platform.
    const discoveryAccount = await db.socialAccount.findFirst({
      where: {
        workspaceId: listener.workspaceId,
        platform: listener.platform,
        status: { in: ["healthy", "degraded", "limited"] },
        deletedAt: null,
      },
      select: { id: true, externalId: true, username: true },
      orderBy: { createdAt: "asc" },
    });
    const discovery = await executeSocialAction({
      action: "discoverPosts",
      workspaceId: listener.workspaceId,
      target: {
        platform: listener.platform,
        username: discoveryAccount?.username || "listener",
        accountId: discoveryAccount?.id ?? null,
        externalId: discoveryAccount?.externalId ?? null,
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
  let quotaFailed = 0;
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

    // Fail-closed on AI quota: when the workspace has no funding source, mark
    // the post failed:quota and notify the operator ONCE per day — do NOT
    // auto-retry (the claim above is consumed, so a retry would need a fresh
    // post anyway). This prevents a stuck/retry loop when credits run out.
    let draft: Awaited<ReturnType<typeof generateContextualCommentHybrid>>;
    try {
      draft = await generateContextualCommentHybrid({
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
    } catch (error) {
      const { AiQuotaExceededError, AiModelNotAllowedError } = await import(
        "@/lib/ai/router"
      );
      if (
        error instanceof AiQuotaExceededError ||
        error instanceof AiModelNotAllowedError
      ) {
        await db.targetPost.update({
          where: { id: post.id },
          data: { status: "failed" },
        });
        // Dedup the operator notification to once per workspace per day.
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const already = await db.notification.findFirst({
          where: {
            workspaceId: post.workspaceId,
            title: { contains: "AI quota" },
            createdAt: { gte: todayStart },
          },
          select: { id: true },
        });
        if (!already) {
          await createNotification({
            workspaceId: post.workspaceId,
            title: "AI quota habis — pembuatan komentar dijeda",
            body: `${error.message} Tambahkan API key sendiri, upgrade tier, atau beli kredit pay-as-you-go di Settings → AI.`,
            href: "/app/settings/ai",
          });
          try {
            const { dispatchExternal } = await import("@/lib/notify/dispatcher");
            await dispatchExternal("ai.quota_exhausted", post.workspaceId, {
              title: "AI quota habis — pembuatan komentar dijeda",
              body: error.message,
              href: "/app/settings/ai",
            });
          } catch {
            // non-fatal
          }
        }
        quotaFailed += 1;
        continue; // next post — do not throw, do not retry this one
      }
      // Unrelated generation failure: isolate it so one bad post can't stall the
      // whole batch. Mark the post failed and continue; the claim is consumed.
      const message = error instanceof Error ? error.message : "Comment generation error";
      await db.targetPost.update({
        where: { id: post.id },
        data: { status: "failed" },
      });
      await db.deliveryLog.create({
        data: {
          workspaceId: post.workspaceId,
          kind: "send_comment",
          connector: "comment_engine",
          mode: getRuntimeModeLabel(),
          ok: false,
          message,
          payload: { stage: "generate_throw" } as Prisma.InputJsonValue,
        },
      });
      quotaFailed += 1; // reuse the counter so the job summary reports skipped posts
      continue;
    }

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
    message: `Generated ${generated} drafts${quotaFailed ? `, ${quotaFailed} failed:quota` : ""}`,
    count: generated,
    details: quotaFailed ? { quotaFailed } : undefined,
  };
}

/** Max total attempts per CommentAction (1 initial + retries). */
export const MAX_COMMENT_SEND_ATTEMPTS = 3;
/** Backoff ladder in minutes: retry 1 → 2m, retry 2 → 10m, retry 3 → 30m. */
export const RETRY_DELAYS_MINUTES = [2, 10, 30];

/**
 * Backoff delay for the retry scheduled after an attempt whose pre-send
 * attemptCount is `attemptCount` (0 before the first send). Indexed by the
 * retry number (attemptCount), not attemptCount + 1, so retry 1 gets 2m and
 * retry 2 gets 10m — matching the documented 2m → 10m → 30m ladder.
 */
export function retryDelayMinutesForAttempt(attemptCount: number): number {
  return RETRY_DELAYS_MINUTES[attemptCount] ?? 30;
}

/**
 * Whether a due send should be deferred for workspace quiet hours.
 * quietHoursApply defaults to true (matching the AutoReplySettings column
 * default) — only an explicit false disables the deferral.
 */
export function shouldDeferForQuietHours(input: {
  inQuietHours: boolean;
  quietHoursApply: boolean | undefined;
}): boolean {
  return input.inQuietHours && (input.quietHoursApply ?? true);
}

/**
 * Transient send failures are retried with backoff; permanent rejections
 * (policy/permission/not-found style) fail immediately.
 */
export function isRetryableSendFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("rate limit") ||
    m.includes("ratelimit") ||
    m.includes("429") ||
    m.includes("500") ||
    m.includes("502") ||
    m.includes("503") ||
    m.includes("504") ||
    m.includes("network") ||
    m.includes("econn") ||
    m.includes("socket") ||
    m.includes("temporarily") ||
    m.includes("unavailable") ||
    m.includes("fetch failed") ||
    m.includes("aborted")
  );
}

/**
 * Schedule a retry for a claimed CommentAction: bump attemptCount and push
 * scheduledFor out by the backoff delay. Returns false when retries are
 * exhausted (caller then marks the action failed). The claim (status=sending)
 * is released back to scheduled only when a retry was actually scheduled.
 */
async function scheduleCommentActionRetry(
  actionId: string,
  reason: string,
): Promise<boolean> {
  const action = await db.commentAction.findUnique({
    where: { id: actionId },
    select: { attemptCount: true, status: true },
  });
  if (!action || action.status !== "sending") return false;
  const nextAttempt = action.attemptCount + 1;
  if (nextAttempt >= MAX_COMMENT_SEND_ATTEMPTS) return false;

  const delayMin = retryDelayMinutesForAttempt(action.attemptCount);
  await db.commentAction.update({
    where: { id: actionId },
    data: {
      attemptCount: nextAttempt,
      status: "scheduled",
      scheduledFor: new Date(Date.now() + delayMin * 60 * 1000),
      resultMessage: `Retry ${nextAttempt}/${MAX_COMMENT_SEND_ATTEMPTS - 1} in ${delayMin}m: ${reason}`.slice(
        0,
        500,
      ),
    },
  });
  return true;
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
      mention: true,
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
    const attempt = action.attemptCount;

    const workspace = await db.workspace.findUnique({
      where: { id: action.workspaceId },
    });

    // Quiet hours: release the claim and leave the action scheduled so it is
    // retried once the window ends — never fail a send for being too early.
    // The workspace's AutoReplySettings.quietHoursApply flag is honored: an
    // explicit false disables the deferral (default true matches the column).
    let quietHoursApply: boolean | undefined;
    if (workspace) {
      const autoReplySettings = await db.autoReplySettings.findUnique({
        where: { workspaceId: action.workspaceId },
        select: { quietHoursApply: true },
      });
      quietHoursApply = autoReplySettings?.quietHoursApply;
    }
    if (
      workspace &&
      shouldDeferForQuietHours({
        inQuietHours: isInQuietHours({
          date: new Date(),
          timeZone: workspace.timezone,
          startHour: workspace.quietHoursStart,
          endHour: workspace.quietHoursEnd,
        }),
        quietHoursApply,
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

    // Mention replies share one anchor TargetPost per parent thread, so its
    // content belongs to the FIRST mention on that thread. Risk-scan against
    // the actual mention being replied to instead of the stale anchor.
    const preflightPostContent =
      action.source === "mention_reply" && action.mention
        ? action.mention.content
        : action.targetPost?.content;

    const preflight = runSendPreflight({
      body,
      postContent: preflightPostContent,
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

    // Isolate per-action failures: a throw from the connector must not abort
    // the whole batch (which would strand every remaining due action this tick
    // AND leave this action claimed until the 10-min stale sweep).
    let result: Awaited<ReturnType<typeof executeSocialAction>>;
    try {
      // Mention replies target the parent comment, not the anchor post.
      const isMentionReply = action.source === "mention_reply" && action.replyToExternalId;
      result = await executeSocialAction({
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
          targetPostExternalId: isMentionReply
            ? action.replyToExternalId
            : action.targetPost.externalId,
          targetPostUrl: action.targetPost.url,
          authorHandle: isMentionReply
            ? action.replyToAuthor || action.targetPost.authorHandle
            : action.targetPost.authorHandle,
        },
        // Stable per-action key: if this process dies after the bridge accepted
        // the comment but before the result write, the stale-claim re-send
        // carries the same key and the bridge can dedupe instead of double-posting.
        idempotencyKey: `comment-action:${action.id}`,
      });
    } catch (error) {
      // Connector throw = transient candidate: back off and retry instead of
      // failing permanently on the first network blip.
      const message = error instanceof Error ? error.message : "Comment send error";
      const retried = await scheduleCommentActionRetry(action.id, message);
      if (!retried) {
        await db.commentAction.update({
          where: { id: action.id },
          data: { status: "failed", executedAt: new Date(), resultMessage: message },
        });
      }
      await db.deliveryLog.create({
        data: {
          workspaceId: action.workspaceId,
          socialAccountId: action.socialAccountId,
          kind: "send_comment",
          connector: "unknown",
          mode: getRuntimeModeLabel(),
          ok: false,
          message,
          payload: {
            stage: "execute_throw",
            attempt: attempt + 1,
            willRetry: retried,
          } as Prisma.InputJsonValue,
        },
      });
      failed += 1;
      continue;
    }

    if (!result.ok && isRetryableSendFailure(result.message)) {
      // Transient provider failure: back off (exponential, capped) and retry
      // up to MAX_COMMENT_SEND_ATTEMPTS before declaring the action failed.
      const retried = await scheduleCommentActionRetry(action.id, result.message);
      if (retried) {
        await db.deliveryLog.create({
          data: {
            workspaceId: action.workspaceId,
            socialAccountId: action.socialAccountId,
            kind: "send_comment",
            connector: result.connector,
            mode: result.mode,
            ok: false,
            message: `Retry scheduled: ${result.message}`,
            payload: {
              stage: "retry_scheduled",
              attempt: attempt + 1,
              nextAttemptInMinutes: retryDelayMinutesForAttempt(attempt),
            } as Prisma.InputJsonValue,
          },
        });
        failed += 1;
        continue;
      }
    }

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
      // Anchor posts are synthetic for mention replies — leave their status
      // untouched (approved) so comment.generate never ingests them.
      if (action.source !== "mention_reply") {
        await tx.targetPost.update({
          where: { id: action.targetPostId },
          data: { status: result.ok ? "sent" : "failed" },
        });
      }
      if (action.mentionId) {
        await tx.mention.update({
          where: { id: action.mentionId },
          data: {
            status: result.ok ? "sent" : "failed",
            processedAt: new Date(),
          },
        });
      }
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

/**
 * Auto-reply pipeline for incoming mentions/comments on the workspace's own
 * accounts. Per mention: resolve AutoReplySettings (disabled → ignored),
 * count today's replies against maxRepliesPerDay, generate a contextual reply
 * grounded in the mention text + agent knowledge, risk-scan, then either queue
 * an Approval (approval_required) or schedule the CommentAction directly
 * (auto). The send itself rides the normal comment.send job with
 * source=mention_reply and replyToExternalId pointing at the parent comment.
 */
async function runMentionProcess(limit = 20): Promise<WorkerJobResult> {
  const { runSendPreflight } = await import("@/lib/send-preflight");
  const mentions = await db.mention.findMany({
    where: { status: "new" },
    include: { socialAccount: true },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });

  let drafted = 0;
  let autoScheduled = 0;
  let skipped = 0;
  let failed = 0;
  let quotaFailed = 0;

  for (const mention of mentions) {
    // Atomic claim: overlapping ticks must not generate two replies.
    const claimed = await claimMention(mention.id);
    if (!claimed) continue;

    try {
      const settings = await db.autoReplySettings.findUnique({
        where: { workspaceId: mention.workspaceId },
      });
      if (!settings || !settings.enabled) {
        await db.mention.update({
          where: { id: mention.id },
          data: { status: "ignored", processedAt: new Date() },
        });
        skipped += 1;
        continue;
      }

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const repliesToday = await db.commentAction.count({
        where: {
          workspaceId: mention.workspaceId,
          source: "mention_reply",
          createdAt: { gte: dayStart },
        },
      });
      if (repliesToday >= settings.maxRepliesPerDay) {
        await db.mention.update({
          where: { id: mention.id },
          data: { status: "ignored", processedAt: new Date() },
        });
        skipped += 1;
        continue;
      }

      // Duplicate-reply guard: one reply per (account, mention comment). A
      // re-sent webhook or a user repeating the same comment must not earn a
      // second identical reply. The reply target is the mention's own
      // externalId (the comment id), so this dedupes per parent comment.
      if (mention.socialAccountId) {
        const existingReply = await db.commentAction.findFirst({
          where: {
            workspaceId: mention.workspaceId,
            socialAccountId: mention.socialAccountId,
            source: "mention_reply",
            replyToExternalId: mention.externalId,
            status: { in: ["scheduled", "sending", "sent"] },
          },
          select: { id: true },
        });
        if (existingReply) {
          await db.mention.update({
            where: { id: mention.id },
            data: { status: "ignored", processedAt: new Date() },
          });
          skipped += 1;
          continue;
        }
      }

      const agent = settings.agentId
        ? await db.agent.findFirst({
            where: { id: settings.agentId, workspaceId: mention.workspaceId },
          })
        : await db.agent.findFirst({
            where: { workspaceId: mention.workspaceId, status: "active" },
            orderBy: { createdAt: "asc" },
          });
      if (!agent) {
        await db.mention.update({
          where: { id: mention.id },
          data: { status: "failed", processedAt: new Date() },
        });
        await createNotification({
          workspaceId: mention.workspaceId,
          title: "Auto-reply: belum ada agent",
          body: "Pilih agent di Settings → Auto-Reply agar balasan komentar masuk bisa digenerate.",
          href: "/app/mentions",
        });
        failed += 1;
        continue;
      }

      const chunks = await db.knowledgeChunk.findMany({
        where: {
          workspaceId: mention.workspaceId,
          document: {
            status: "ready",
            OR: [{ agentId: agent.id }, { agentId: null }],
          },
        },
        take: 50,
        orderBy: { createdAt: "desc" },
      });
      const ranked = rankChunks(
        mention.content,
        chunks.map((chunk) => ({ id: chunk.id, content: chunk.content })),
        3,
      );
      const knowledgeContext = ranked.map((item) => item.content);

      let generated: Awaited<ReturnType<typeof generateContextualCommentHybrid>>;
      if (settings.templateText?.trim()) {
        // Template mode (F3): static reply template overrides AI generation —
        // deterministic, zero-credit, still risk-scanned below like any draft.
        const template = settings.templateText.trim();
        const content = renderTemplate(template, {
          authorHandle: mention.authorHandle,
          platform: mention.platform,
          postSnippet: mention.content.slice(0, 140),
          agentName: agent.name,
          topic: mention.parentContent?.slice(0, 140) || null,
        });
        generated = {
          content,
          model: "template",
          providerId: "template",
          riskFlags: ["template_reply"],
          blocked: false,
          source: "template",
        };
      } else {
        try {
          generated = await generateContextualCommentHybrid({
            postContent: mention.content,
            authorHandle: mention.authorHandle,
            platform: mention.platform,
            language: agent.language,
            tone: agent.tone,
            systemPrompt: agent.systemPrompt,
            agentName: agent.name,
            knowledgeContext,
            workspaceId: mention.workspaceId,
            preferredProviderId: agent.aiProviderId,
            preferredModel: agent.model,
            temperature: agent.temperature,
            maxTokens: agent.maxTokens,
            style: agent.style,
            formality: agent.formality,
            emojiPolicy: agent.emojiPolicy,
            ctaStyle: agent.ctaStyle,
            maxSentences: agent.maxSentences,
            bannedTopics: agent.bannedTopics,
            mustInclude: agent.mustInclude,
          });
        } catch (error) {
          const { AiQuotaExceededError, AiModelNotAllowedError } = await import(
            "@/lib/ai/router"
          );
          const message = error instanceof Error ? error.message : "Mention reply generation error";
          await db.mention.update({
            where: { id: mention.id },
            data: { status: "failed", processedAt: new Date() },
          });
          if (
            error instanceof AiQuotaExceededError ||
            error instanceof AiModelNotAllowedError
          ) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const already = await db.notification.findFirst({
              where: {
                workspaceId: mention.workspaceId,
                title: { contains: "AI quota" },
                createdAt: { gte: todayStart },
              },
              select: { id: true },
            });
            if (!already) {
              await createNotification({
                workspaceId: mention.workspaceId,
                title: "AI quota habis — auto-reply dijeda",
                body: `${error.message} Tambahkan API key sendiri, upgrade tier, atau beli kredit pay-as-you-go di Settings → AI.`,
                href: "/app/settings/ai",
              });
            }
          }
          await db.deliveryLog.create({
            data: {
              workspaceId: mention.workspaceId,
              socialAccountId: mention.socialAccountId,
              kind: "mention_ingest",
              connector: "comment_engine",
              mode: getRuntimeModeLabel(),
              ok: false,
              message,
              payload: { stage: "mention_generate_throw", mentionId: mention.id } as Prisma.InputJsonValue,
            },
          });
          quotaFailed += 1;
          continue;
        }
      }

      // Pre-send risk gate before committing the draft/action. Hard-blocked
      // content is parked in approval regardless of mode — never auto-sent.
      const riskRules = await db.riskRule.findMany({
        where: { workspaceId: mention.workspaceId, isActive: true },
        select: { type: true, pattern: true, severity: true },
        take: 100,
      });
      const preflight = runSendPreflight({
        body: generated.content,
        postContent: mention.content,
        customRules: riskRules,
        account: mention.socialAccount
          ? {
              status: mention.socialAccount.status,
              healthScore: mention.socialAccount.healthScore,
              actionsToday: effectiveActionsToday(mention.socialAccount),
              dailyQuota: mention.socialAccount.dailyQuota,
            }
          : null,
        recentBodies: [],
        monthly: null,
      });
      const hardBlocked = preflight.blocked || generated.blocked;

      // CommentDraft/Approval/CommentAction all key off TargetPost. A mention
      // replies to a parent comment whose parent post is external, so anchor
      // the pipeline on a synthetic TargetPost row representing that parent.
      // It is created "approved" so comment.generate never picks it up.
      const parentExternalId = mention.parentExternalId || mention.externalId;
      const anchorPost = await db.targetPost.upsert({
        where: {
          workspaceId_platform_externalId: {
            workspaceId: mention.workspaceId,
            platform: mention.platform,
            externalId: parentExternalId,
          },
        },
        create: {
          workspaceId: mention.workspaceId,
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

      let skippedLocked = false;
      await db.$transaction(async (tx) => {
        // Serialize auto-reply scheduling per workspace on its settings row.
        // Concurrent mention.process ticks (dedicated cron + worker.tick) both
        // passed the pre-check count above; under the row lock the count is
        // re-read against committed rows, so the second tick sees the first
        // tick's action and stops at maxRepliesPerDay instead of exceeding it.
        await tx.$executeRaw`SELECT id FROM "AutoReplySettings" WHERE id = ${settings.id} FOR UPDATE`;
        const lockedRepliesToday = await tx.commentAction.count({
          where: {
            workspaceId: mention.workspaceId,
            source: "mention_reply",
            createdAt: { gte: dayStart },
          },
        });
        if (lockedRepliesToday >= settings.maxRepliesPerDay) {
          await tx.mention.update({
            where: { id: mention.id },
            data: { status: "ignored", processedAt: new Date() },
          });
          skippedLocked = true;
          return;
        }

        const draft = await tx.commentDraft.create({
          data: {
            workspaceId: mention.workspaceId,
            targetPostId: anchorPost.id,
            agentId: agent.id,
            content: generated.content,
            status: "pending",
            model: generated.model,
            providerId: generated.providerId,
            riskFlags: [
              ...generated.riskFlags,
              ...(preflight.risk.flags.length ? preflight.risk.flags : []),
              ...(ranked.length ? ["knowledge_grounded"] : []),
            ],
            mentionId: mention.id,
          },
        });

        if (settings.mode === "auto" && !hardBlocked && mention.socialAccountId) {
          // Auto mode: skip approval, schedule the reply with a human-like
          // delay. The send itself rides comment.send like any other action.
          const delay = pickDelaySeconds(45, 180);
          await tx.commentAction.create({
            data: {
              workspaceId: mention.workspaceId,
              targetPostId: anchorPost.id,
              commentDraftId: draft.id,
              socialAccountId: mention.socialAccountId,
              status: "scheduled",
              scheduledFor: new Date(Date.now() + delay * 1000),
              resultMessage: `Auto-reply scheduled with ${delay}s human-like delay`,
          source: "mention_reply",
          replyToExternalId: mention.externalId,
          replyToAuthor: mention.authorHandle,
          mentionId: mention.id,
            },
          });
          await tx.mention.update({
            where: { id: mention.id },
            data: { status: "approved", processedAt: new Date() },
          });
        } else {
          // approval_required mode, hard-blocked content (never auto-sent), or
          // auto mode without an owning account → operator review.
          await tx.approval.create({
            data: {
              workspaceId: mention.workspaceId,
              targetPostId: anchorPost.id,
              commentDraftId: draft.id,
              status: "pending",
            },
          });
          await tx.mention.update({
            where: { id: mention.id },
            data: { status: "drafted", processedAt: new Date() },
          });
        }
      });

      if (skippedLocked) {
        // Quota was exhausted by a concurrent tick between the pre-check and
        // the locked re-count — the mention is already marked ignored.
        skipped += 1;
        continue;
      }

      await bumpUsage(mention.workspaceId, "generates", 1);
      if (settings.mode === "auto" && !hardBlocked && mention.socialAccountId) {
        autoScheduled += 1;
      } else {
        drafted += 1;
        await createNotification({
          workspaceId: mention.workspaceId,
          title: "Balasan komentar siap review",
          body: `${mention.content.slice(0, 140)}`,
          href: "/app/mentions",
        });
      }
    } catch (error) {
      // Isolate per-mention failures so one bad row cannot stall the batch.
      const message = error instanceof Error ? error.message : "Mention process error";
      await db.mention
        .update({
          where: { id: mention.id, status: "generating" },
          data: { status: "failed", processedAt: new Date() },
        })
        .catch(() => undefined);
      await db.deliveryLog
        .create({
          data: {
            workspaceId: mention.workspaceId,
            socialAccountId: mention.socialAccountId,
            kind: "mention_ingest",
            connector: "mention_pipeline",
            mode: getRuntimeModeLabel(),
            ok: false,
            message,
            payload: { stage: "mention_process_throw", mentionId: mention.id } as Prisma.InputJsonValue,
          },
        })
        .catch(() => undefined);
      failed += 1;
    }
  }

  return {
    job: "mention.process",
    ok: failed === 0,
    message: `Mentions: ${drafted} drafted, ${autoScheduled} auto-scheduled, ${skipped} skipped, ${failed} failed${quotaFailed ? `, ${quotaFailed} failed:quota` : ""}`,
    count: drafted + autoScheduled,
    details: { drafted, autoScheduled, skipped, failed, quotaFailed },
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
  let quotaFailed = 0;
  for (const campaign of campaigns) {
    if (campaign.drafts.length > 0) continue;
    // Atomic claim: overlapping ticks must not generate a full draft set
    // twice for the same campaign.
    const claimed = await claimContentCampaign(campaign.id);
    if (!claimed) continue;
    let posts: Awaited<ReturnType<typeof generateContentPosts>>;
    try {
      posts = await generateContentPosts({
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
    } catch (error) {
      const { AiQuotaExceededError, AiModelNotAllowedError } = await import(
        "@/lib/ai/router"
      );
      if (
        error instanceof AiQuotaExceededError ||
        error instanceof AiModelNotAllowedError
      ) {
        // Fail-closed: pause the campaign + notify once per day, no auto-retry.
        await db.contentCampaign.update({
          where: { id: campaign.id },
          data: { status: "paused" },
        });
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const already = await db.notification.findFirst({
          where: {
            workspaceId: campaign.workspaceId,
            title: { contains: "AI quota" },
            createdAt: { gte: todayStart },
          },
          select: { id: true },
        });
        if (!already) {
          await createNotification({
            workspaceId: campaign.workspaceId,
            title: "AI quota habis — campaign konten dijeda",
            body: `${error.message} Campaign "${campaign.topic}" dijeda. Isi ulang kredit di Settings → AI lalu aktifkan kembali.`,
            href: "/app/settings/ai",
          });
        }
        quotaFailed += 1;
        continue;
      }
      throw error;
    }
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
    message: `Generated ${generated} content drafts${quotaFailed ? `, ${quotaFailed} campaigns paused:quota` : ""}`,
    count: generated,
    details: quotaFailed ? { quotaFailed } : undefined,
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

    // Isolate per-draft failures: a throw from the publisher must not abort the
    // whole batch (stranding remaining due drafts and leaving this one claimed
    // until the 10-min stale sweep).
    let result: Awaited<ReturnType<typeof publishSocialPost>>;
    try {
      result = await publishSocialPost({
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
        // Stable per-draft key — same crash-retry dedupe as comment sends.
        idempotencyKey: `content-draft:${draft.id}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Content publish error";
      await db.contentDraft.update({
        where: { id: draft.id },
        data: { status: "failed", resultMessage: message },
      });
      await db.deliveryLog.create({
        data: {
          workspaceId: draft.workspaceId,
          socialAccountId: draft.socialAccountId,
          kind: "publish_post",
          connector: "unknown",
          mode: getRuntimeModeLabel(),
          ok: false,
          message,
          payload: { stage: "execute_throw" } as Prisma.InputJsonValue,
        },
      });
      failed += 1;
      continue;
    }

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

/**
 * Daily approval digest emails (Brevo). Once-per-day per workspace via
 * DigestMarker; no-op when BREVO_API_KEY is unset or before the slot hour.
 */
async function runDigestApprovals(): Promise<WorkerJobResult> {
  try {
    const { sendDailyApprovalDigest } = await import("@/server/approval-digest");
    const result = await sendDailyApprovalDigest();
    return {
      job: "digest.approvals",
      ok: true,
      message: `Digest sent: ${result.sent}, skipped (already sent): ${result.skipped}, errors: ${result.errors}`,
      count: result.sent,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[digest.approvals] failed", error);
    return {
      job: "digest.approvals",
      ok: false,
      message: `Digest failed: ${message}`,
      count: 0,
    };
  }
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

/**
 * Notify workspaces crossing AI credit thresholds. 80% and 100% each fire at
 * most once per quota period (deduped via a stable marker in the body).
 */
async function runAiQuotaNotify(): Promise<WorkerJobResult> {
  const { listAiQuotaStatuses } = await import("@/lib/ai/billing");
  const statuses = await listAiQuotaStatuses();

  let notified = 0;
  for (const s of statuses) {
    const thresholds: Array<{ pct: number; hit: boolean }> = [
      { pct: 100, hit: s.usagePct >= 100 },
      { pct: 80, hit: s.usagePct >= 80 && s.usagePct < 100 },
    ];
    for (const t of thresholds) {
      if (!t.hit) continue;
      // Stable dedup marker per quota period + threshold.
      const marker = `ai-quota-${t.pct}:${s.quotaPeriodEnd.toISOString().slice(0, 10)}`;
      const exists = await db.notification.findFirst({
        where: { workspaceId: s.workspaceId, body: { contains: marker } },
        select: { id: true },
      });
      if (exists) break; // already alerted at this (or a higher) threshold

      const usedStr = new Intl.NumberFormat("id-ID").format(Number(s.usedThisPeriod));
      const quotaStr = new Intl.NumberFormat("id-ID").format(Number(s.monthlyCredits));
      const exhausted = t.pct >= 100;
      await db.notification.create({
        data: {
          workspaceId: s.workspaceId,
          title: exhausted
            ? "Kredit AI bulan ini habis"
            : `Kredit AI ${s.usagePct}% terpakai`,
          body: exhausted
            ? `Kuota Komenin AI (${quotaStr} kredit) sudah habis. ${s.tier === "pro_max" ? "Panggilan berikutnya memakai saldo pay-as-you-go." : "Upgrade tier atau beli kredit pay-as-you-go untuk melanjutkan."} [${marker}]`
            : `Anda sudah memakai ${usedStr} / ${quotaStr} kredit AI bulan ini (${s.usagePct}%). [${marker}]`,
          href: "/app/settings/ai",
        },
      });
      try {
        const { dispatchExternal } = await import("@/lib/notify/dispatcher");
        await dispatchExternal(
          exhausted ? "ai.quota_exhausted" : "ai.quota_warning",
          s.workspaceId,
          {
            title: exhausted ? "Kredit AI bulan ini habis" : `Kredit AI ${s.usagePct}% terpakai`,
            body: `Terpakai ${usedStr} / ${quotaStr} kredit (${s.usagePct}%).`,
            href: "/app/settings/ai",
          },
        );
      } catch {
        // non-fatal
      }
      notified += 1;
      break; // one notification per run per workspace
    }
  }

  return {
    job: "ai.quota_notify",
    ok: true,
    message: `AI quota notifications sent: ${notified}`,
    count: notified,
  };
}

/**
 * Roll monthly AI quota windows, expire ended subscription terms, and
 * materialize PAYG grant expiry. Idempotent via per-row claims + operationId.
 */
async function runAiExpire(): Promise<WorkerJobResult> {
  const { runAiExpiryAndRenewal } = await import("@/lib/ai/billing");
  const result = await runAiExpiryAndRenewal();
  return {
    job: "ai.expire",
    ok: true,
    message: `AI expiry: ${result.quotaRenewed} quota rolled, ${result.subExpired} subs expired, ${result.paygExpired} PAYG grants expired`,
    count: result.quotaRenewed + result.subExpired + result.paygExpired,
    details: result,
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
      case "mention.process":
        result = await runMentionProcess();
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
      case "digest.approvals":
        result = await runDigestApprovals();
        break;
      case "billing.expire":
        result = await runBillingExpire();
        break;
      case "ai.quota_notify":
        result = await runAiQuotaNotify();
        break;
      case "ai.expire":
        result = await runAiExpire();
        break;
      case "connector.refresh_tokens":
        result = await runConnectorRefreshTokens();
        break;
      case "worker.tick": {
        // Recover work stranded in a transient claim state from a crashed or
        // timed-out previous tick before fanning out.
        await releaseStaleClaims().catch(() => 0);
        // mention.process intentionally NOT in this fan-out: the dedicated
        // cron (?job=mention.process, */5) runs it — running it here too would
        // make two same-cadence invocations race over the same mention batch.
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
          runAiQuotaNotify(),
          runAiExpire(),
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
  "mention.process",
  "content.generate",
  "content.publish",
  "knowledge.ingest",
  "skill.execute",
  "usage.rollup",
  "notify.dispatch",
  "digest.approvals",
  "billing.expire",
  "ai.quota_notify",
  "ai.expire",
  "connector.refresh_tokens",
];

