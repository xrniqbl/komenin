/**
 * Komenin AI billing — metering, quota resolution, and the credit ledger.
 *
 * Design (spec: docs/superpowers/specs/2026-08-27-ai-agent-monetization.md):
 * - 1 credit = 1 token (input + output)
 * - Sources in priority order: BYOK (own key, free) → subscription quota →
 *   PAYG balance → fail-closed
 * - AiCreditLedger is append-only; balance = sum of credits over non-expired
 *   rows. Subscription usage debits a period-scoped quota computed from the
 *   ledger, PAYG usage debits the PAYG balance.
 */

import { db } from "@/lib/db";
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

/** Sum of ledger credits that are still valid (PAYG grants not expired). */
async function paygBalance(workspaceId: string): Promise<bigint> {
  const rows = await db.aiCreditLedger.aggregate({
    where: {
      workspaceId,
      kind: { in: ["grant", "payg_use", "refund", "expire"] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    _sum: { credits: true },
  });
  return rows._sum.credits ?? 0n;
}

/** Credits consumed from the subscription quota within the current period. */
async function subscriptionUsed(
  workspaceId: string,
  periodStart: Date,
): Promise<bigint> {
  const rows = await db.aiCreditLedger.aggregate({
    where: {
      workspaceId,
      kind: "subscription_use",
      createdAt: { gte: periodStart },
    },
    _sum: { credits: true },
  });
  // ledger stores negative values for usage
  return -(rows._sum.credits ?? 0n);
}

/**
 * Decide which source funds the next AI call for a workspace.
 * When `preferOwnKey` is true and the workspace has enabled providers, the
 * caller should use those providers and no credits are consumed.
 */
export async function resolveAiBilling(input: {
  workspaceId: string;
  /** Caller already knows a usable workspace provider exists (BYOK). */
  hasOwnProvider?: boolean;
  preferOwnKey?: boolean;
}): Promise<ResolveAiBillingResult> {
  const subscription = await db.workspaceAiSubscription.findUnique({
    where: { workspaceId: input.workspaceId },
  });

  const now = new Date();
  const activeSub =
    subscription &&
    subscription.status === "active" &&
    subscription.currentPeriodStart <= now &&
    subscription.currentPeriodEnd > now
      ? subscription
      : null;
  const tier = activeSub?.tier ?? "none";

  if (input.preferOwnKey && input.hasOwnProvider) {
    return { ok: true, source: "own_key", remaining: null, tier };
  }

  if (activeSub && activeSub.tier !== "none") {
    const quota = activeSub.monthlyCredits;
    const used = await subscriptionUsed(input.workspaceId, activeSub.currentPeriodStart);
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

  const balance = await paygBalance(input.workspaceId);
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
 * ledger is debited atomically and the event references the ledger row.
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
}): Promise<{ creditsUsed: bigint }> {
  const credits = BigInt(Math.max(0, input.inputTokens) + Math.max(0, input.outputTokens));

  await db.$transaction(async (tx) => {
    if (input.source === "own_key") {
      await tx.aiUsageEvent.create({
        data: {
          workspaceId: input.workspaceId,
          providerId: input.providerId ?? null,
          model: input.model,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          creditsUsed: 0n,
          billedTo: "own_key",
          latencyMs: input.latencyMs ?? null,
          refType: input.refType ?? null,
          refId: input.refId ?? null,
        },
      });
      return;
    }

    // Debit the ledger inside the transaction; balanceAfter is informational.
    const kind = input.source === "subscription" ? "subscription_use" : "payg_use";
    const last = await tx.aiCreditLedger.findFirst({
      where: { workspaceId: input.workspaceId, kind },
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    // For subscription rows balanceAfter tracks quota remaining; for payg it
    // tracks the payg balance. Both computed from the authoritative aggregate
    // below would be racy in tests — we compute from what we know here.
    const balanceAfter = (last?.balanceAfter ?? 0n) - credits;

    await tx.aiCreditLedger.create({
      data: {
        workspaceId: input.workspaceId,
        kind,
        credits: -credits,
        balanceAfter,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      },
    });

    await tx.aiUsageEvent.create({
      data: {
        workspaceId: input.workspaceId,
        providerId: input.providerId ?? `komenin:${input.model}`,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        creditsUsed: credits,
        billedTo: input.source,
        latencyMs: input.latencyMs ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      },
    });
  });

  return { creditsUsed: input.source === "own_key" ? 0n : credits };
}

/** Grant PAYG credits (purchase) — appended as a grant ledger row. */
export async function grantAiCredits(input: {
  workspaceId: string;
  credits: bigint;
  refType?: string;
  refId?: string;
  expiresAt?: Date | null;
}): Promise<void> {
  const last = await db.aiCreditLedger.findFirst({
    where: { workspaceId: input.workspaceId, kind: { in: ["grant", "payg_use", "refund", "expire"] } },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });
  await db.aiCreditLedger.create({
    data: {
      workspaceId: input.workspaceId,
      kind: "grant",
      credits: input.credits,
      balanceAfter: (last?.balanceAfter ?? 0n) + input.credits,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  });
}

/** Snapshot for UI: quota, usage, payg balance, tier. */
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
    subscription && subscription.status === "active" && subscription.currentPeriodEnd > now
      ? subscription
      : null;

  const [used, payg] = await Promise.all([
    activeSub
      ? subscriptionUsed(workspaceId, activeSub.currentPeriodStart)
      : Promise.resolve(0n),
    paygBalance(workspaceId),
  ]);

  return {
    tier: activeSub?.tier ?? "none",
    monthlyCredits: activeSub?.monthlyCredits ?? 0n,
    usedThisPeriod: used,
    paygBalance: payg,
    periodEnd: activeSub?.currentPeriodEnd ?? null,
  };
}
