/**
 * Daily account quota helpers.
 *
 * `actionsToday` is a monotonically increasing counter that was never reset,
 * permanently locking accounts once the daily quota was reached. These
 * helpers implement a lazy, date-boundary reset: if the last action happened
 * before the current UTC day, the counter starts over. The server runs on UTC
 * hosts, so the UTC day boundary is the single source of truth.
 */
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
