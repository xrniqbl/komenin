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
 * Single default language: Indonesian.
 */
export async function sendInviteEmail(input: {
  to: string;
  workspaceName: string;
  role: string;
  token: string;
  inviterName?: string | null;
}): Promise<{ delivered: boolean }> {
  const acceptUrl = `${appUrl()}/invite/${input.token}`;
  const inviter = input.inviterName?.trim() || "Tim Anda";

  const html = `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
    <h2 style="color:#0b0f14;">Anda diundang ke ${escapeHtml(input.workspaceName)}</h2>
    <p style="color:#374151;">${escapeHtml(inviter)} mengundang Anda untuk bergabung ke
    workspace <strong>${escapeHtml(input.workspaceName)}</strong> di Komenin sebagai
    <strong>${escapeHtml(input.role)}</strong>.</p>
    <p style="margin:32px 0;">
      <a href="${acceptUrl}"
         style="background:#0b0f14;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Terima undangan
      </a>
    </p>
    <p style="color:#6b7280;font-size:13px;">
      Tautan ini kedaluwarsa dalam 7 hari. Jika tombol tidak berfungsi, buka:
      <br><a href="${acceptUrl}" style="color:#2563eb;word-break:break-all;">${acceptUrl}</a>
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="color:#9ca3af;font-size:12px;">
      Jika Anda tidak merasa menerima undangan ini, abaikan email ini.
    </p>
  </div>`;

  const result = await sendEmail({
    to: input.to,
    subject: `Undangan: gabung ${input.workspaceName} di Komenin`,
    html,
    text:
      `${inviter} mengundang Anda untuk bergabung ke ${input.workspaceName} di Komenin sebagai ${input.role}.\n\n` +
      `Terima dalam 7 hari: ${acceptUrl}\n\n` +
      `Jika Anda tidak merasa menerima undangan ini, abaikan email ini.`,
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
      `Pengajuan kontak baru (${input.auditId})\n\n` +
      `Nama: ${input.name}\n` +
      `Email: ${input.email}\n` +
      `Waktu: ${input.submittedAt.toISOString()}\n\n` +
      input.message,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px">
  <h2 style="margin:0 0 12px;">Pengajuan kontak baru</h2>
  <p style="margin:0 0 12px;color:#374151;">
    <b>Dari:</b> ${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;<br/>
    <b>Waktu:</b> ${input.submittedAt.toISOString()}<br/>
    <b>Audit id:</b> ${escapeHtml(input.auditId)}
  </p>
  <pre style="white-space:pre-wrap;font-family:inherit;background:#f9fafb;padding:12px;border-radius:8px;">${escapeHtml(input.message)}</pre>
</div>`,
  };
}
