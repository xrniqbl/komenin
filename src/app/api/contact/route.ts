import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/csrf";
import { apiError } from "@/lib/api-errors";
import { contactPayloadSchema, contactWebhookUrl, salesInbox } from "@/lib/contact";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { buildContactNotification, sendEmail } from "@/lib/email";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { safeOutboundFetch, UnsafeUrlError } from "@/lib/url-safety";
import { writeAuditLog } from "@/server/audit";

export const runtime = "nodejs";

/**
 * Public marketing contact / demo form.
 *
 * Persistence: platform audit log (no workspace).
 * Delivery (best-effort, any configured):
 *  - email to SUPPORT_INBOX_EMAIL (default cs@komenin.id) via Brevo
 *  - CONTACT_WEBHOOK_URL POST JSON
 */
export async function POST(request: Request) {
  // Public form, but state-changing (audit log + inbox email + webhook).
  // Same-origin guard stops third-party sites from submitting as the visitor;
  // server-to-server posts without Origin/Sec-Fetch-Site still pass.
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const rate = await consumeRateLimit({
    key: getRequestRateKey(request, "api:contact"),
    limit: 8,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return apiError("RATE_LIMITED", 429, undefined, {
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
      },
    });
  }

  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.contactForm))) {
    return apiError("NOT_CONFIGURED", 503, "Contact form is temporarily unavailable.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", 400);
  }

  const parsed = contactPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message || "Invalid input";
    return apiError("INVALID_INPUT", 400, first);
  }

  // Honeypot filled → pretend success (bots).
  if (parsed.data.company) {
    return NextResponse.json({ ok: true, id: "ignored" });
  }

  const { name, email, message } = parsed.data;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;

  const audit = await writeAuditLog({
    action: "contact.submitted",
    resourceType: "contact_lead",
    ip,
    metadata: {
      name,
      email,
      messagePreview: message.slice(0, 280),
      messageLength: message.length,
      salesInbox: salesInbox(),
      deliveredVia: [] as string[],
    },
  });

  // Contact persistence is the audit row itself — unlike fire-and-forget
  // audit trails elsewhere, a null here means the submission was NOT stored.
  if (!audit) {
    return apiError("SERVICE_UNAVAILABLE", 503);
  }

  const deliveredVia: string[] = ["audit_log"];
  const webhook = contactWebhookUrl();
  if (webhook) {
    try {
      const res = await safeOutboundFetch(webhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Komenin-Contact/1.0",
          "x-komenin-event": "contact.submitted",
        },
        body: JSON.stringify({
          event: "contact.submitted",
          id: audit.id,
          name,
          email,
          message,
          salesInbox: salesInbox(),
          submittedAt: new Date().toISOString(),
        }),
      });
      if (res.ok) deliveredVia.push("webhook");
    } catch (error) {
      if (!(error instanceof UnsafeUrlError)) {
        // Non-fatal — lead still stored in audit.
        console.error("[contact] webhook delivery failed", error);
      }
    }
  }

  // Email the support inbox (best-effort — submission is safe in the audit log).
  try {
    const result = await sendEmail(
      buildContactNotification({
        name,
        email,
        message,
        auditId: audit.id,
        submittedAt: audit.createdAt,
      }),
    );
    if (result.delivered) deliveredVia.push("email");
  } catch (error) {
    // sendEmail never throws; keep the safety net anyway.
    console.error("[contact] email delivery failed", error);
  }

  // Update metadata with delivery path when possible (best-effort).
  try {
    const { db } = await import("@/lib/db");
    await db.auditLog.update({
      where: { id: audit.id },
      data: {
        metadata: {
          name,
          email,
          messagePreview: message.slice(0, 280),
          messageLength: message.length,
          salesInbox: salesInbox(),
          deliveredVia,
        },
      },
    });
  } catch {
    // ignore
  }

  return NextResponse.json({
    ok: true,
    id: audit.id,
    deliveredVia,
  });
}
