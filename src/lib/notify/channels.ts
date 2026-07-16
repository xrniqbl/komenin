export type NotificationEvent =
  | "account.degraded"
  | "approval.timeout"
  | "comment.failed"
  | "content.failed"
  | "usage.warning"
  | "competitor.new_post"
  | "approval.new"
  | "campaign.completed";

export const EVENT_LABELS: Record<NotificationEvent, string> = {
  "account.degraded": "Account degraded",
  "approval.timeout": "Approval pending timeout",
  "comment.failed": "Comment send failed",
  "content.failed": "Content publish failed",
  "usage.warning": "Usage warning",
  "competitor.new_post": "Competitor new post",
  "approval.new": "New approval needed",
  "campaign.completed": "Campaign completed",
};

export const ALL_EVENTS: NotificationEvent[] = [
  "account.degraded",
  "approval.timeout",
  "comment.failed",
  "content.failed",
  "usage.warning",
  "competitor.new_post",
  "approval.new",
  "campaign.completed",
];

export function eventColor(event: NotificationEvent): string {
  if (event === "account.degraded" || event === "comment.failed" || event === "content.failed") return "destructive";
  if (event === "usage.warning") return "warning";
  return "secondary";
}
