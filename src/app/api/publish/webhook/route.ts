import { NextResponse } from "next/server";
import { appendPublishDelivery } from "@/lib/publish-delivery-log";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { isProductionRuntime, safeEqual } from "@/lib/security";

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
  const rate = consumeRateLimit({
    key: getRequestRateKey(request, "api:publish:webhook"),
    limit: 120,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const expected = process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim();
  if (!expected) {
    if (isProductionRuntime()) {
      return NextResponse.json(
        { error: "SOCIAL_PUBLISH_WEBHOOK_TOKEN must be configured in production" },
        { status: 503 },
      );
    }
  } else {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
    if (!token || !safeEqual(token, expected)) {
      return NextResponse.json({ error: "Unauthorized webhook token" }, { status: 401 });
    }
  }

  const payload = (await request.json().catch(() => null)) as WebhookBody | null;
  if (!payload || typeof payload.body !== "string" || !payload.body.trim()) {
    return NextResponse.json(
      { error: "Invalid payload. Expected JSON with non-empty body." },
      { status: 400 },
    );
  }

  const delivery = await appendPublishDelivery({
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
    id: delivery.externalPostId,
    externalPostId: delivery.externalPostId,
    message: "Local publish webhook accepted delivery",
    deliveryId: delivery.id,
    receivedAt: delivery.receivedAt,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/publish/webhook",
    auth: Boolean(process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim()),
    usage:
      "POST JSON { platform, username, accountId, title, body, hashtags, caption, scheduledFor, publishedAt }",
  });
}