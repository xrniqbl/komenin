export type NotificationEvent =
  | "account.degraded"
  | "account.reauth_required"
  | "account.proxy_rotated"
  | "approval.timeout"
  | "comment.failed"
  | "content.failed"
  | "usage.warning"
  | "ai.quota_warning"
  | "ai.quota_exhausted"
  | "competitor.new_post"
  | "approval.new"
  | "campaign.completed"
  | "lead.captured";

export const EVENT_LABELS: Record<NotificationEvent, string> = {
  "account.degraded": "Account degraded",
  "account.reauth_required": "Session re-auth required",
  "account.proxy_rotated": "Proxy auto-rotated",
  "approval.timeout": "Approval pending timeout",
  "comment.failed": "Comment send failed",
  "content.failed": "Content publish failed",
  "usage.warning": "Usage warning",
  "ai.quota_warning": "AI credit 80% used",
  "ai.quota_exhausted": "AI credit exhausted",
  "competitor.new_post": "Competitor new post",
  "approval.new": "New approval needed",
  "campaign.completed": "Campaign completed",
  "lead.captured": "Lead captured",
};

export const ALL_EVENTS: NotificationEvent[] = [
  "account.degraded",
  "account.reauth_required",
  "account.proxy_rotated",
  "approval.timeout",
  "comment.failed",
  "content.failed",
  "usage.warning",
  "ai.quota_warning",
  "ai.quota_exhausted",
  "competitor.new_post",
  "approval.new",
  "campaign.completed",
  "lead.captured",
];

export function eventColor(event: NotificationEvent): string {
  if (
    event === "account.degraded" ||
    event === "account.reauth_required" ||
    event === "comment.failed" ||
    event === "content.failed" ||
    event === "ai.quota_exhausted"
  ) {
    return "destructive";
  }
  if (
    event === "usage.warning" ||
    event === "ai.quota_warning" ||
    event === "account.proxy_rotated"
  )
    return "warning";
  if (event === "lead.captured") return "secondary";
  return "secondary";
}
