/**
 * Komenin AI billing — metering, quota resolution, and the credit ledger.
 *
 * Design (spec: docs/superpowers/specs/2026-08-27-ai-agent-monetization.md):
 * - 1 credit = 1 token (input + output)
 * - Sources in priority order: BYOK (own key, free) → subscription quota →
 *   PAYG balance → fail-closed
 * - AiCreditLedger is append-only; balance = sum of credits over non-expired
 *   rows. Every financial effect carries a unique `operationId` so grants,
 *   usage, and refunds are idempotent across webhook retries.
 * - WorkspaceAiSubscription splits the paid commitment window (termStart/End)
 *   from the independently rolling monthly quota window (quotaPeriodStart/End).
 */

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { addMonths } from "@/lib/billing/catalog";
import type { AiTier } from "@prisma/client";

export const AI_TIER_CREDITS: Record<Exclude<AiTier, "none">, bigint> = {
  starter: 1_000_000n,
  pro: 5_000_000n,
  pro_max: 25_000_000n,
};

/** Only Pro Max auto-continues to PAYG when the subscription quota is spent. */
export function tierAllowsPaygFallback(tier: AiTier): boolean {
  return tier === "pro_max";
}

export type AiBillingSource = "own_key" | "subscription" | "payg";

export type ResolveAiBillingResult =
  | {
      ok: true;
      source: AiBillingSource;
      /** Remaining credits for the resolved source (null for own_key). */
      remaining: bigint | null;
      tier: AiTier;
    }
  | {
      ok: false;
      reason: "no_source";
      message: string;
      tier: AiTier;
    };

type DbLike = Pick<typeof db, "aiCreditLedger" | "workspaceAiSubscription">;

