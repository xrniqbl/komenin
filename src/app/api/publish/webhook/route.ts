import { NextResponse } from "next/server";
import { appendPublishDelivery } from "@/lib/publish-delivery-log";

export const runtime = "nodejs";

type WebhookBody = {
  platform?: string;
  username?: string | null;
  accountId?: string | null;
  title?: string | null;
  body?: string;
  hashtags?: string[];
  caption?: string;
  scheduledFor?: string | null;
  publishedAt?: string | null;
};

export async function POST(request: Request) {
  const expected = process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim();
  if (expected) {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
    if (token !== expected) {
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
    platform: String(payload.platform || "unknown"),
    username: payload.username ? String(payload.username) : null,
    accountId: payload.accountId ? String(payload.accountId) : null,
    title: payload.title ? String(payload.title) : null,
    body: payload.body.trim(),
    hashtags: Array.isArray(payload.hashtags) ? payload.hashtags.map(String) : [],
    caption: String(payload.caption || payload.body).trim(),
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