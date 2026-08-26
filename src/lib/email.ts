/**
 * Transactional Email
 *
 * Sends product emails (invitations, password resets, notifications) through
 * Resend's HTTP API when RESEND_API_KEY is configured. No new runtime
 * dependencies; degrades to no-op + structured log so callers never crash on
 * a missing provider. The invite token continues to surface in the UI as the
 * manual fallback when email is not wired.
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

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function fromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Aether <onboarding@resend.dev>"
  );
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Send an email. Returns delivery metadata; never throws.
 */
export async function sendEmail(message: EmailMessage): Promise<{
  delivered: boolean;
  provider: "resend" | "none";
  error?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY not configured; skipping send to ${message.to} ` +
        `("${message.subject}")`,
    );
    return { delivered: false, provider: "none", error: "not_configured" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[email] Resend rejected send to ${message.to}: ${response.status} ${detail.slice(0, 200)}`,
      );
      return {
        delivered: false,
        provider: "resend",
        error: `resend_${response.status}`,
      };
    }

    return { delivered: true, provider: "resend" };
  } catch (error) {
    console.warn(
      `[email] send to ${message.to} failed:`,
      error instanceof Error ? error.message : error,
    );
    return {
      delivered: false,
      provider: "resend",
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
    <strong>${escapeHtml(input.workspaceName)}</strong> workspace on Aether as
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
    subject: `Invite: join ${input.workspaceName} on Aether`,
    html,
    text:
      `${inviter} invited you to join ${input.workspaceName} on Aether as ${input.role}.\n\n` +
      `Accept within 7 days: ${acceptUrl}\n\n` +
      `If you weren't expecting this invite, ignore this email.`,
  });

  return { delivered: result.delivered };
}
