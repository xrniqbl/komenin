import { z } from "zod";

export const SUPPORT_CATEGORIES = [
  "bug",
  "billing",
  "account",
  "feature",
  "other",
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed",
] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_PRIORITIES = ["low", "normal", "high"] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export const supportTicketSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES),
  subject: z.string().trim().min(5, "Subject is too short").max(150),
  body: z
    .string()
    .trim()
    .min(20, "Please describe the problem in at least 20 characters")
    .max(5000),
});

export const supportReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(2, "Reply is too short")
    .max(5000),
});

/** Statuses a ticket may move to from each status (no self-transitions). */
const LEGAL_TRANSITIONS: Record<SupportStatus, SupportStatus[]> = {
  open: ["in_progress", "resolved", "closed"],
  in_progress: ["open", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
};

export function canTransition(from: SupportStatus, to: SupportStatus): boolean {
  return from !== to && LEGAL_TRANSITIONS[from].includes(to);
}

/** Reporters may only close their ticket or reopen it — everything else is CS. */
const REPORTER_ALLOWED: Array<{ from: SupportStatus; to: SupportStatus }> = [
  { from: "open", to: "closed" },
  { from: "in_progress", to: "closed" },
  { from: "resolved", to: "closed" },
  { from: "resolved", to: "open" },
  { from: "closed", to: "open" },
];

export function reporterCanTransition(
  from: SupportStatus,
  to: SupportStatus,
): boolean {
  return canTransition(from, to) &&
    REPORTER_ALLOWED.some((t) => t.from === from && t.to === to);
}

/** Auto priority at creation: operational issues get normal, wishes get low. */
export function derivePriority(category: SupportCategory): SupportPriority {
  return category === "bug" || category === "billing" ? "normal" : "low";
}

/** Suffix used in email subjects — full cuid stays in the app/URL. */
export function ticketShortId(id: string): string {
  return id.slice(-8);
}
