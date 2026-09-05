import { supportInbox, type EmailMessage } from "@/lib/email";
import {
  ticketShortId,
  type SupportCategory,
  type SupportStatus,
} from "@/lib/support";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ticketUrl(ticketId: string): string {
  const base = process.env.APP_URL?.trim().replace(/\/$/, "") || "";
  return `${base}/app/support/${ticketId}`;
}

function wrapLayout(title: string, bodyHtml: string, linkHtml?: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:560px">
  <h2 style="margin:0 0 12px;">${title}</h2>
  ${bodyHtml}
  ${linkHtml ? `<p style="margin:16px 0 0;"><a href="${linkHtml}" style="color:#2563eb;word-break:break-all;">${linkHtml}</a></p>` : ""}
</div>`;
}

export type NewTicketEmailInput = {
  ticketId: string;
  category: SupportCategory;
  subject: string;
  body: string;
  reporterName: string;
  reporterEmail: string;
  workspaceName?: string | null;
  submittedAt: Date;
};

/** CS notification for a newly created ticket. Reply-To goes to the reporter. */
export function buildNewTicketEmailToCs(
  input: NewTicketEmailInput,
): EmailMessage {
  const bodyHtml = `
  <p style="margin:0 0 12px;color:#374151;">
    <b>From:</b> ${escapeHtml(input.reporterName)} &lt;${escapeHtml(input.reporterEmail)}&gt;<br/>
    <b>Workspace:</b> ${escapeHtml(input.workspaceName || "—")}<br/>
    <b>Category:</b> ${escapeHtml(input.category)}<br/>
    <b>At:</b> ${input.submittedAt.toISOString()}
  </p>
  <pre style="white-space:pre-wrap;font-family:inherit;background:#f9fafb;padding:12px;border-radius:8px;">${escapeHtml(input.body)}</pre>`;
  return {
    to: supportInbox(),
    replyTo: input.reporterEmail,
    subject: `[Ticket ${ticketShortId(input.ticketId)}] ${input.category} — ${input.subject}`,
    text:
      `New support ticket ${ticketShortId(input.ticketId)}\n\n` +
      `From: ${input.reporterName} <${input.reporterEmail}>\n` +
      `Workspace: ${input.workspaceName || "-"}\n` +
      `Category: ${input.category}\n\n${input.body}`,
    html: wrapLayout(
      `New support ticket — ${escapeHtml(input.subject)}`,
      bodyHtml,
      ticketUrl(input.ticketId),
    ),
  };
}

export type ReplyEmailInput = {
  ticketId: string;
  subject: string;
  reporterEmail: string;
  replyBody: string;
};

/** Reporter notification when CS replies to their ticket. */
export function buildReplyEmailToReporter(input: ReplyEmailInput): EmailMessage {
  const bodyHtml = `
  <p style="margin:0 0 12px;color:#374151;">Komenin support replied to your ticket <b>${escapeHtml(input.subject)}</b>:</p>
  <pre style="white-space:pre-wrap;font-family:inherit;background:#f9fafb;padding:12px;border-radius:8px;">${escapeHtml(input.replyBody)}</pre>`;
  return {
    to: input.reporterEmail,
    subject: `[Ticket ${ticketShortId(input.ticketId)}] New reply from Komenin support`,
    text:
      `Komenin support replied to your ticket "${input.subject}":\n\n` +
      `${input.replyBody}\n\n${ticketUrl(input.ticketId)}`,
    html: wrapLayout("Your support ticket has a new reply", bodyHtml, ticketUrl(input.ticketId)),
  };
}

export type StatusEmailInput = {
  ticketId: string;
  subject: string;
  reporterEmail: string;
  status: SupportStatus;
};

/** Reporter notification when the ticket status changes. */
export function buildStatusEmailToReporter(input: StatusEmailInput): EmailMessage {
  const bodyHtml = `
  <p style="margin:0;color:#374151;">Your ticket <b>${escapeHtml(input.subject)}</b> is now
  <b>${escapeHtml(input.status)}</b>.</p>`;
  return {
    to: input.reporterEmail,
    subject: `[Ticket ${ticketShortId(input.ticketId)}] Status: ${input.status}`,
    text:
      `Your support ticket "${input.subject}" is now ${input.status}.\n` +
      `${ticketUrl(input.ticketId)}`,
    html: wrapLayout("Support ticket status update", bodyHtml, ticketUrl(input.ticketId)),
  };
}
