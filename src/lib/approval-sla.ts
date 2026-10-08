/** SLA helpers for the approvals queue.
 *
 *  Pending approvals show their waiting age ("3h 12m waiting") and get an
 *  overdue highlight once they pass the threshold. Overdue currently means
 *  waiting longer than `slaHours` (default 24h); a per-workspace setting
 *  will replace the constant once one exists.
 */

export const DEFAULT_APPROVAL_SLA_HOURS = 24;

export function approvalAgeMs(createdAt: Date | string, now: Date = new Date()): number {
  const created = createdAt instanceof Date ? createdAt.getTime() : Date.parse(createdAt);
  if (Number.isNaN(created)) return 0;
  return Math.max(0, now.getTime() - created);
}

export function isApprovalOverdue(
  createdAt: Date | string,
  slaHours: number = DEFAULT_APPROVAL_SLA_HOURS,
  now: Date = new Date(),
): boolean {
  return approvalAgeMs(createdAt, now) > slaHours * 60 * 60 * 1000;
}

export function formatApprovalAge(createdAt: Date | string, now: Date = new Date()): string {
  const totalMinutes = Math.floor(approvalAgeMs(createdAt, now) / 60000);
  if (totalMinutes < 1) return "just now";
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 48) {
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days}d ${restHours}h` : `${days}d`;
}
