/** Shared staleness + schedule helpers for Listener health UI. */

export const LISTENER_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export type ListenerHealthState = "never" | "stale" | "fresh";

export function listenerHealthState(input: {
  lastPolledAt: Date | string | null | undefined;
  latestPostAt: Date | string | null | undefined;
  now?: number;
}): { state: ListenerHealthState; reference: Date | null } {
  const now = input.now ?? Date.now();
  const lastPoll = input.lastPolledAt ? new Date(input.lastPolledAt) : null;
  const latestPost = input.latestPostAt ? new Date(input.latestPostAt) : null;
  if (!lastPoll) return { state: "never", reference: null };
  const reference = latestPost && latestPost > lastPoll ? latestPost : lastPoll;
  if (now - reference.getTime() > LISTENER_STALE_AFTER_MS) {
    return { state: "stale", reference };
  }
  return { state: "fresh", reference };
}

/** Next scheduled auto-poll, or null when manual-only / paused / unscheduled. */
export function nextPollAt(input: {
  pollIntervalMinutes: number | null | undefined;
  lastPolledAt: Date | string | null | undefined;
  isActive: boolean;
}): Date | null {
  if (!input.isActive) return null;
  const interval = input.pollIntervalMinutes;
  if (!interval || interval <= 0) return null;
  const base = input.lastPolledAt ? new Date(input.lastPolledAt).getTime() : Date.now();
  return new Date(base + interval * 60 * 1000);
}

export function formatPollDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}
