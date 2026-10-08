import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { reportError } from "@/lib/error-reporting";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Platform webhook receiver (Meta/TikTok) for incoming comments/mentions.
 *
 * GET  → Meta subscription handshake: echoes hub.challenge only when
 *        INSTAGRAM_WEBHOOK_VERIFY_TOKEN is configured and matches (fail-closed
 *        on both sides).
 * POST → X-Hub-Signature-256 (Meta) / Tiktok-Signature `t=<ts>,s=<hmac>`
 *        (TikTok), fail-closed when the platform app secret is not configured.
 *
 * Accepted events are stored raw in DeliveryLog (kind=mention_ingest) and as
 * Mention rows deduped on (workspace, platform, externalId). Workspace
 * resolution is strictly by SocialAccount.externalId — payloads that cannot be
 * resolved are logged and dropped rather than attributed to an arbitrary
 * workspace, and comments authored by the receiving account itself are dropped
 * to prevent self-reply loops.
 */

const PLATFORMS = new Set(["instagram", "threads", "tiktok"]);
/**
 * Per-route durable rate limit for the webhook receiver. Webhook endpoints
 * are unauthenticated by design (platform-signed), so a flood guard here
 * protects signature-verification CPU and the ingest pipeline.
 */
async function webhookRateLimit(request: Request, platform: string) {
  return consumeRateLimit({
    key: getRequestRateKey(request, `webhook:${platform}`),
    limit: 120,
    windowMs: 60_000,
    failClosed: true,
  });
}

function appSecretFor(platform: string): string | null {
  const env = getEnv();
  switch (platform) {
    case "instagram":
      return env.INSTAGRAM_APP_SECRET?.trim() || null;
    case "threads":
      return env.THREADS_APP_SECRET?.trim() || env.INSTAGRAM_APP_SECRET?.trim() || null;
    case "tiktok":
      return env.TIKTOK_CLIENT_SECRET?.trim() || null;
    default:
      return null;
  }
}