/** Sum of PAYG ledger credits that are still valid (grants not expired). */
async function paygBalance(tx: DbLike, workspaceId: string): Promise<bigint> {
  const rows = await tx.aiCreditLedger.aggregate({
    where: {
      workspaceId,
      kind: { in: ["grant", "payg_use", "refund", "expire"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    _sum: { credits: true },
  });
  return rows._sum.credits ?? 0n;
}

/** Credits consumed from the subscription quota within the current quota period. */
async function subscriptionUsed(
  tx: DbLike,
  workspaceId: string,
  quotaPeriodStart: Date,
): Promise<bigint> {
  const rows = await tx.aiCreditLedger.aggregate({
    where: {
      workspaceId,
      kind: "subscription_use",
      createdAt: { gte: quotaPeriodStart },
    },
    _sum: { credits: true },
  });
  // ledger stores negative values for usage
  return -(rows._sum.credits ?? 0n);
}

function isSubActive(
  sub: { status: string; termStart: Date; termEnd: Date } | null,
  now: Date,
): boolean {
  return Boolean(
    sub && sub.status === "active" && sub.termStart <= now && sub.termEnd > now,
  );
}

/**
 * Decide which source funds the next AI call for a workspace. BYOK is used
 * when the workspace prefers its own key AND has an enabled provider; the
 * preference is persisted on `Workspace.aiPreferOwnKey`.
 */
export async function resolveAiBilling(input: {
  workspaceId: string;
  /** Caller already knows a usable workspace provider exists (BYOK). */
  hasOwnProvider?: boolean;
  /** Optional override; defaults to the persisted workspace preference. */
  preferOwnKey?: boolean;
}): Promise<ResolveAiBillingResult> {
  const [subscription, workspace] = await Promise.all([
    db.workspaceAiSubscription.findUnique({
      where: { workspaceId: input.workspaceId },
    }),
    db.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { aiPreferOwnKey: true },
    }),
  ]);

  const preferOwnKey = input.preferOwnKey ?? workspace?.aiPreferOwnKey ?? true;

  const now = new Date();
  const activeSub = isSubActive(subscription, now) ? subscription : null;
  const tier = activeSub?.tier ?? "none";

  if (preferOwnKey && input.hasOwnProvider) {
    return { ok: true, source: "own_key", remaining: null, tier };
  }

  if (activeSub && activeSub.tier !== "none") {
    const quota = activeSub.monthlyCredits;
    const used = await subscriptionUsed(db, input.workspaceId, activeSub.quotaPeriodStart);
    if (quota > used) {
      return {
        ok: true,
        source: "subscription",
        remaining: quota - used,
        tier,
      };
    }
    // Quota spent — Pro Max falls through to PAYG, others stop.
    if (!tierAllowsPaygFallback(tier)) {
      return {
        ok: false,
        reason: "no_source",
        message:
          "AI credit langganan bulan ini sudah habis. Upgrade tier atau beli kredit pay-as-you-go untuk melanjutkan.",
        tier,
      };
    }
  }

  const balance = await paygBalance(db, input.workspaceId);
  if (balance > 0n) {
    return { ok: true, source: "payg", remaining: balance, tier };
  }

  if (activeSub && activeSub.tier !== "none") {
    // Pro Max with spent quota AND empty PAYG balance
    return {
      ok: false,
      reason: "no_source",
      message: "AI credit habis (kuota langganan dan saldo pay-as-you-go). Beli kredit untuk melanjutkan.",
      tier,
    };
  }

  return {
    ok: false,
    reason: "no_source",
    message:
      "Belum ada sumber AI aktif. Tambahkan API key sendiri di Settings → AI, atau berlangganan Komenin AI.",
    tier: "none",
  };
}

/**
 * Record one AI call. For `own_key` calls only a usage event is written
 * (creditsUsed=0) — analytics without charge. For subscription/payg the
 * ledger is debited atomically and linked to the usage event. Both writes
 * carry a unique operation/request id so a retried call cannot double-charge.
 */
export async function recordAiUsage(input: {
  workspaceId: string;
  source: AiBillingSource;
  model: string;
  inputTokens: number;
  outputTokens: number;
  providerId?: string | null;
  latencyMs?: number | null;
  refType?: string | null;
  refId?: string | null;
  /** Stable id for this call; auto-generated when omitted. */
  requestId?: string;
  /** True when tokens came from provider `usage`, false when estimated. */
  reported?: boolean;
}): Promise<{ creditsUsed: bigint }> {
  const credits = BigInt(Math.max(0, input.inputTokens) + Math.max(0, input.outputTokens));
  const requestId = input.requestId ?? `req_${randomUUID()}`;
  const usageSource = input.reported === false ? "estimated" : "reported";

  await db.$transaction(async (tx) => {
    const event = await tx.aiUsageEvent.create({
      data: {
        workspaceId: input.workspaceId,
        requestId,
        providerId:
          input.source === "own_key"
            ? input.providerId ?? null
            : input.providerId ?? `komenin:${input.model}`,
        model: input.model,
        inputTokens: Math.max(0, input.inputTokens),
        outputTokens: Math.max(0, input.outputTokens),
        creditsUsed: input.source === "own_key" ? 0n : credits,
        billedTo: input.source,
        usageSource,
        latencyMs: input.latencyMs ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      },
    });

    if (input.source === "own_key") return;

    const kind = input.source === "subscription" ? "subscription_use" : "payg_use";
    await tx.aiCreditLedger.create({
      data: {
        workspaceId: input.workspaceId,
        operationId: `use:${requestId}`,
        kind,
        credits: -credits,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        usageEventId: event.id,
      },
    });
  });

  return { creditsUsed: input.source === "own_key" ? 0n : credits };
}

/** Grant PAYG credits (purchase) — appended as an idempotent grant ledger row. */
export async function grantAiCredits(input: {
  workspaceId: string;
  credits: bigint;
  refType?: string;
  refId?: string;
  expiresAt?: Date | null;
  sourceOrderId?: string | null;
  /** Idempotency key; defaults to `order:<sourceOrderId>` or a random id. */
  operationId?: string;
}): Promise<void> {
  const operationId =
    input.operationId ??
    (input.sourceOrderId ? `order:${input.sourceOrderId}:grant` : `grant_${randomUUID()}`);

  const last = await db.aiCreditLedger.findFirst({
    where: { workspaceId: input.workspaceId, kind: { in: ["grant", "payg_use", "refund", "expire"] } },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });

  await db.aiCreditLedger.upsert({
    where: { operationId },
    create: {
      workspaceId: input.workspaceId,
      operationId,
      kind: "grant",
      credits: input.credits,
      balanceAfter: (last?.balanceAfter ?? 0n) + input.credits,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      sourceOrderId: input.sourceOrderId ?? null,
      expiresAt: input.expiresAt ?? null,
    },
    // Retry of the same operation is a no-op (idempotent).
    update: {},
  });
}

/** Snapshot for UI: quota, usage, payg balance, tier, current quota period end. */
export async function getAiBalance(workspaceId: string): Promise<{
  tier: AiTier;
  monthlyCredits: bigint;
  usedThisPeriod: bigint;
  paygBalance: bigint;
  periodEnd: Date | null;
}> {
  const subscription = await db.workspaceAiSubscription.findUnique({
    where: { workspaceId },
  });
  const now = new Date();
  const activeSub =
    subscription && subscription.status === "active" && subscription.termEnd > now
      ? subscription
      : null;

  const [used, payg] = await Promise.all([
    activeSub
      ? subscriptionUsed(db, workspaceId, activeSub.quotaPeriodStart)
      : Promise.resolve(0n),
    paygBalance(db, workspaceId),
  ]);

  return {
    tier: activeSub?.tier ?? "none",
    monthlyCredits: activeSub?.monthlyCredits ?? 0n,
    usedThisPeriod: used,
    paygBalance: payg,
    periodEnd: activeSub?.quotaPeriodEnd ?? null,
  };
}

// ---------------------------------------------------------------------------
// Fulfillment helpers (used by the Midtrans webhook in src/server/billing.ts).
// Each runs inside the caller's transaction and is idempotent via unique
// operationId / sourceOrderId so replayed webhooks cannot double-fulfill.
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Map an AI subscription plan code (ai_starter_* / ai_pro_* / ai_pro_max_*) to a tier. */
export function tierFromPlanCode(code: string): Exclude<AiTier, "none"> | null {
  if (code.startsWith("ai_starter")) return "starter";
  if (code.startsWith("ai_pro_max")) return "pro_max";
  if (code.startsWith("ai_pro")) return "pro";
  return null;
}

/** Grant PAYG credits for a paid order (idempotent). */
export async function fulfillAiCreditsOrder(
  tx: Tx,
  input: { workspaceId: string; orderId: string; credits: bigint; now: Date },
): Promise<void> {
  if (input.credits <= 0n) return;
  const operationId = `order:${input.orderId}:grant`;
  const expiresAt = new Date(input.now.getTime() + 365 * 24 * 3600 * 1000);

  const last = await tx.aiCreditLedger.findFirst({
    where: {
      workspaceId: input.workspaceId,
      kind: { in: ["grant", "payg_use", "refund", "expire"] },
    },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });

  await tx.aiCreditLedger.upsert({
    where: { operationId },
    create: {
      workspaceId: input.workspaceId,
      operationId,
      kind: "grant",
      credits: input.credits,
      balanceAfter: (last?.balanceAfter ?? 0n) + input.credits,
      refType: "order",
      refId: input.orderId,
      sourceOrderId: input.orderId,
      expiresAt,
    },
    update: {},
  });
}

/**
 * Activate an AI subscription for a paid order (idempotent via unique
 * sourceOrderId). The paid commitment term is `durationMonths`; the credit
 * quota rolls monthly, so annual plans still get fresh credits each month.
 */
export async function fulfillAiSubscriptionOrder(
  tx: Tx,
  input: {
    workspaceId: string;
    orderId: string;
    planCode: string;
    durationMonths: number;
    monthlyCredits: bigint;
    now: Date;
  },
): Promise<void> {
  const tier = tierFromPlanCode(input.planCode);
  if (!tier) return;

  const termStart = input.now;
  const termEnd = addMonths(input.now, input.durationMonths);
  const quotaPeriodStart = input.now;
  const quotaPeriodEnd = addMonths(input.now, 1);

  const create = {
    workspaceId: input.workspaceId,
    tier,
    monthlyCredits: input.monthlyCredits,
    status: "active" as const,
    termStart,
    termEnd,
    quotaPeriodStart,
    quotaPeriodEnd,
    sourceOrderId: input.orderId,
  };

  try {
    await tx.workspaceAiSubscription.upsert({
      where: { workspaceId: input.workspaceId },
      create,
      update: {
        tier,
        monthlyCredits: input.monthlyCredits,
        status: "active",
        termStart,
        termEnd,
        quotaPeriodStart,
        quotaPeriodEnd,
        sourceOrderId: input.orderId,
      },
    });
  } catch (error) {
    // Unique sourceOrderId → this order already activated the subscription.
    // A replayed webhook must not re-activate; treat as already fulfilled.
    if (isUniqueViolation(error)) return;
    throw error;
  }
}

/** Reverse a fulfilled order on refund/chargeback (idempotent). */
export async function refundAiOrder(
  tx: Tx,
  input: { workspaceId: string; orderId: string; now: Date },
): Promise<{ reversed: boolean }> {
  let reversed = false;

  // 1) Deactivate any AI subscription this order activated.
  const sub = await tx.workspaceAiSubscription.findUnique({
    where: { sourceOrderId: input.orderId },
  });
  if (sub && sub.status === "active") {
    await tx.workspaceAiSubscription.update({
      where: { id: sub.id },
      data: { status: "canceled", termEnd: input.now, quotaPeriodEnd: input.now },
    });
    reversed = true;
  }

  // 2) Reverse the PAYG grant this order created (only the still-unspent part).
  const grant = await tx.aiCreditLedger.findUnique({
    where: { operationId: `order:${input.orderId}:grant` },
  });
  if (grant) {
    const refundOpId = `order:${input.orderId}:refund`;
    const existing = await tx.aiCreditLedger.findUnique({
      where: { operationId: refundOpId },
    });
    if (!existing) {
      // How much of this grant is still unspent (grants expire FIFO by date).
      const spentAfter = await tx.aiCreditLedger.aggregate({
        where: {
          workspaceId: input.workspaceId,
          kind: "payg_use",
          createdAt: { gt: grant.createdAt },
        },
        _sum: { credits: true },
      });
      const spent = -(spentAfter._sum.credits ?? 0n);
      const unspent = grant.credits - spent > 0n ? grant.credits - spent : 0n;

      if (unspent > 0n) {
        await tx.aiCreditLedger.create({
          data: {
            workspaceId: input.workspaceId,
            operationId: refundOpId,
            kind: "refund",
            credits: -unspent,
            refType: "order",
            refId: input.orderId,
            sourceOrderId: input.orderId,
          },
        });
      } else {
        // Mark the refund as processed even when nothing is recoverable.
        await tx.aiCreditLedger.create({
          data: {
            workspaceId: input.workspaceId,
            operationId: refundOpId,
            kind: "refund",
            credits: 0n,
            refType: "order",
            refId: input.orderId,
            sourceOrderId: input.orderId,
          },
        });
      }
      reversed = true;
    }
  }

  return { reversed };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}
