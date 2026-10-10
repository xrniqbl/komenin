/**
 * Unofficial Instagram / Threads connector driven by imported session cookies.
 *
 * Why this exists alongside the official adapter:
 *   Official OAuth needs a Meta App Review before any non-tester user can
 *   complete a token exchange. Imported cookies bypass that entirely — the
 *   call goes straight to Instagram's private mobile API with the user's own
 *   session, so any user can connect without Meta approval.
 *
 * Why it is deliberately gated:
 *   This is an undocumented, ToS-violating surface. Instagram rate-limits and
 *   bans aggressively, cookie sessions expire, and the API shape drifts. The
 *   router only reaches this adapter when a stored session exists AND the
 *   workspace policy permits it, and every failure here fails closed so the
 *   policy can fall back to a webhook instead of retrying silently.
 */

import type { Platform } from "@prisma/client";
import { createHmac } from "node:crypto";
import { decryptSecret } from "@/lib/encryption";
import { safeOutboundFetch, UnsafeUrlError } from "@/lib/url-safety";
import {
  assertProductionSessionPayload,
  type NormalizedSessionPayload,
} from "@/lib/session-payload";
import type {
  ConnectorActionInput,
  ConnectorResult,
  DiscoveredPost,
} from "@/lib/connectors/types";

/** Private mobile API host. Both Instagram and Threads live here. */
const PRIVATE_API = "https://i.instagram.com/api/v1";

/** App ids used by the mobile clients. Threads runs inside the IG app shell. */
const APP_ID = {
  instagram: "567067343352427",
  threads: "238260118697367",
} as const;

/**
 * User agents. Threads must identify as "Barcelona" — the Instagram app
 * silently refuses Threads publish endpoints from the plain IG agent.
 */
const USER_AGENT = {
  instagram:
    "Instagram 155.0.0.37.107 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 239490569)",
  threads:
    "Barcelona 289.0.0.77.109 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100; en_US; 239490569)",
} as const;

const DEFAULT_TIMEOUT_MS = 20_000;

export type SessionConnectorDeps = {
  /** Injected in tests so no real network call happens. */
  fetchImpl?: typeof fetch;
  /** Optional HMAC key for signed_body. Absent → unsigned (works on most routes). */
  signatureKey?: string | null;
  timeoutMs?: number;
};

type ResolvedSession = {
  payload: NormalizedSessionPayload;
  username: string | null;
};

/* ------------------------------------------------------------------ *
 * Session resolution
 * ------------------------------------------------------------------ */

/**
 * Decrypt and validate a stored session blob. Never logs cookie values.
 */
export function resolveSessionBlob(
  encryptedBlob: string,
  platform: Platform,
  username?: string | null,
): { ok: true; session: ResolvedSession } | { ok: false; reason: string } {
  let raw: string;
  try {
    raw = decryptSecret(encryptedBlob);
  } catch {
    return { ok: false, reason: "decrypt_failed" };
  }

  // Check for sessionid BEFORE full validation: `assertProductionSessionPayload`
  // rejects a missing sessionid as part of its required-key list, which would
  // collapse two very different operator problems ("we stored the wrong blob"
  // vs "the blob was never a real session") into one opaque payload_invalid.
  try {
    const parsed = JSON.parse(raw) as { cookies?: Array<{ name?: unknown }> };
    const names = (Array.isArray(parsed.cookies) ? parsed.cookies : [])
      .map((c) => String(c?.name || "").toLowerCase());
    if (!names.includes("sessionid")) {
      return { ok: false, reason: "cookie_missing_sessionid" };
    }
  } catch {
    return { ok: false, reason: "payload_invalid" };
  }

  try {
    const validated = assertProductionSessionPayload(raw, platform, {
      username: username || undefined,
    });
    return {
      ok: true,
      session: {
        payload: validated.payload,
        username: validated.payload.username || username || null,
      },
    };
  } catch {
    return { ok: false, reason: "payload_invalid" };
  }
}

/* ------------------------------------------------------------------ *
 * Request plumbing
 * ------------------------------------------------------------------ */

