import type { Platform } from "@prisma/client";
import { decryptSecret } from "@/lib/encryption";
import {
  assertProductionSessionPayload,
  type NormalizedSessionPayload,
} from "@/lib/session-payload";

export type SessionProbeResult = {
  ok: boolean;
  signal: string;
  details: string;
  latencyMs: number | null;
  /** Soft score contribution 0-100 after probe. */
  healthScore: number;
  matchedUsername?: string | null;
  mode: "live_http" | "shape_only" | "decrypt_failed" | "missing";
};

function cookieHeader(payload: NormalizedSessionPayload): string {
  return payload.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

function cookieMap(payload: NormalizedSessionPayload): Map<string, string> {
  return new Map(payload.cookies.map((c) => [c.name, c.value]));
}

async function timedFetch(
  url: string,
  init: RequestInit,
): Promise<{ response: Response; latencyMs: number; bodyText: string }> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
    });
    const bodyText = await response.text().catch(() => "");
    return { response, latencyMs: Date.now() - started, bodyText };
  } finally {
    clearTimeout(timeout);
  }
}

function looksLoggedOut(body: string, location: string | null): boolean {
  const loc = (location || "").toLowerCase();
  const text = body.slice(0, 4000).toLowerCase();
  if (loc.includes("/accounts/login") || loc.includes("/login")) return true;
  if (text.includes('"viewerId":null') || text.includes('"viewer":null')) return true;
  if (text.includes("not logged in") || text.includes("login_required")) return true;
  return false;
}

async function probeInstagramOrThreads(
  platform: "instagram" | "threads",
  payload: NormalizedSessionPayload,
  expectedUsername?: string | null,
): Promise<SessionProbeResult> {
  const cookies = cookieMap(payload);
  const sessionid = cookies.get("sessionid");
  const dsUserId = cookies.get("ds_user_id");
  if (!sessionid) {
    return {
      ok: false,
      signal: "cookie_missing_sessionid",
      details: "sessionid cookie missing after decrypt",
      latencyMs: null,
      healthScore: 20,
      mode: "shape_only",
    };
  }

  const origin =
    platform === "threads" ? "https://www.threads.net" : "https://www.instagram.com";
  const headers: Record<string, string> = {
    cookie: cookieHeader(payload),
    "user-agent": payload.ua,
    accept: "text/html,application/xhtml+xml,application/json",
    "accept-language": "en-US,en;q=0.9",
  };

  // Lightweight authenticated surface: edit profile page requires a live session.
  const target =
    platform === "threads"
      ? `${origin}/`
      : `${origin}/accounts/edit/`;

  try {
    const { response, latencyMs, bodyText } = await timedFetch(target, {
      method: "GET",
      headers,
    });
    const location = response.headers.get("location");
    const status = response.status;

    if (status >= 300 && status < 400 && looksLoggedOut(bodyText, location)) {
      return {
        ok: false,
        signal: "session_expired",
        details: `Redirected to login (${status})`,
        latencyMs,
        healthScore: 15,
        mode: "live_http",
      };
    }

    if (status === 401 || status === 403) {
      return {
        ok: false,
        signal: "session_unauthorized",
        details: `Platform returned HTTP ${status}`,
        latencyMs,
        healthScore: 20,
        mode: "live_http",
      };
    }

    if (looksLoggedOut(bodyText, location)) {
      return {
        ok: false,
        signal: "session_expired",
        details: "Response looks like a logged-out page",
        latencyMs,
        healthScore: 15,
        mode: "live_http",
      };
    }

    // Soft username binding when ds_user_id present
    let matchedUsername: string | null = expectedUsername || null;
    if (expectedUsername && bodyText) {
      const lower = bodyText.toLowerCase();
      if (lower.includes(expectedUsername.toLowerCase())) {
        matchedUsername = expectedUsername;
      }
    }

    const ok = status >= 200 && status < 400;
    return {
      ok,
      signal: ok ? "session_live" : "session_http_error",
      details: ok
        ? `Live HTTP probe ok (${status})${dsUserId ? `; ds_user_id=${dsUserId}` : ""}`
        : `Unexpected HTTP ${status}`,
      latencyMs,
      healthScore: ok ? 88 : 35,
      matchedUsername,
      mode: "live_http",
    };
  } catch (error) {
    return {
      ok: false,
      signal: "probe_network_error",
      details: error instanceof Error ? error.message : "Probe failed",
      latencyMs: null,
      healthScore: 40,
      mode: "live_http",
    };
  }
}

async function probeTikTok(
  payload: NormalizedSessionPayload,
  expectedUsername?: string | null,
): Promise<SessionProbeResult> {
  const cookies = cookieMap(payload);
  if (!cookies.get("sessionid")) {
    return {
      ok: false,
      signal: "cookie_missing_sessionid",
      details: "sessionid cookie missing after decrypt",
      latencyMs: null,
      healthScore: 20,
      mode: "shape_only",
    };
  }

  try {
    const { response, latencyMs, bodyText } = await timedFetch("https://www.tiktok.com/", {
      method: "GET",
      headers: {
        cookie: cookieHeader(payload),
        "user-agent": payload.ua,
        accept: "text/html,application/xhtml+xml",
      },
    });
    const location = response.headers.get("location");
    if (looksLoggedOut(bodyText, location) || response.status === 401) {
      return {
        ok: false,
        signal: "session_expired",
        details: `TikTok session appears logged out (HTTP ${response.status})`,
        latencyMs,
        healthScore: 15,
        mode: "live_http",
      };
    }
    const ok = response.status >= 200 && response.status < 400;
    return {
      ok,
      signal: ok ? "session_live" : "session_http_error",
      details: ok
        ? `TikTok live HTTP probe ok (${response.status})`
        : `Unexpected HTTP ${response.status}`,
      latencyMs,
      healthScore: ok ? 85 : 35,
      matchedUsername: expectedUsername || null,
      mode: "live_http",
    };
  } catch (error) {
    return {
      ok: false,
      signal: "probe_network_error",
      details: error instanceof Error ? error.message : "Probe failed",
      latencyMs: null,
      healthScore: 40,
      mode: "live_http",
    };
  }
}

/**
 * Decrypt an encrypted session blob and probe the platform.
 * Never logs cookie values.
 */
export async function probeEncryptedSession(input: {
  encryptedBlob: string;
  platform: Platform;
  username?: string | null;
}): Promise<SessionProbeResult> {
  let raw: string;
  try {
    raw = decryptSecret(input.encryptedBlob);
  } catch {
    return {
      ok: false,
      signal: "decrypt_failed",
      details: "Could not decrypt session vault blob",
      latencyMs: null,
      healthScore: 10,
      mode: "decrypt_failed",
    };
  }

  let normalized: NormalizedSessionPayload;
  try {
    const validated = assertProductionSessionPayload(raw, input.platform, {
      username: input.username || undefined,
    });
    normalized = validated.payload;
  } catch (error) {
    return {
      ok: false,
      signal: "payload_invalid",
      details: error instanceof Error ? error.message : "Invalid session payload",
      latencyMs: null,
      healthScore: 15,
      mode: "shape_only",
    };
  }

  if (input.platform === "tiktok") {
    return probeTikTok(normalized, input.username);
  }
  if (input.platform === "threads") {
    return probeInstagramOrThreads("threads", normalized, input.username);
  }
  return probeInstagramOrThreads("instagram", normalized, input.username);
}
