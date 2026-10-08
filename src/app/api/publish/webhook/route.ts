import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-errors";
import { recordPublishDelivery } from "@/lib/publish-delivery-store";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { allowDevStubs, isProductionRuntime, safeEqual } from "@/lib/security";

export const runtime = "nodejs";

type WebhookBody = {
  platform?: string;
  username?: string | null;
  accountId?: string | null;
  workspaceId?: string | null;
  title?: string | null;
  body?: string;
  hashtags?: string[];
  caption?: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
};

export async function POST(request: Request) {
  // Signature-verified but unauthenticated surface: failClosed so an Upstash
  // outage cannot be turned into a CPU-burning flood of fake notifications.
  const rate = await consumeRateLimit({
    key: getRequestRateKey(request, "api:publish:webhook"),
    limit: 120,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rate.ok) {
    return apiError("RATE_LIMITED", 429);
  }
  const expected = process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim();
  // Fail closed: token required unless ALLOW_SECURITY_STUBS=true in non-production.
  if (!expected) {
      if (!allowDevStubs()) {
      return apiError(
        "NOT_CONFIGURED",
        503,
        "SOCIAL_PUBLISH_WEBHOOK_TOKEN must be configured (set ALLOW_SECURITY_STUBS=true only for local insecure stubs)",
      );
    }
  } else {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
    if (!token || !safeEqual(token, expected)) {
      return apiError("INVALID_CREDENTIALS", 401, "Unauthorized webhook token");
    }
  }

  const payload = (await request.json().catch(() => null)) as WebhookBody | null;
  if (!payload || typeof payload.body !== "string" || !payload.body.trim()) {
    return apiError("INVALID_INPUT", 400, "Invalid payload. Expected JSON with non-empty body.");
  }

  // Database is the source of truth (serverless FS is read-only/ephemeral).
  try {
    const recorded = await recordPublishDelivery({
      workspaceId: payload.workspaceId ? String(payload.workspaceId).slice(0, 120) : null,
      platform: String(payload.platform || "unknown").slice(0, 40),
      username: payload.username ? String(payload.username).slice(0, 120) : null,
      accountId: payload.accountId ? String(payload.accountId).slice(0, 120) : null,
      title: payload.title ? String(payload.title).slice(0, 200) : null,
      body: payload.body.trim().slice(0, 10000),
      hashtags: Array.isArray(payload.hashtags)
        ? payload.hashtags.map(String).slice(0, 30)
        : [],
      caption: String(payload.caption || payload.body).trim().slice(0, 10000),
      scheduledFor: payload.scheduledFor ? String(payload.scheduledFor) : null,
      publishedAt: payload.publishedAt ? String(payload.publishedAt) : new Date().toISOString(),
      sourceIp: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      ok: true,
      message: "Publish webhook accepted delivery",
      deliveryId: recorded.id,
      receivedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Never acknowledge a delivery we failed to persist.
    console.error("[publish-webhook] failed to persist delivery", error);
    return apiError("INTERNAL_ERROR", 500, "Failed to persist delivery");
  }
}

export async function GET() {
  // The usage doc is a recon aid (endpoint shape + auth scheme). Hide it in
  // production — the bridge operator already has the contract in
  // docs/BRIDGE-CONTRACT.md. POST behaviour is unchanged.
  if (isProductionRuntime()) {
    return apiError("NOT_FOUND", 404);
  }
  const tokenConfigured = Boolean(process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim());
  return NextResponse.json({
    ok: true,
    endpoint: "/api/publish/webhook",
    authRequired: tokenConfigured || !allowDevStubs(),
    usage:
      "POST JSON { platform, username, accountId, title, body, hashtags, caption, scheduledFor, publishedAt } with Authorization: Bearer <SOCIAL_PUBLISH_WEBHOOK_TOKEN>",
  });
}