function cookieHeader(session: ResolvedSession): string {
  return session.payload.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

function deviceIds(session: ResolvedSession): {
  deviceId: string;
  phoneId: string;
  guid: string;
} {
  const map = new Map(session.payload.cookies.map((c) => [c.name, c.value]));
  // Instagram derives these from the session when absent; supplying them
  // keeps the request shape identical to a real device.
  const deviceId = `android-${(map.get("mid") || "unknown").slice(0, 16)}`;
  const dsUserId = map.get("ds_user_id") || "0";
  return { deviceId, phoneId: dsUserId, guid: dsUserId };
}

/**
 * Body signing. Instagram's mobile API expects
 * `signed_body=<sig>.<urlencoded json>&ig_sig_key_version=4`.
 *
 * The signature key is not shipped here — it is not ours to redistribute and
 * it rotates without notice. When IG_SIG_KEY is configured we compute a real
 * HMAC; otherwise we send the unsigned `SIGNATURE.` prefix, which every
 * documented unofficial client reports as accepted on the non-auth routes
 * this adapter uses (publish / comment / like / oembed). Login and challenge
 * routes DO verify, which is why they are intentionally not implemented here.
 */
function buildSignedBody(
  body: Record<string, unknown>,
  signatureKey?: string | null,
): string {
  const json = JSON.stringify(body);
  const signature = signatureKey
    ? createHmac("sha256", signatureKey).update(json).digest("hex")
    : "SIGNATURE";
  const params = new URLSearchParams({
    signed_body: `${signature}.${json}`,
    ig_sig_key_version: "4",
  });
  return params.toString();
}

/**
 * The private mobile API rejects desktop browser agents on most endpoints,
 * and Threads requires the "Barcelona" shell specifically. The stored session
 * `ua` comes from the importing browser, so it is only honoured when it is
 * already an app agent (Instagram 155… / Barcelona 289…); otherwise the
 * platform-correct default wins. This keeps Threads publishing working even
 * when the cookie came from Chrome.
 */
function resolveUserAgent(platform: "instagram" | "threads", session: ResolvedSession): string {
  const stored = session.payload.ua?.trim() || "";
  const isAppAgent = /^Instagram\s+\d/i.test(stored) || /^Barcelona\s+\d/i.test(stored);
  if (!isAppAgent) return USER_AGENT[platform];
  if (platform === "threads" && !/^Barcelona\s+\d/i.test(stored)) return USER_AGENT.threads;
  if (platform === "instagram" && /^Barcelona\s+\d/i.test(stored)) return USER_AGENT.instagram;
  return stored;
}

function buildHeaders(
  platform: "instagram" | "threads",
  session: ResolvedSession,
): Record<string, string> {
  return {
    "user-agent": resolveUserAgent(platform, session),
    cookie: cookieHeader(session),
    "x-ig-app-id": APP_ID[platform],
    "x-ig-device-type": "android",
    "x-ig-connection-type": "WIFI",
    "x-ig-capabilities": "3brTvw==",
    "x-fb-connection-type": "WIFI",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    referer: platform === "threads" ? "https://www.threads.net/" : "https://www.instagram.com/",
  };
}

type PrivateResponse = {
  status: "ok" | string;
  pk?: string;
  pk_id?: string;
  media?: { pk?: string; code?: string };
  media_id?: string;
  comment?: { pk?: string; text?: string };
  message?: string;
  error_type?: string;
  require_login?: boolean;
  checkpoint_url?: string;
  [key: string]: unknown;
};

async function privateRequest(
  input: {
    path: string;
    platform: "instagram" | "threads";
    session: ResolvedSession;
    method?: "GET" | "POST";
    form?: Record<string, unknown>;
    deps?: SessionConnectorDeps;
  },
): Promise<{ response: Response; body: PrivateResponse | null; latencyMs: number }> {
  const deps = input.deps ?? {};
  const doFetch = deps.fetchImpl ?? safeOutboundFetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const url = `${PRIVATE_API}${input.path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const init: RequestInit = {
      method: input.method ?? "POST",
      headers: buildHeaders(input.platform, input.session),
      signal: controller.signal,
    };
    if (input.form) {
      init.body = buildSignedBody(input.form, deps.signatureKey);
    }
    const response = await doFetch(url, init);
    const text = await response.text().catch(() => "");
    let body: PrivateResponse | null = null;
    if (text) {
      try {
        body = JSON.parse(text) as PrivateResponse;
      } catch {
        body = null;
      }
    }
    return { response, body, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * Media resolution helpers
 * ------------------------------------------------------------------ */

/**
 * Resolve a post URL or shortcode to Instagram's internal `pk`.
 * Uses the mobile oembed endpoint, which works for both instagram.com and
 * threads.net post URLs and does not require a signature.
 */
async function resolveMediaPk(
  input: { urlOrCode: string; platform: "instagram" | "threads"; session: ResolvedSession },
  deps?: SessionConnectorDeps,
): Promise<{ ok: true; pk: string; code: string } | { ok: false; reason: string }> {
  const raw = input.urlOrCode.trim();
  if (!raw) return { ok: false, reason: "empty_url" };

  const codeMatch = raw.match(/(?:\/(?:p|reel|tv|t)\/)([A-Za-z0-9_-]+)/);
  const url =
    codeMatch?.[1] && !raw.startsWith("http")
      ? `https://www.instagram.com/p/${codeMatch[1]}/`
      : raw;
  const code = codeMatch?.[1] ?? "";

  const doFetch = deps?.fetchImpl ?? safeOutboundFetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps?.timeoutMs ?? 12_000);
  try {
    const target = `${PRIVATE_API}/oembed/?url=${encodeURIComponent(url)}`;
    const response = await doFetch(target, {
      method: "GET",
      headers: {
        "user-agent": resolveUserAgent(input.platform, input.session),
        cookie: cookieHeader(input.session),
        "x-ig-app-id": APP_ID[input.platform],
      },
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => ({}))) as {
      media_id?: string;
      thumbnail_url?: string;
    };
    const mediaId = body.media_id || "";
    const pk = mediaId.split("_")[0] || "";
    if (!pk || !/^\d+$/.test(pk)) {
      // Fallback: the raw pk may have been pasted directly.
      if (/^\d+$/.test(raw)) return { ok: true, pk: raw, code };
      return { ok: false, reason: "media_not_found" };
    }
    return { ok: true, pk, code };
  } catch (error) {
    return { ok: false, reason: error instanceof UnsafeUrlError ? "unsafe_url" : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ *
 * Action implementations
 * ------------------------------------------------------------------ */

function fail(
  message: string,
  details?: Record<string, unknown>,
): ConnectorResult {
  return {
    ok: false,
    mode: "live",
    connector: "session",
    message,
    details,
  };
}

function ok(
  message: string,
  extra?: Partial<ConnectorResult>,
): ConnectorResult {
  return {
    ok: true,
    mode: "live",
    connector: "session",
    message,
    ...extra,
  };
}

/** Map private-API failures onto actionable, non-secret-leaking messages. */
function interpretFailure(
  response: Response,
  body: PrivateResponse | null,
  action: string,
): ConnectorResult {
  const status = response.status;
  if (status === 401 || status === 403 || body?.require_login === true) {
    return fail(
      "Sesi kedaluwarsa atau diblokir. Impor ulang cookie akun ini.",
      { signal: "session_expired", status },
    );
  }
  if (status === 429) {
    return fail(
      "Instagram menolak permintaan (rate limit). Tunggu beberapa menit lalu coba lagi.",
      { signal: "rate_limited", status },
    );
  }
  if (body?.checkpoint_url) {
    return fail(
      "Akun kena checkpoint. Login manual di browser untuk menyelesaikan verifikasi.",
      { signal: "checkpoint_required", status },
    );
  }
  if (status >= 500) {
    return fail(`Instagram sedang bermasalah (HTTP ${status}).`, { status });
  }
  return fail(
    `Aksi ${action} ditolak Instagram (HTTP ${status}${body?.message ? `: ${body.message}` : ""}).`,
    { status, error_type: body?.error_type },
  );
}

/**
 * Instagram reports `pk` as a bare numeric id in some responses and as
 * `<pk>_<userId>` (`media_id`) in others. Normalize to the bare pk so callers
 * can interpolate it into `/media/<pk>/…` without double-qualifying.
 */
function normalizePk(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const pk = raw.split("_")[0];
  return /^\d+$/.test(pk) ? pk : "";
}

async function runPublishPost(
  input: ConnectorActionInput,
  session: ResolvedSession,
  deps?: SessionConnectorDeps,
): Promise<ConnectorResult> {
  const platform = (input.target.platform || "instagram").toLowerCase();
  const isThreads = platform.includes("threads");
  const payload = input.payload as { body?: string; title?: string; hashtags?: string[] };

  const captionParts: string[] = [];
  if (payload.title) captionParts.push(payload.title);
  if (payload.body) captionParts.push(payload.body);
  if (Array.isArray(payload.hashtags) && payload.hashtags.length > 0) {
    captionParts.push(payload.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" "));
  }
  const caption = captionParts.join("\n\n").trim();
  if (!caption) return fail("Caption kosong — tidak ada yang bisa diposting.");

  const { deviceId, phoneId, guid } = deviceIds(session);

  const form: Record<string, unknown> = isThreads
    ? {
        text_post_app_info: { reply_control: 0 },
        timezone_offset: "25200",
        source_type: "4",
        _uid: phoneId,
        device_id: deviceId,
        caption,
        upload_id: guid,
        publish_mode: "text_post",
      }
    : {
        timezone_offset: "25200",
        source_type: "4",
        _uid: phoneId,
        device_id: deviceId,
        caption,
        upload_id: guid,
      };

  const path = isThreads
    ? "/media/configure_text_only_post/"
    : "/media/configure_text_post_app_feed/";

  let result;
  try {
    result = await privateRequest({
      path,
      platform: isThreads ? "threads" : "instagram",
      session,
      form,
      deps,
    });
  } catch (error) {
    return fail(
      error instanceof UnsafeUrlError
        ? `Endpoint diblokir: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Gagal menghubungi Instagram.",
    );
  }

  const { response, body, latencyMs } = result;
  if (!response.ok || body?.status !== "ok") {
    return interpretFailure(response, body, isThreads ? "post_threads" : "post_instagram");
  }

  const mediaPk = normalizePk(body?.pk) || normalizePk(body?.media?.pk);
  return ok(isThreads ? "Threads post terkirim." : "Instagram post terkirim.", {
    externalId: mediaPk || undefined,
    details: { latencyMs, platform: isThreads ? "threads" : "instagram" },
  });
}

async function runSendComment(
  input: ConnectorActionInput,
  session: ResolvedSession,
  deps?: SessionConnectorDeps,
): Promise<ConnectorResult> {
  const platform = (input.target.platform || "instagram").toLowerCase();
  const isThreads = platform.includes("threads");
  const payload = input.payload as {
    body?: string;
    targetPostUrl?: string | null;
    targetPostExternalId?: string | null;
    authorHandle?: string | null;
  };

  const text = (payload.body || "").trim();
  if (!text) return fail("Isi komentar kosong.");
  if (text.length > 2200) {
    return fail("Komentar terlalu panjang (maksimal 2.200 karakter).", {
      length: text.length,
    });
  }

  const target = (payload.targetPostUrl || payload.targetPostExternalId || "").trim();
  if (!target) return fail("Target post belum diisi (URL atau ID post).");

  const resolved = await resolveMediaPk(
    { urlOrCode: target, platform: isThreads ? "threads" : "instagram", session },
    deps,
  );
  if (!resolved.ok) {
    return fail(
      resolved.reason === "media_not_found"
        ? "Post tidak ditemukan. Pastikan URL-nya publik dan benar."
        : "Gagal membaca post target.",
      { signal: resolved.reason },
    );
  }

  const { phoneId, deviceId } = deviceIds(session);
  const isReply = isThreads;

  const form: Record<string, unknown> = isReply
    ? {
        text_post_app_info: { reply_control: 0, reply_id: resolved.pk },
        timezone_offset: "25200",
        source_type: "4",
        _uid: phoneId,
        device_id: deviceId,
        caption: text,
        upload_id: phoneId,
        publish_mode: "text_post",
      }
    : {
        comment_text: text,
        _uid: phoneId,
        containermodule: "comments_moderation",
        commenting_enabled: "1",
      };

  const path = isReply
    ? "/media/configure_text_only_post/"
    : `/media/${resolved.pk}/comments/`;

  let result;
  try {
    result = await privateRequest({
      path,
      platform: isReply ? "threads" : "instagram",
      session,
      form,
      deps,
    });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Gagal mengirim komentar.",
    );
  }

  const { response, body, latencyMs } = result;
  if (!response.ok || body?.status !== "ok") {
    return interpretFailure(response, body, isReply ? "reply_threads" : "comment_instagram");
  }

  const commentPk = body?.comment?.pk || body?.pk || "";
  return ok(isReply ? "Balasan terkirim." : "Komentar terkirim.", {
    externalId: commentPk ? String(commentPk) : undefined,
    details: {
      latencyMs,
      targetPk: resolved.pk,
      authorHandle: payload.authorHandle ?? undefined,
    },
  });
}

async function runDiscoverPosts(
  input: ConnectorActionInput,
  session: ResolvedSession,
  deps?: SessionConnectorDeps,
): Promise<ConnectorResult> {
  const payload = input.payload as { query?: string; limit?: number };
  const tag = (payload.query || "").trim().replace(/^#/, "");
  if (!tag) return fail("Kata kunci hashtag kosong.");

  const limit = Math.min(Math.max(payload.limit ?? 12, 1), 24);
  const { phoneId, deviceId } = deviceIds(session);

  let result;
  try {
    result = await privateRequest({
      path: "/tags/sections/",
      platform: "instagram",
      session,
      form: {
        tab: "recent",
        page: "0",
        surfaces: "clips,feed_media",
        tag_count: "0",
        ranked_content: "true",
        _uid: phoneId,
        _csrftoken: session.payload.cookies.find((c) => c.name === "csrftoken")?.value || "",
        device_id: deviceId,
      },
      deps,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Gagal memuat post.");
  }

  const { response, body } = result;
  if (!response.ok || body?.status !== "ok") {
    return interpretFailure(response, body, "discover_hashtag");
  }

  const sections = (body?.sections ?? []) as Array<{
    layout_content?: {
      medias?: Array<{
        media?: { pk?: string; code?: string; caption?: { text?: string }; user?: { username?: string } };
      }>;
    };
  }>;

  const posts: DiscoveredPost[] = [];
  for (const section of sections) {
    for (const item of section.layout_content?.medias ?? []) {
      const media = item.media;
      if (!media?.code) continue;
      posts.push({
        externalId: String(media.pk || media.code),
        authorHandle: media.user?.username || "unknown",
        content: (media.caption?.text || "").slice(0, 280),
        url: `https://www.instagram.com/p/${media.code}/`,
        platform: "instagram",
      });
      if (posts.length >= limit) break;
    }
    if (posts.length >= limit) break;
  }

  if (posts.length === 0) {
    return fail(
      `Hashtag #${tag} tidak mengembalikan post. Coba hashtag lain atau cek session.`,
      { tag },
    );
  }

  return ok(`${posts.length} post ditemukan untuk #${tag}.`, { posts });
}

