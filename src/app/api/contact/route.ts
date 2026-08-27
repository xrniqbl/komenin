import { NextResponse } from "next/server";
import { contactPayloadSchema, contactWebhookUrl, salesInbox } from "@/lib/contact";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { safeOutboundFetch, UnsafeUrlError } from "@/lib/url-safety";
import { writeAuditLog } from "@/server/audit";

export const runtime = "nodejs";

/**
 * Public marketing contact / demo form.
 *
 * Persistence: platform audit log (no workspace).
 * Delivery (best-effort, any configured):
 *  - CONTACT_WEBHOOK_URL POST JSON
 *  - SALES_INBOX_EMAIL / CONTACT_TO_EMAIL via optional mailto-style webhook only
 *    (no SMTP dependency — Brevo sendEmail can be wired later behind same env)
 */
export async function POST(request: Request) {
  const rate = await consumeRateLimit({
    key: getRequestRateKey(request, "api:contact"),
    limit: 8,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
        },
      },
    );
  }

  if (!(await isFeatureEnabled(FEATURE_FLAG_KEYS.contactForm))) {
    return NextResponse.json(
      { error: "Contact form is temporarily unavailable." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = contactPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message || "Invalid input";
    return NextResponse.json({ error: first }, { status: 400 });
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
