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

type DbLike = Pick<
  typeof db,
  "aiCreditLedger" | "workspaceAiSubscription" | "workspaceAiBalance"
>;

/**
 * Apply a PAYG ledger effect to the cached WorkspaceAiBalance.paygCredits
 * counter inside the same transaction. The counter is a rebuildable
 * projection for READ paths (UI/analytics); the authoritative money decisions
 * (reservation guard, resolve) always read the ledger. `paygCredits` here
 * tracks net grant−use−refund−expire (reservations excluded so the UI shows
 * the settled balance).
 */
async function applyPaygBalanceDelta(
  tx: DbLike,
  input: { workspaceId: string; credits: bigint },
): Promise<void> {
  await tx.workspaceAiBalance.upsert({
    where: { workspaceId: input.workspaceId },
    create: { workspaceId: input.workspaceId, paygCredits: input.credits },
    update: { paygCredits: { increment: input.credits } },
  });
}

/**
 * Sum of PAYG ledger credits still valid (grants not expired), minus open
 * PAYG reservations. Bucket-scoped: only rows whose `source` is 'payg' (or
 * NULL for grant/refund/expire, which are PAYG-only kinds) are summed, so a
 * subscription reservation never reduces the PAYG balance.
 */
async function paygBalance(tx: DbLike, workspaceId: string): Promise<bigint> {
  const rows = await tx.aiCreditLedger.aggregate({
    where: {
      workspaceId,
      kind: { in: ["grant", "payg_use", "refund", "expire", "reservation", "reservation_release"] },
      // grant/refund/expire have source NULL (PAYG-only); reservation/use rows
      // carry their bucket explicitly.
      OR: [{ source: null }, { source: "payg" }],
      AND: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    },
    _sum: { credits: true },
  });
  return rows._sum.credits ?? 0n;
}

/**
 * Credits consumed from the subscription quota this period, plus open
 * SUBSCRIPTION reservations. Bucket-scoped so a PAYG reservation (e.g. after
 * Pro Max falls back) never inflates subscription usage.
 */