/* ------------------------------------------------------------------ *
 * Public entry
 * ------------------------------------------------------------------ */

export async function runSessionConnector(
  input: ConnectorActionInput,
  session: { encryptedBlob: string; platform: Platform; username?: string | null },
  deps?: SessionConnectorDeps,
): Promise<ConnectorResult> {
  const resolved = resolveSessionBlob(
    session.encryptedBlob,
    session.platform,
    session.username,
  );
  if (!resolved.ok) {
    return {
      ok: false,
      mode: "live",
      connector: "session",
      message:
        resolved.reason === "decrypt_failed"
          ? "Gagal membuka sesi tersimpan (kunci enkripsi tidak cocok)."
          : "Sesi tidak valid — impor ulang cookie akun ini.",
      details: { signal: resolved.reason },
    };
  }

  switch (input.action) {
    case "publishPost":
      return runPublishPost(input, resolved.session, deps);
    case "sendComment":
      return runSendComment(input, resolved.session, deps);
    case "discoverPosts":
      return runDiscoverPosts(input, resolved.session, deps);
    case "healthProbe":
      return ok("Sesi siap dipakai.", { healthy: true });
    case "rotateProxy":
      return fail("Rotasi proxy tidak didukung jalur sesi (cookie menempel di IP asal).");
    default:
      return fail(`Aksi ${(input.action as string) || "unknown"} tidak didukung jalur sesi.`);
  }
}
