import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/encryption";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";
import { reportError } from "@/lib/error-reporting";
import {
  assertProductionSessionPayload,
  buildSessionPayloadFromCookieMap,
} from "@/lib/session-payload";
import { ingestCorsHeaders, verifySessionIngestToken } from "@/lib/session-ingest-token";
import { parseAnyCookieFormat, missingRequiredKeys } from "@/lib/connectors/session-parse";
import { requiredCookieKeys } from "@/lib/session-payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cookie-import bridge for the browser extension / bookmarklet.
 *
 * Called FROM instagram.com or threads.net (CORS-restricted to those origins),
 * authenticated by the wizard-minted pairing token rather than a session
 * cookie — SameSite=Lax blocks cross-site credentialed requests, so there is
 * no other way for the platform origin to reach us.
 *
 * POST { token, cookies | cookieText | raw, ua?, username? }
 *   → 200 { ok, ingestId, username, cookieCount }  (ready to claim)
 *   → 4xx with a human-readable reason (never echoing cookie values)
 *
 * The payload is AES-256-GCM encrypted at rest and expires in 15 minutes.
 */
const MAX_BODY_BYTES = 32_000;
const INGEST_TTL_MS = 15 * 60 * 1000;

const PLATFORMS = new Set(["instagram", "threads", "tiktok"]);

type IngestBody = {
  token?: unknown;
  cookies?: unknown;
  cookieText?: unknown;
  raw?: unknown;
  ua?: unknown;
  username?: unknown;
};

function corsJson(body: Record<string, unknown>, status: number, origin: string | null) {
  return NextResponse.json(body, {
    status,
    headers: ingestCorsHeaders(origin),
  });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: ingestCorsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");

  // Rate limit before any parsing: this endpoint is unauthenticated by
  // design (token-authenticated), so a flood guard must come first.
  const rate = await consumeRateLimit({
    key: getRequestRateKey(request, "session_ingest"),
    limit: 12,
    windowMs: 5 * 60 * 1000,
    failClosed: true,
  });
  if (!rate.ok) {
    return corsJson({ ok: false, message: "Terlalu banyak percobaan. Coba lagi nanti." }, 429, origin);
  }

  const rawBody = await request.text();
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return corsJson({ ok: false, message: "Payload terlalu besar atau kosong." }, 413, origin);
  }

  let body: IngestBody;
  try {
    body = JSON.parse(rawBody) as IngestBody;
  } catch {
    return corsJson({ ok: false, message: "Payload bukan JSON yang valid." }, 400, origin);
  }

  if (typeof body.token !== "string" || !body.token) {
    return corsJson(
      { ok: false, message: "Token pasangan tidak ada. Buka lagi halaman Connect di Komenin." },
      401,
      origin,
    );
  }

  const payload = verifySessionIngestToken(body.token);
  if (!payload) {
    return corsJson(
      { ok: false, message: "Token kedaluwarsa atau tidak valid. Muat ulang halaman Connect." },
      403,
      origin,
    );
  }
  if (!PLATFORMS.has(payload.platform)) {
    return corsJson({ ok: false, message: "Platform tidak didukung." }, 400, origin);
  }

  // Normalize the cookie input: the extension sends an array, manual callers
  // may send a raw header string, cURL dump, or JSON blob.
  const cookieMap: Record<string, string> = {};
  if (Array.isArray(body.cookies)) {
    for (const item of body.cookies) {
      if (!item || typeof item !== "object") continue;
      const c = item as { name?: unknown; value?: unknown };
      if (typeof c.name === "string" && typeof c.value === "string" && c.value.trim()) {
        cookieMap[c.name.trim()] = c.value.trim();
      }
    }
  } else {
    const text =
      typeof body.cookieText === "string"
        ? body.cookieText
        : typeof body.raw === "string"
          ? body.raw
          : "";
    const parsed = parseAnyCookieFormat(text);
    Object.assign(cookieMap, parsed.cookies);
  }

  const missing = missingRequiredKeys(cookieMap, requiredCookieKeys(payload.platform as never));
  if (missing.length > 0) {
    return corsJson(
      {
        ok: false,
        message: `Cookie belum lengkap untuk ${payload.platform}. Masih kurang: ${missing.join(", ")}.`,
        missing,
      },
      422,
      origin,
    );
  }

  const username =
    (typeof body.username === "string" && body.username.trim().replace(/^@/, "")) ||
    "";
  const ua = (typeof body.ua === "string" && body.ua.trim()) || undefined;

  let serialized: string;
  try {
    const built = buildSessionPayloadFromCookieMap({
      platform: payload.platform as never,
      values: cookieMap,
      userAgent: ua,
      username: username || undefined,
    });
    const validated = assertProductionSessionPayload(JSON.stringify(built), payload.platform as never, {
      username: username || undefined,
      userAgent: ua,
    });
    serialized = JSON.stringify(validated.payload);
  } catch (error) {
    return corsJson(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Cookie tidak lolos validasi. Salin ulang dari browser.",
      },
      422,
      origin,
    );
  }

  try {
    // Supersede any unconsumed slot for this user+platform so a retry does not
    // leave stale encrypted blobs accumulating.
    await db.sessionIngest.deleteMany({
      where: {
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        platform: payload.platform as never,
        consumedAt: null,
      },
    });

    const created = await db.sessionIngest.create({
      data: {
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        platform: payload.platform as never,
        payloadEnc: encryptSecret(serialized),
        expiresAt: new Date(Date.now() + INGEST_TTL_MS),
      },
      select: { id: true, expiresAt: true },
    });

    return corsJson(
      {
        ok: true,
        ingestId: created.id,
        expiresAt: created.expiresAt.toISOString(),
        cookieCount: Object.keys(cookieMap).length,
        username: username || null,
        message: `Sesi ${payload.platform} diterima (${Object.keys(cookieMap).length} cookie). Selesaikan di tab Komenin.`,
      },
      200,
      origin,
    );
  } catch (error) {
    await reportError(error, { scope: "session:ingest" });
    return corsJson(
      { ok: false, message: "Gagal menyimpan sesi di server. Coba lagi." },
      500,
      origin,
    );
  }
}