async function subscriptionUsed(
  tx: DbLike,
  workspaceId: string,
  quotaPeriodStart: Date,
): Promise<bigint> {
  const rows = await tx.aiCreditLedger.aggregate({
    where: {
      workspaceId,
      kind: { in: ["subscription_use", "reservation", "reservation_release"] },
      source: "subscription",
      createdAt: { gte: quotaPeriodStart },
    },
    _sum: { credits: true },
  });
  // ledger stores negative values for usage/reservation, positive for release
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
      select: { aiPreferOwnKey: true, aiPaygFallbackEnabled: true },
    }),
  ]);

  const preferOwnKey = input.preferOwnKey ?? workspace?.aiPreferOwnKey ?? true;
  const paygFallbackEnabled = workspace?.aiPaygFallbackEnabled ?? true;

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
    // Quota spent — Pro Max falls through to PAYG (when enabled), others stop.
    if (!tierAllowsPaygFallback(tier) || !paygFallbackEnabled) {
      return {
        ok: false,
        reason: "no_source",
        message: paygFallbackEnabled
          ? "AI credit langganan bulan ini sudah habis. Upgrade tier atau beli kredit pay-as-you-go untuk melanjutkan."
          : "AI credit langganan bulan ini sudah habis dan fallback pay-as-you-go dimatikan. Upgrade tier, beli kredit, atau aktifkan fallback di Settings → AI.",
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
 * Atomically reserve `amount` credits for a Komenin-funded call. This closes
 * the check-then-debit race: the remaining-balance guard and the reservation
 * row are written in ONE transaction that re-reads the balance with a lock,
 * so concurrent calls can never both pass the check and overdraw.
 *
 * Returns the reservation operationId on success, or null when the source has
 * insufficient balance (caller must fail-closed / pick another source).
 */
export async function reserveAiCredits(input: {
  workspaceId: string;
  source: Exclude<AiBillingSource, "own_key">;
  amount: bigint;
  requestId: string;
  refType?: string | null;
  refId?: string | null;
}): Promise<string | null> {
  if (input.amount <= 0n) return `rsv:${input.requestId}`;
  const operationId = `rsv:${input.requestId}`;

  return db.$transaction(async (tx) => {
    // Serialize concurrent reservations for this workspace on a stable lock.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.workspaceId}))`;

    // Idempotency: a retried reservation for the same request returns the
    // existing operationId instead of double-reserving.
    const existing = await tx.aiCreditLedger.findUnique({
      where: { operationId },
      select: { operationId: true },
    });
    if (existing) return existing.operationId;

    const available = await currentSourceBalance(tx, input.workspaceId, input.source);
    if (available < input.amount) return null;

    await tx.aiCreditLedger.create({
      data: {
        workspaceId: input.workspaceId,
        operationId,
        kind: "reservation",
        source: input.source,
        credits: -input.amount,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      },
    });
    return operationId;
  });
}

/** Release an unused reservation (e.g. the upstream call failed). */
export async function releaseAiReservation(input: {
  workspaceId: string;
  requestId: string;
}): Promise<void> {
  const reservationId = `rsv:${input.requestId}`;
  const releaseId = `rls:${input.requestId}`;
  await db.$transaction(async (tx) => {
    const reservation = await tx.aiCreditLedger.findUnique({
      where: { operationId: reservationId },
      select: { credits: true, source: true },
    });
    if (!reservation) return; // nothing to release
    const already = await tx.aiCreditLedger.findUnique({
      where: { operationId: releaseId },
      select: { operationId: true },
    });
    if (already) return; // already released/settled
    await tx.aiCreditLedger.create({
      data: {
        workspaceId: input.workspaceId,
        operationId: releaseId,
        kind: "reservation_release",
        source: reservation.source,
        credits: -reservation.credits, // add back the reserved (negative) amount
      },
    });
  });
}

/** Current balance for a funding source, reading reservations into account. */
async function currentSourceBalance(
  tx: DbLike,
  workspaceId: string,
  source: Exclude<AiBillingSource, "own_key">,
): Promise<bigint> {
  if (source === "payg") {
    return paygBalance(tx, workspaceId);
  }
  const sub = await tx.workspaceAiSubscription.findUnique({
    where: { workspaceId },
    select: { monthlyCredits: true, quotaPeriodStart: true },
  });
  if (!sub) return 0n;
  const used = await subscriptionUsed(tx, workspaceId, sub.quotaPeriodStart);
  return sub.monthlyCredits - used;
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

  // Idempotency: a retried call with the same requestId is a no-op (the usage
  // event's requestId is unique), so a retried metering write never double-charges.
  let settledCredits = input.source === "own_key" ? 0n : credits;
  await db.$transaction(async (tx) => {
    const existing = await tx.aiUsageEvent.findUnique({ where: { requestId } });
    if (existing) return;

    // Serialize settlement per workspace so concurrent completions can't both
    // overdraw when the ACTUAL token count exceeds the reserved estimate.
    if (input.source !== "own_key") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.workspaceId}))`;
    }

    // For Komenin-funded calls, clamp the debit to the available balance so the
    // ledger never goes negative (a runaway estimate can't make us pay upstream
    // for usage the workspace's balance can't cover). The usage event records
    // the TRUE tokens (analytics), but creditsUsed reflects what was charged.
    let chargeable = credits;
    if (input.source !== "own_key") {
      const available = await currentSourceBalance(tx, input.workspaceId, input.source);
      chargeable = available > 0n ? (credits < available ? credits : available) : 0n;
    }

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
        creditsUsed: input.source === "own_key" ? 0n : chargeable,
        billedTo: input.source,
        usageSource,
        latencyMs: input.latencyMs ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      },
    });

    if (input.source === "own_key") return;

    // Settle the reservation (if one was made) before recording actual usage:
    // release the reserved amount, then debit the real cost. Net effect is the
    // actual charge; any over-reserved amount returns to the balance.
    const reservation = await tx.aiCreditLedger.findUnique({
      where: { operationId: `rsv:${requestId}` },
      select: { credits: true, source: true },
    });
    if (reservation) {
      const released = await tx.aiCreditLedger.findUnique({
        where: { operationId: `rls:${requestId}` },
        select: { operationId: true },
      });
      if (!released) {
        await tx.aiCreditLedger.create({
          data: {
            workspaceId: input.workspaceId,
            operationId: `rls:${requestId}`,
            kind: "reservation_release",
            source: reservation.source,
            credits: -reservation.credits,
          },
        });
      }
    }

    const kind = input.source === "subscription" ? "subscription_use" : "payg_use";
    await tx.aiCreditLedger.create({
      data: {
        workspaceId: input.workspaceId,
        operationId: `use:${requestId}`,
        kind,
        source: input.source,
        credits: -chargeable,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        usageEventId: event.id,
      },
    });
    // Maintain the cached PAYG balance for UI reads (settled usage only).
    if (input.source === "payg" && chargeable > 0n) {
      await applyPaygBalanceDelta(tx, { workspaceId: input.workspaceId, credits: -chargeable });
    }
    settledCredits = chargeable;
  });

  return { creditsUsed: settledCredits };
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
    cachedPaygBalance(workspaceId),
  ]);

  return {
    tier: activeSub?.tier ?? "none",
    monthlyCredits: activeSub?.monthlyCredits ?? 0n,
    usedThisPeriod: used,
    paygBalance: payg,
    periodEnd: activeSub?.quotaPeriodEnd ?? null,
  };
}

/**
 * Read the cached PAYG balance for UI. On a cold cache (no counter row yet,
 * e.g. workspaces that existed before the cache) it falls back to the ledger
 * aggregate and back-fills the counter so subsequent reads are O(1).
 */
async function cachedPaygBalance(workspaceId: string): Promise<bigint> {
  const cached = await db.workspaceAiBalance.findUnique({
    where: { workspaceId },
    select: { paygCredits: true },
  });
  if (cached) return cached.paygCredits;

  const authoritative = await paygBalance(db, workspaceId);
  await db.workspaceAiBalance
    .upsert({
      where: { workspaceId },
      create: { workspaceId, paygCredits: authoritative },
      update: { paygCredits: authoritative },
    })
    .catch(() => undefined); // best-effort back-fill
  return authoritative;
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

  // Insert-if-absent so the cache increment runs exactly once per real grant.
  const existing = await tx.aiCreditLedger.findUnique({ where: { operationId } });
  if (existing) return; // idempotent retry — no new grant, no cache change

  await tx.aiCreditLedger.create({
    data: {
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
  });
  await applyPaygBalanceDelta(tx, {
    workspaceId: input.workspaceId,
    credits: input.credits,
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

  // Read the existing subscription to decide renewal vs tier change.
  // - No sub / same tier  → (re)activate or renew/extend the term immediately.
  // - Different tier      → per spec §3.4 + owner decision #3 (no proration):
  //   extend the paid TERM now but queue the tier change as pending*, applied
  //   by the quota-roll job at the next quota boundary. The user keeps their
  //   current tier's credits until then.
  const existing = await tx.workspaceAiSubscription.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const isTierChange = Boolean(existing && existing.tier !== tier);

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

  const update = isTierChange
    ? {
        // Extend the paid term; queue the tier change for the next quota boundary.
        status: "active" as const,
        termStart,
        termEnd,
        pendingTier: tier,
        pendingMonthlyCredits: input.monthlyCredits,
        pendingPlanCode: input.planCode,
        sourceOrderId: input.orderId,
      }
    : {
        // Renewal / fresh activation: apply immediately.
        tier,
        monthlyCredits: input.monthlyCredits,
        status: "active" as const,
        termStart,
        termEnd,
        quotaPeriodStart,
        quotaPeriodEnd,
        pendingTier: null,
        pendingMonthlyCredits: null,
        pendingPlanCode: null,
        sourceOrderId: input.orderId,
      };

  try {
    await tx.workspaceAiSubscription.upsert({
      where: { workspaceId: input.workspaceId },
      create,
      update,
    });
  } catch (error) {
    // Unique sourceOrderId → this order already activated the subscription.
    // A replayed webhook must not re-activate; treat as already fulfilled.
    if (isUniqueViolation(error)) return;
    throw error;
  }

  // Tag the order so a LATER refund can still find and deactivate the AI
  // subscription even after a renewal moved `sourceOrderId` to a newer order.
  // (sourceOrderId only ever points at the most recent activating order.)
  await tx.subscriptionOrder.update({
    where: { id: input.orderId },
    data: {
      metadata: {
        aiSubscriptionActivated: true,
        aiTier: tier,
      },
    },
  });
}

/**
 * Compute how much of a specific PAYG grant is still unspent, allocating usage
 * FIFO across all of the workspace's grants (oldest first). Correct even when
 * the workspace holds multiple grants — a naive "sum(payg_use) after
 * grant.createdAt" over-counts spend against newer grants and under-claws
 * older ones.
 */
async function computeUnspentGrantPortion(
  tx: DbLike,
  workspaceId: string,
  grant: { id: string; credits: bigint; createdAt: Date },
): Promise<bigint> {
  const [grants, uses] = await Promise.all([
    tx.aiCreditLedger.findMany({
      where: { workspaceId, kind: "grant" },
      select: { id: true, credits: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    tx.aiCreditLedger.findMany({
      where: { workspaceId, kind: "payg_use" },
      select: { credits: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Remaining per grant, walking usage oldest-first across grants oldest-first.
  const remaining = new Map<string, bigint>(grants.map((g) => [g.id, g.credits]));
  for (const use of uses) {
    let toAllocate = -use.credits; // usage rows are negative
    for (const g of grants) {
      if (toAllocate <= 0n) break;
      const avail = remaining.get(g.id) ?? 0n;
      if (avail <= 0n) continue;
      const take = avail < toAllocate ? avail : toAllocate;
      remaining.set(g.id, avail - take);
      toAllocate -= take;
    }
  }
  return remaining.get(grant.id) ?? 0n;
}

/** Reverse a fulfilled order on refund/chargeback (idempotent). */
export async function refundAiOrder(
  tx: Tx,
  input: { workspaceId: string; orderId: string; now: Date },
): Promise<{ reversed: boolean }> {
  let reversed = false;

  // 1) Deactivate the AI subscription this order activated. Lookup covers two
  // cases: (a) the order is the CURRENT sourceOrderId (no renewal since), and
  // (b) an older order that activated the sub before a renewal moved
  // sourceOrderId to a newer order — those are tagged in metadata at fulfill
  // time so their refund can still find and cancel the subscription.
  let sub = await tx.workspaceAiSubscription.findUnique({
    where: { sourceOrderId: input.orderId },
  });
  if (!sub) {
    const activatedOrder = await tx.subscriptionOrder.findFirst({
      where: {
        id: input.orderId,
        workspaceId: input.workspaceId,
        // metadata.aiSubscriptionActivated === true (set at fulfillment)
        metadata: { path: ["aiSubscriptionActivated"], equals: true },
      },
      select: { id: true },
    });
    if (activatedOrder) {
      sub = await tx.workspaceAiSubscription.findUnique({
        where: { workspaceId: input.workspaceId },
      });
    }
  }
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
      // How much of this grant is still unspent (FIFO allocation across all grants).
      const unspent = await computeUnspentGrantPortion(tx, input.workspaceId, grant);

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
        await applyPaygBalanceDelta(tx, {
          workspaceId: input.workspaceId,
          credits: -unspent,
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

/**
 * Reverse a PROPORTIONAL part of an order's AI credits on a partial refund
 * (F4). The fraction is the refunded IDR amount over the order total. PAYG
 * grants are clawed back first (only the still-unspent portion, capped at the
 * proportional share); subscription credits are not retroactively clawed — the
 * subscription stays active but a proportional overage note is recorded in the
 * ledger metadata via refId so operators can reconcile.
 *
 * Idempotency is per refund EVENT, not per order: the operationId carries the
 * Midtrans transaction id (or the refunded amount as a fallback discriminator),
 * so staged partial refunds each claw back their own proportional share while
 * a redelivery of the same event stays a no-op. A partial event arriving after
 * a full refund/chargeback is skipped entirely — the grant was already
 * reversed, so any further clawback would double-count.
 */
export async function refundAiOrderPartial(
  tx: Tx,
  input: {
    workspaceId: string;
    orderId: string;
    /** Refunded amount in IDR (Midtrans gross_amount for this event). */
    refundAmountIdr: number;
    /** Original order total in IDR. */
    orderTotalIdr: number;
    /** Midtrans transaction id for this refund event, when available. */
    transactionId?: string | null;
    now: Date;
  },
): Promise<{ reversed: boolean; creditsRefunded: bigint }> {
  // A full refund/chargeback already reversed the grant — nothing left to do.
  const fullRefund = await tx.aiCreditLedger.findUnique({
    where: { operationId: `order:${input.orderId}:refund` },
  });
  if (fullRefund) return { reversed: false, creditsRefunded: 0n };

  const discriminator =
    input.transactionId?.trim() || `amount-${input.refundAmountIdr}`;
  const refundOpId = `order:${input.orderId}:partial-refund:${discriminator}`;
  const existing = await tx.aiCreditLedger.findFirst({
    where: { operationId: refundOpId },
  });
  if (existing) return { reversed: false, creditsRefunded: 0n };

  if (input.orderTotalIdr <= 0 || input.refundAmountIdr <= 0) {
    return { reversed: false, creditsRefunded: 0n };
  }
  const grant = await tx.aiCreditLedger.findUnique({
    where: { operationId: `order:${input.orderId}:grant` },
  });
  if (!grant) return { reversed: false, creditsRefunded: 0n };

  // Proportional share of the order's credits, floored; at least 1 credit when
  // any positive fraction is refunded so rounding never zeroes out refunds.
  const fraction = Math.min(1, input.refundAmountIdr / input.orderTotalIdr);
  const rawProportional =
    (grant.credits * BigInt(Math.round(fraction * 1_000_000))) / 1_000_000n;
  const proportionalCredits =
    rawProportional > 0n ? rawProportional : grant.credits > 0n ? 1n : 0n;
  if (proportionalCredits <= 0n) return { reversed: false, creditsRefunded: 0n };

  // Claw back at most the still-unspent portion of the grant (FIFO allocation).
  const unspent = await computeUnspentGrantPortion(tx, input.workspaceId, grant);
  const clawback = proportionalCredits < unspent ? proportionalCredits : unspent;
  if (clawback <= 0n) {
    // Record the processed marker even with nothing recoverable (idempotency).
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
    return { reversed: true, creditsRefunded: 0n };
  }

  await tx.aiCreditLedger.create({
    data: {
      workspaceId: input.workspaceId,
      operationId: refundOpId,
      kind: "refund",
      credits: -clawback,
      refType: "order",
      refId: input.orderId,
      sourceOrderId: input.orderId,
    },
  });
  await applyPaygBalanceDelta(tx, {
    workspaceId: input.workspaceId,
    credits: -clawback,
  });
  return { reversed: true, creditsRefunded: clawback };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

// ---------------------------------------------------------------------------
// Worker helpers (threshold notifications + expiry/renewal job).
// ---------------------------------------------------------------------------

/** Active AI subscriptions with their current-period usage ratio, for the
 * 80%/100% threshold notifier. */
export async function listAiQuotaStatuses(): Promise<
  Array<{
    workspaceId: string;
    tier: AiTier;
    monthlyCredits: bigint;
    usedThisPeriod: bigint;
    quotaPeriodEnd: Date;
    usagePct: number; // 0..100+
  }>
> {
  const now = new Date();
  const subs = await db.workspaceAiSubscription.findMany({
    where: { status: "active", termEnd: { gt: now }, tier: { not: "none" } },
    select: {
      workspaceId: true,
      tier: true,
      monthlyCredits: true,
      quotaPeriodStart: true,
      quotaPeriodEnd: true,
    },
  });

  const out = [];
  for (const sub of subs) {
    if (sub.monthlyCredits <= 0n) continue;
    const used = await subscriptionUsed(db, sub.workspaceId, sub.quotaPeriodStart);
    const usagePct = Number((used * 100n) / sub.monthlyCredits);
    out.push({
      workspaceId: sub.workspaceId,
      tier: sub.tier,
      monthlyCredits: sub.monthlyCredits,
      usedThisPeriod: used,
      quotaPeriodEnd: sub.quotaPeriodEnd,
      usagePct,
    });
  }
  return out;
}

/**
 * Advance the monthly quota window for active subscriptions whose
 * quotaPeriodEnd passed (renews credits inside the commitment term), expire
 * subscriptions whose termEnd passed, and materialize PAYG grant expiry as
 * explicit `expire` ledger rows. All effects are idempotent.
 */
export async function runAiExpiryAndRenewal(now = new Date()): Promise<{
  quotaRenewed: number;
  subExpired: number;
  paygExpired: number;
}> {
  let quotaRenewed = 0;
  let subExpired = 0;
  let paygExpired = 0;

  // 1) Expire subscriptions whose paid term ended.
  const termDue = await db.workspaceAiSubscription.findMany({
    where: { status: "active", termEnd: { lte: now } },
    select: { id: true },
  });
  for (const sub of termDue) {
    const claim = await db.workspaceAiSubscription.updateMany({
      where: { id: sub.id, status: "active", termEnd: { lte: now } },
      data: { status: "expired" },
    });
    if (claim.count > 0) subExpired += 1;
  }

  // 2) Roll the monthly quota window for still-active subscriptions.
  const rollDue = await db.workspaceAiSubscription.findMany({
    where: { status: "active", termEnd: { gt: now }, quotaPeriodEnd: { lte: now } },
  });
  for (const sub of rollDue) {
    // Advance month-by-month until the window contains `now`, capped at termEnd.
    let start = sub.quotaPeriodStart;
    let end = sub.quotaPeriodEnd;
    let guard = 0;
    while (end <= now && guard < 24) {
      start = end;
      end = addMonths(start, 1);
      guard += 1;
    }
    const update: Record<string, unknown> = {
      quotaPeriodStart: start,
      quotaPeriodEnd: end,
    };
    // Apply a queued tier change at the boundary (no proration v1).
    if (sub.pendingTier && sub.pendingMonthlyCredits != null) {
      update.tier = sub.pendingTier;
      update.monthlyCredits = sub.pendingMonthlyCredits;
      update.pendingTier = null;
      update.pendingMonthlyCredits = null;
      update.pendingPlanCode = null;
    }
    const claim = await db.workspaceAiSubscription.updateMany({
      where: { id: sub.id, quotaPeriodEnd: { lte: now } },
      data: update,
    });
    if (claim.count > 0) quotaRenewed += 1;
  }

  // 3) Materialize expired PAYG grants (credits idle past expiresAt).
  const expiredGrants = await db.aiCreditLedger.findMany({
    where: { kind: "grant", expiresAt: { lte: now } },
    select: { id: true, workspaceId: true, credits: true, createdAt: true, expiresAt: true },
    take: 200,
  });
  for (const grant of expiredGrants) {
    const expireOpId = `expire:${grant.id}`;
    const existing = await db.aiCreditLedger.findUnique({
      where: { operationId: expireOpId },
      select: { id: true },
    });
    if (existing) continue;

    // Only claw back the still-unspent portion of this grant (FIFO allocation).
    const unspent = await computeUnspentGrantPortion(db, grant.workspaceId, grant);

    await db.aiCreditLedger.create({
      data: {
        workspaceId: grant.workspaceId,
        operationId: expireOpId,
        kind: "expire",
        credits: -unspent,
        refType: "grant",
        refId: grant.id,
      },
    });
    if (unspent > 0n) {
      await applyPaygBalanceDelta(db, {
        workspaceId: grant.workspaceId,
        credits: -unspent,
      });
    }
    paygExpired += 1;
  }

  return { quotaRenewed, subExpired, paygExpired };
}
