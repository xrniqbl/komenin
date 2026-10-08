/**
 * Daily account quota helpers.
 *
 * `actionsToday` is a monotonically increasing counter that was never reset,
 * permanently locking accounts once the daily quota was reached. These
 * helpers implement a lazy, date-boundary reset: if the last action happened
 * before the current UTC day, the counter starts over. The server runs on UTC
 * hosts, so the UTC day boundary is the single source of truth.
 */
import type { PrismaClient } from "@prisma/client";

export type DailyQuotaAccount = {
  actionsToday: number;
  dailyQuota: number;
  lastActionAt?: Date | null;
};

export function effectiveActionsToday(
  account: DailyQuotaAccount,
  now: Date = new Date(),
): number {
  if (!account.lastActionAt) return account.actionsToday;
  if (account.lastActionAt.getTime() < startOfUtcDay(now).getTime()) return 0;
  return account.actionsToday;
}

export function isSameUtcDay(a: Date, b: Date): boolean {
  return startOfUtcDay(a).getTime() === startOfUtcDay(b).getTime();
}

export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Prisma `data` fragment to record one account action with a lazy daily
 * reset. Uses `{ increment: 1 }` when staying within the day so concurrent
 * actions for the same account accumulate correctly; on the day boundary the
 * counter restarts at 1 instead of stacking on yesterday's total.
 */
export function dailyActionIncrementData(
  account: DailyQuotaAccount,
  now: Date = new Date(),
): { actionsToday: number | { increment: number }; lastActionAt: Date } {
  const reset =
    !account.lastActionAt || !isSameUtcDay(account.lastActionAt, now);
  return {
    actionsToday: reset ? 1 : { increment: 1 },
    lastActionAt: now,
  };
}

/**
 * Atomically record one account action with a lazy UTC-day reset.
 *
 * Unlike `dailyActionIncrementData` (which decides reset-vs-increment from a
 * possibly stale in-memory row), this issues two conditional UPDATEs so
 * concurrent actions can neither lose increments nor stack on yesterday's
 * total at the UTC midnight boundary:
 * - reset path only matches rows whose lastActionAt is before today (or null)
 * - increment path only matches same-day rows
 * Whichever statement wins the race, the counter stays correct.
 */
export async function recordDailyAccountAction(
  tx: Pick<PrismaClient, "socialAccount">,
  accountId: string,
  now: Date = new Date(),
): Promise<void> {
  const dayStart = startOfUtcDay(now);
  const reset = await tx.socialAccount.updateMany({
    where: {
      id: accountId,
      OR: [{ lastActionAt: { lt: dayStart } }, { lastActionAt: null }],
    },
    data: { actionsToday: 1, lastActionAt: now },
  });
  if (reset.count === 0) {
    await tx.socialAccount.updateMany({
      where: { id: accountId, lastActionAt: { gte: dayStart } },
      data: { actionsToday: { increment: 1 }, lastActionAt: now },
    });
  }
}
