/**
 * Transactional Email (Brevo)
 *
 * Sends product emails (invitations, notifications) through Brevo's v3 HTTP
 * API when BREVO_API_KEY is configured. No new runtime dependencies; degrades
 * to no-op + structured log so callers never crash on a missing provider.
 * The invite token continues to surface in the UI as the manual fallback
 * when email is not wired.
 *
 * Failures are reported (console.warn) but never thrown — email is
 * best-effort delivery, the source of truth stays in the database.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

type BrevoAddress = { email: string; name?: string };

/**
 * Parse an EMAIL_FROM value like `Komenin <noreply@brand.id>` or a bare
 * `noreply@brand.id` into Brevo's sender object.
 */
function parseFromAddress(value: string): BrevoAddress | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(.*)<\s*([^<>@\s]+@[^<>\s]+)\s*>$/);
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, "");
    return name ? { email: match[2], name } : { email: match[2] };
  }
  if (/^[^@\s]+@[^@\s]+$/.test(trimmed)) {
    return { email: trimmed };
  }
  return null;
}

function senderAddress(): BrevoAddress | null {
  return parseFromAddress(process.env.EMAIL_FROM?.trim() || "");
}

/**
 * Defense-in-depth: Brevo is a JSON API (no raw SMTP headers), but strip
 * CR/LF from every address/name/subject fragment anyway so a multiline value
 * can never become a header injection if the transport ever changes.
 */
function stripCrlf(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function parseEmailAddress(value: string): BrevoAddress {
  const clean = stripCrlf(value);
  const match = clean.match(/^(.*)<\s*([^<>@\s]+@[^<>\s]+)\s*>$/);
  if (match) {
    const name = stripCrlf(match[1]).replace(/^["']|["']$/g, "");
    return name ? { email: match[2], name } : { email: match[2] };
  }
  return { email: clean };
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.BREVO_API_KEY?.trim() && senderAddress(),
  );
}

/**
 * Send an email. Returns delivery metadata; never throws.
 */
export async function sendEmail(message: EmailMessage): Promise<{
  delivered: boolean;
  provider: "brevo" | "none";
  error?: string;
}> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const sender = senderAddress();

  if (!apiKey || !sender) {
    console.warn(
      `[email] BREVO_API_KEY or EMAIL_FROM not configured; skipping send to ` +
        `${message.to} ("${message.subject}")`,
    );
    return { delivered: false, provider: "none", error: "not_configured" };
  }

  // Header-injection defense-in-depth (see stripCrlf): subject + envelope
  // values are flattened to single lines before hitting the wire.
  const subject = stripCrlf(message.subject);
  const to = stripCrlf(message.to);
  const replyTo = message.replyTo ? stripCrlf(message.replyTo) : undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [parseEmailAddress(to)],
        subject,
        htmlContent: message.html,
        ...(message.text ? { textContent: message.text } : {}),
        ...(replyTo ? { replyTo: parseEmailAddress(replyTo) } : {}),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[email] Brevo rejected send to ${to}: ${response.status} ${detail.slice(0, 200)}`,
      );
      return {
        delivered: false,
        provider: "brevo",
        error: `brevo_${response.status}`,
      };
    }

    return { delivered: true, provider: "brevo" };
  } catch (error) {
    console.warn(
      `[email] send to ${to} failed:`,
      error instanceof Error ? error.message : error,
    );
    return {
      delivered: false,
      provider: "brevo",
      error: "network_error",
    };
  }
}

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Send a workspace invitation email with a one-time accept link.
 */
export async function sendInviteEmail(input: {
  to: string;
  workspaceName: string;
  role: string;
  token: string;
  inviterName?: string | null;
}): Promise<{ delivered: boolean }> {
  const acceptUrl = `${appUrl()}/invite/${input.token}`;
  const inviter = input.inviterName?.trim() || "Your team";

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="color:#0b0f14;">You're invited to ${escapeHtml(input.workspaceName)}</h2>
    <p style="color:#374151;">${escapeHtml(inviter)} invited you to join the
    <strong>${escapeHtml(input.workspaceName)}</strong> workspace on Komenin as
    <strong>${escapeHtml(input.role)}</strong>.</p>
    <p style="margin:32px 0;">
      <a href="${acceptUrl}"
         style="background:#0b0f14;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Accept invitation
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px;">
      This link expires in 7 days. If the button doesn't work, open:
      <br><a href="${acceptUrl}" style="color:#2563eb;word-break:break-all;">${acceptUrl}</a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="color:#9ca3af;font-size:12px;">
      If you weren't expecting this invite, you can ignore this email.
    </p>
  </div>`;

  const result = await sendEmail({
    to: input.to,
    subject: `Invite: join ${input.workspaceName} on Komenin`,
    html,
    text:
      `${inviter} invited you to join ${input.workspaceName} on Komenin as ${input.role}.\n\n` +
      `Accept within 7 days: ${acceptUrl}\n\n` +
      `If you weren't expecting this invite, ignore this email.`,
  });

  return { delivered: result.delivered };
}

/**
 * Support inbox for contact form + support tickets.
 * Optional env override; defaults to the Komenin CS address.
 */
export function supportInbox(): string {
  return process.env.SUPPORT_INBOX_EMAIL?.trim() || "cs@komenin.id";
}

/** Build (not send) the CS notification for a public contact-form submission. */
export function buildContactNotification(input: {
  name: string;
  email: string;
  message: string;
  auditId: string;
  submittedAt: Date;
}): EmailMessage {
  const subjectName =
    input.name.length > 40 ? `${input.name.slice(0, 37)}...` : input.name;
  return {
    to: supportInbox(),
    replyTo: input.email,
    subject: `[Komenin Contact] ${subjectName}`,
    text:
      `New contact submission (${input.auditId})\n\n` +
      `Name: ${input.name}\n` +
      `Email: ${input.email}\n` +
      `At: ${input.submittedAt.toISOString()}\n\n` +
      input.message,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px">
  <h2 style="margin:0 0 12px;">New contact submission</h2>
  <p style="margin:0 0 12px;color:#374151;">
    <b>From:</b> ${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;<br/>
    <b>At:</b> ${input.submittedAt.toISOString()}<br/>
    <b>Audit id:</b> ${escapeHtml(input.auditId)}
  </p>
  <pre style="white-space:pre-wrap;font-family:inherit;background:#f9fafb;padding:12px;border-radius:8px;">${escapeHtml(input.message)}</pre>
</div>`,
  };
}