/** Constant-time HMAC-SHA256 signature check. Meta prefixes with `sha256=`. */
export function verifyWebhookSignature(input: {
  secret: string;
  body: string;
  signatureHeader: string | null;
}): boolean {
  if (!input.signatureHeader) return false;
  const raw = input.signatureHeader.trim().replace(/^sha256=/i, "");
  if (!raw) return false;
  const digest = createHmac("sha256", input.secret).update(input.body).digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(raw.toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * TikTok Events API signature check. TikTok signs `<timestamp>.<body>` with
 * the client secret and sends `Tiktok-Signature: t=<ts>,s=<hex-hmac>`.
 * The timestamp is bound into the signed payload so a captured signature
 * cannot be replayed against a different body.
 *
 * Freshness is enforced separately (see TIKTOK_SIGNATURE_MAX_AGE_MS): the HMAC
 * alone does not expire, so without a timestamp window a captured webhook
 * could be replayed indefinitely.
 */
export function verifyTikTokSignature(input: {
  secret: string;
  body: string;
  signatureHeader: string | null;
}): boolean {
  if (!input.signatureHeader) return false;
  const parts = new Map(
    input.signatureHeader
      .split(",")
      .map((kv) => kv.split("=", 2) as [string, string])
      .filter(([k, v]) => Boolean(k) && Boolean(v)),
  );
  const timestamp = parts.get("t");
  const signature = parts.get("s")?.toLowerCase();
  if (!timestamp || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (!isFreshTikTokTimestamp(timestamp)) return false;
  const digest = createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.body}`)
    .digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** TikTok webhook replay window: signatures older than 5 minutes are rejected. */
export const TIKTOK_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

export function isFreshTikTokTimestamp(
  timestamp: string,
  nowMs: number = Date.now(),
): boolean {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  const ageMs = nowMs - seconds * 1000;
  // Reject future-dated timestamps beyond the same window (clock-skew tolerance).
  return ageMs >= -TIKTOK_SIGNATURE_MAX_AGE_MS && ageMs <= TIKTOK_SIGNATURE_MAX_AGE_MS;
}

type IngestInput = {
  platform: string;
  externalId: string;
  parentExternalId: string;
  parentContent: string;
  authorHandle: string;
  content: string;
  url?: string | null;
  /** SocialAccount.externalId of the receiving account, when known. */
  accountExternalId?: string | null;
  raw?: unknown;
};

/** Normalize a Meta graph changelist entry into an ingest candidate (or null). */
export function parseMetaChanges(entry: {
  id?: string;
  time?: number;
  changes?: Array<{ field?: string; value?: Record<string, unknown> }>;
}): IngestInput[] {
  const candidates: IngestInput[] = [];
  for (const change of entry.changes || []) {
    if (change.field !== "comments") continue;
    const value = (change.value || {}) as Record<string, unknown>;
    const text = typeof value.text === "string" ? value.text : "";
    const externalId = String(value.id || "");
    const media = (value.media as { id?: unknown } | null | undefined) || null;
    const mediaId = String(media?.id || value.media_id || "");
    if (!externalId || (!text && !mediaId)) continue;
    const from = (value.from as { username?: string; id?: string }) || {};
    candidates.push({
      platform: "instagram",
      externalId,
      parentExternalId: mediaId || externalId,
      parentContent: "",
      authorHandle: from.username || from.id || "unknown",
      content: text,
      url: null,
      accountExternalId: entry.id || null,
      raw: { entry, kind: "meta_change" },
    });
  }
  return candidates;
}

/** Compatibility helper for callers needing only the first comment. */
export function parseMetaChange(entry: Parameters<typeof parseMetaChanges>[0]): IngestInput | null {
  return parseMetaChanges(entry)[0] ?? null;
}

/** Normalize a Threads webhook entry into an ingest candidate (or null). */
export function parseThreadsValue(
  entryId: string,
  value: Record<string, unknown>,
): IngestInput | null {
  const externalId = String(value.id || "");
  if (!externalId) return null;
  const text = typeof value.text === "string" ? value.text : "";
  const author = (value.username as string) || (value.from as string) || "unknown";
  // A reply carries the parent id; a top-level mention falls back to itself.
  const parent = String(value.replied_to || value.in_reply_to || externalId);
  return {
    platform: "threads",
    externalId,
    parentExternalId: parent,
    parentContent: "",
    authorHandle: author,
    content: text,
    url: null,
    accountExternalId: entryId || null,
    raw: { entry: value, kind: "threads_event" },
  };
}

/** Normalize a TikTok webhook event into an ingest candidate (or null). */
export function parseTikTokValue(value: Record<string, unknown>): IngestInput | null {
  const event = String(value.event_type || value.event || "");
  if (!/comment/i.test(event)) return null;
  const comment = (value.data as Record<string, unknown> | undefined) || value;
  const externalId = String(comment.comment_id || comment.id || "");
  if (!externalId) return null;
  return {
    platform: "tiktok",
    externalId,
    parentExternalId: String(comment.video_id || comment.post_id || externalId),
    parentContent: "",
    authorHandle:
      (comment.author_username as string) ||
      (comment.author_handle as string) ||
      String(comment.author_open_id || "unknown"),
    content: (comment.text as string) || (comment.content as string) || "",
    url: null,
    accountExternalId: (value.creator_open_id as string) || null,
    raw: { value, kind: "tiktok_event" },
  };
}

/**
 * Resolve the owning workspace (and optional SocialAccount) for an ingest
 * candidate. Resolution is strictly by SocialAccount.externalId — there is no
 * credential fallback, because attributing an unmatched payload to whichever
 * workspace happens to hold an active credential would leak mentions across
 * tenants and trigger auto-replies from the wrong account.
 */
export async function resolveMentionTarget(input: {
  platform: string;
  accountExternalId?: string | null;
}): Promise<{ workspaceId: string; socialAccountId: string | null } | null> {
  if (!input.accountExternalId) return null;
  const account = await db.socialAccount.findFirst({
    where: {
      platform: input.platform as never,
      externalId: input.accountExternalId,
      deletedAt: null,
    },
    select: { id: true, workspaceId: true },
  });
  if (!account) return null;
  return { workspaceId: account.workspaceId, socialAccountId: account.id };
}

/** Insert the mention (deduped by unique key) and log the delivery. */
export async function ingestMention(input: IngestInput): Promise<boolean> {
  const target = await resolveMentionTarget({
    platform: input.platform,
    accountExternalId: input.accountExternalId,
  });
  if (!target) {
    await db.deliveryLog.create({
      data: {
        kind: "mention_ingest",
        connector: input.platform,
        mode: "live",
        ok: false,
        externalId: input.externalId,
        message: `Mention dropped: no workspace resolved for account ${input.accountExternalId || "unknown"}`,
        payload: (input.raw ?? {}) as never,
      },
    }).catch(() => undefined);
    return false;
  }

  // Self-reply loop guard: platforms deliver every comment on our media,
  // including the ones our own auto-replies post. Without this check a reply
  // becomes a new mention which gets replied to again, burning the daily
  // reply budget in a feedback loop.
  if (target.socialAccountId) {
    const account = await db.socialAccount.findFirst({
      where: { id: target.socialAccountId },
      select: { username: true },
    });
    if (
      account?.username &&
      input.authorHandle &&
      account.username.toLowerCase() === input.authorHandle.toLowerCase()
    ) {
      await db.deliveryLog.create({
        data: {
          workspaceId: target.workspaceId,
          socialAccountId: target.socialAccountId,
          kind: "mention_ingest",
          connector: input.platform,
          mode: "live",
          ok: true,
          externalId: input.externalId,
          message: "Mention dropped: authored by the receiving account",
          payload: (input.raw ?? {}) as never,
        },
      }).catch(() => undefined);
      return false;
    }
  }

  await db.mention.upsert({
    where: {
      workspaceId_platform_externalId: {
        workspaceId: target.workspaceId,
        platform: input.platform as never,
        externalId: input.externalId,
      },
    },
    create: {
      workspaceId: target.workspaceId,
      platform: input.platform as never,
      socialAccountId: target.socialAccountId,
      externalId: input.externalId,
      parentExternalId: input.parentExternalId,
      parentContent: input.parentContent,
      authorHandle: input.authorHandle,
      content: input.content,
      url: input.url || null,
      status: "new",
      rawPayload: (input.raw ?? {}) as never,
    },
    update: {
      content: input.content,
      rawPayload: (input.raw ?? {}) as never,
    },
  });

  await db.deliveryLog.create({
    data: {
      workspaceId: target.workspaceId,
      socialAccountId: target.socialAccountId,
      kind: "mention_ingest",
      connector: input.platform,
      mode: "live",
      ok: true,
      externalId: input.externalId,
      message: "Mention stored",
      payload: (input.raw ?? {}) as never,
    },
  }).catch(() => undefined);
  return true;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  if (!PLATFORMS.has(platform)) {
    return apiError("NOT_FOUND", 404, "Unknown platform");
  }
  const rate = await webhookRateLimit(request, platform);
  if (!rate.ok) {
    return apiError("RATE_LIMITED", 429);
  }
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const expectedToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim() || null;

  if (mode === "subscribe" && challenge) {
    // Fail-closed on both sides: without a configured verify token anyone who
    // knows the endpoint URL could complete Meta's subscription handshake.
    if (!expectedToken) {
      return apiError("NOT_CONFIGURED", 503, "Webhook verify token not configured");
    }
    // Constant-time comparison: never leak token prefix info via timing.
    const provided = Buffer.from(verifyToken ?? "");
    const expected = Buffer.from(expectedToken);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return apiError("TOKEN_MISMATCH", 403);
    }
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return NextResponse.json({ ok: true, platform });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  if (!PLATFORMS.has(platform)) {
    return apiError("NOT_FOUND", 404, "Unknown platform");
  }
  const rate = await webhookRateLimit(request, platform);
  if (!rate.ok) {
    return apiError("RATE_LIMITED", 429);
  }

  const secret = appSecretFor(platform);
  // Fail-closed: without the platform app secret we cannot verify authenticity,
  // so the payload is rejected rather than trusted.
  if (!secret) {
    return apiError(
      "NOT_CONFIGURED",
      503,
      `Webhook secret not configured for ${platform} — set the platform app secret to enable ingestion.`,
    );
  }

  const rawBody = await request.text();
  const signatureValid =
    platform === "tiktok"
      ? verifyTikTokSignature({
          secret,
          body: rawBody,
          signatureHeader: request.headers.get("tiktok-signature"),
        })
      : verifyWebhookSignature({
          secret,
          body: rawBody,
          signatureHeader: request.headers.get("x-hub-signature-256"),
        });
  if (!signatureValid) {
    await db.deliveryLog
      .create({
        data: {
          kind: "mention_ingest",
          connector: platform,
          mode: "live",
          ok: false,
          message: "Webhook signature verification failed",
          payload: {
            headers: {
              hasSignature: Boolean(
                platform === "tiktok"
                  ? request.headers.get("tiktok-signature")
                  : request.headers.get("x-hub-signature-256"),
              ),
            },
          } as never,
        },
      })
      .catch(() => undefined);
    return apiError("INVALID_SIGNATURE", 401);
  }

  let body: {
    object?: string;
    entry?: Array<Record<string, unknown>>;
    event?: string;
    data?: Record<string, unknown> | Array<Record<string, unknown>>;
    value?: Record<string, unknown>;
  };
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return apiError("INVALID_JSON", 400, "Invalid JSON payload");
  }

  const candidates: IngestInput[] = [];
  if (Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      if (platform === "threads") {
        const changes = ((entry.changes as Array<Record<string, unknown>>) || []).map(
          (change) => (change || {}) as Record<string, unknown>,
        );
        for (const change of changes) {
          const value = (change.value || {}) as Record<string, unknown>;
          const parsed = parseThreadsValue(String(entry.id || ""), value);
          if (parsed) candidates.push(parsed);
        }
      } else {
        for (const parsed of parseMetaChanges(entry as never)) {
          if (platform === "tiktok") parsed.platform = "tiktok";
          candidates.push(parsed);
        }
      }
    }
  } else if (body.value && platform === "threads") {
    const parsed = parseThreadsValue(String(body.value.id || ""), body.value);
    if (parsed) candidates.push(parsed);
  } else if (platform === "tiktok") {
    const list = Array.isArray(body.data) ? body.data : [body.data || body];
    for (const item of list) {
      if (!item) continue;
      const parsed = parseTikTokValue(item);
      if (parsed) candidates.push(parsed);
    }
  }

  let stored = 0;
  let failed = 0;
  for (const candidate of candidates) {
    try {
      if (await ingestMention(candidate)) stored += 1;
    } catch (error) {
      // One bad entry must not fail the batch — but failures are counted and
      // reported so a totally-broken ingest does not silently drop mentions.
      failed += 1;
      await reportError(error, {
        scope: "webhook:mention_ingest",
        extra: { platform, externalId: candidate.externalId ?? null },
      });
    }
  }

  // Any failed insert needs a retry of the whole delivery. Already stored
  // mentions are upserted on replay, so partial success is safe to redeliver.
  if (failed > 0) {
    return NextResponse.json(
      { ok: false, received: candidates.length, stored, failed },
      { status: 500 },
    );
  }

  // 200 (not 202) for empty batches: Meta treats non-2xx as delivery failure
  // and eventually disables the subscription; heartbeats must succeed.
  return NextResponse.json({ ok: true, received: candidates.length, stored, failed });
}
