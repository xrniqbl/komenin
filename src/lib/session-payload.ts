import type { Platform } from "@prisma/client";

export type SessionCookie = {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
};

export type SessionPayload = {
  platform?: string;
  username?: string;
  capturedAt?: string;
  ua?: string;
  cookies?: SessionCookie[];
  meta?: Record<string, unknown>;
};

export type CookieFieldSpec = {
  key: string;
  label: string;
  required?: boolean;
};

export type NormalizedSessionPayload = {
  platform: Platform;
  username?: string;
  capturedAt: string;
  ua: string;
  cookies: Required<Pick<SessionCookie, "name" | "value" | "domain" | "path" | "secure" | "httpOnly">>[];
  meta: {
    source: string;
    cookieCount: number;
    requiredCookies: string[];
    notes: string;
  };
};

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const HTTP_ONLY_COOKIES = new Set(["sessionid", "sid_tt"]);

export function cookieFieldsForPlatform(platform: Platform): CookieFieldSpec[] {
  if (platform === "tiktok") {
    return [
      { key: "sessionid", label: "sessionid", required: true },
      { key: "sid_tt", label: "sid_tt" },
      { key: "tt_csrf_token", label: "tt_csrf_token" },
      { key: "msToken", label: "msToken" },
    ];
  }
  if (platform === "threads") {
    return [
      { key: "sessionid", label: "sessionid", required: true },
      { key: "ds_user_id", label: "ds_user_id", required: true },
      { key: "csrftoken", label: "csrftoken", required: true },
      { key: "mid", label: "mid" },
    ];
  }
  return [
    { key: "sessionid", label: "sessionid", required: true },
    { key: "ds_user_id", label: "ds_user_id", required: true },
    { key: "csrftoken", label: "csrftoken", required: true },
    { key: "mid", label: "mid" },
    { key: "ig_did", label: "ig_did" },
  ];
}

export function requiredCookieKeys(platform: Platform): string[] {
  return cookieFieldsForPlatform(platform)
    .filter((field) => field.required)
    .map((field) => field.key);
}

export function domainForPlatform(platform: Platform): string {
  if (platform === "tiktok") return ".tiktok.com";
  if (platform === "threads") return ".threads.net";
  return ".instagram.com";
}

export function loginUrlForPlatform(platform: Platform): string {
  if (platform === "tiktok") return "https://www.tiktok.com/login";
  if (platform === "threads") return "https://www.threads.net/login";
  return "https://www.instagram.com/accounts/login/";
}

export function hostHintForPlatform(platform: Platform): string {
  if (platform === "tiktok") {
    return "Chrome DevTools → Application → Cookies → https://www.tiktok.com";
  }
  if (platform === "threads") {
    return "Chrome DevTools → Application → Cookies → https://www.threads.net";
  }
  return "Chrome DevTools → Application → Cookies → https://www.instagram.com";
}

export function looksLikeDemoCookieValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  return /^demo([_\-]|$)/.test(v) || v.includes("demo_");
}

export function parseSessionPayloadJson(raw: string): SessionPayload {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Session payload must be a JSON object");
  }
  return parsed as SessionPayload;
}

function normalizeCookieName(name: string): string {
  return name.trim();
}

function collectCookies(payload: SessionPayload): SessionCookie[] {
  if (!Array.isArray(payload.cookies)) return [];
  const byName = new Map<string, SessionCookie>();
  for (const item of payload.cookies) {
    if (!item || typeof item !== "object") continue;
    const name = normalizeCookieName(String(item.name || ""));
    const value = String(item.value || "").trim();
    if (!name || !value) continue;
    byName.set(name, {
      name,
      value,
      domain: typeof item.domain === "string" ? item.domain : undefined,
      path: typeof item.path === "string" ? item.path : undefined,
      secure: typeof item.secure === "boolean" ? item.secure : undefined,
      httpOnly: typeof item.httpOnly === "boolean" ? item.httpOnly : undefined,
    });
  }
  return Array.from(byName.values());
}

export function assertProductionSessionPayload(
  raw: string,
  platform: Platform,
  opts?: { username?: string; userAgent?: string },
): {
  payload: NormalizedSessionPayload;
  cookieNames: string[];
  serialized: string;
} {
  if (!raw.trim()) throw new Error("Session payload is required");

  let rawPayload: SessionPayload;
  try {
    rawPayload = parseSessionPayloadJson(raw);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Session payload must be valid JSON");
    }
    throw error;
  }

  if (rawPayload.platform && rawPayload.platform !== platform) {
    throw new Error(
      `Session payload platform mismatch: expected ${platform}, got ${rawPayload.platform}`,
    );
  }

  const cookiesIn = collectCookies(rawPayload);
  if (cookiesIn.length === 0) {
    throw new Error("Session payload cookies are empty. Capture platform cookies first.");
  }

  const domain = domainForPlatform(platform);
  const cookies = cookiesIn.map((cookie) => {
    if (looksLikeDemoCookieValue(cookie.value)) {
      throw new Error("Demo session cookies are not allowed in production");
    }
    if (cookie.value.length < 3) {
      throw new Error(`Cookie ${cookie.name} looks invalid (too short)`);
    }
    return {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || domain,
      path: cookie.path || "/",
      secure: cookie.secure ?? true,
      httpOnly: cookie.httpOnly ?? HTTP_ONLY_COOKIES.has(cookie.name),
    };
  });

  const cookieNames = cookies.map((cookie) => cookie.name);
  const missing = requiredCookieKeys(platform).filter((key) => !cookieNames.includes(key));
  if (missing.length > 0) {
    throw new Error(`Missing required ${platform} cookies: ${missing.join(", ")}`);
  }

  const username =
    (opts?.username || rawPayload.username || "").trim().replace(/^@/, "") || undefined;
  const ua = (opts?.userAgent || rawPayload.ua || DEFAULT_UA).trim() || DEFAULT_UA;

  const payload: NormalizedSessionPayload = {
    platform,
    username,
    capturedAt:
      typeof rawPayload.capturedAt === "string" && rawPayload.capturedAt
        ? rawPayload.capturedAt
        : new Date().toISOString(),
    ua,
    cookies,
    meta: {
      source: "connect_account_session_import",
      cookieCount: cookies.length,
      requiredCookies: requiredCookieKeys(platform),
      notes: "Normalized production session payload. Secrets encrypted at rest.",
    },
  };

  return {
    payload,
    cookieNames,
    serialized: JSON.stringify(payload),
  };
}

export function buildSessionPayloadFromCookieMap(input: {
  platform: Platform;
  values: Record<string, string>;
  userAgent?: string;
  username?: string;
}): NormalizedSessionPayload {
  const domain = domainForPlatform(input.platform);
  const cookies = cookieFieldsForPlatform(input.platform)
    .map((field) => {
      const value = (input.values[field.key] || "").trim();
      if (!value) return null;
      return {
        name: field.key,
        value,
        domain,
        path: "/",
        secure: true,
        httpOnly: HTTP_ONLY_COOKIES.has(field.key),
      };
    })
    .filter(Boolean) as NormalizedSessionPayload["cookies"];

  return {
    platform: input.platform,
    username: input.username?.trim().replace(/^@/, "") || undefined,
    capturedAt: new Date().toISOString(),
    ua: input.userAgent?.trim() || DEFAULT_UA,
    cookies,
    meta: {
      source: "connect_account_builder",
      cookieCount: cookies.length,
      requiredCookies: requiredCookieKeys(input.platform),
      notes:
        cookies.length > 0
          ? "Captured from cookie fields/header."
          : "Empty cookies. Paste real session cookies before save.",
    },
  };
}

export function parseCookieHeader(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const text = raw.trim();
  if (!text) return out;

  try {
    const asJson = JSON.parse(text) as unknown;
    if (asJson && typeof asJson === "object" && !Array.isArray(asJson)) {
      const obj = asJson as Record<string, unknown>;
      if (Array.isArray(obj.cookies)) {
        for (const item of obj.cookies) {
          if (item && typeof item === "object") {
            const c = item as Record<string, unknown>;
            if (typeof c.name === "string" && typeof c.value === "string") {
              out[c.name] = c.value;
            }
          }
        }
        return out;
      }
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
  } catch {
    // not json
  }

  const parts = text.includes("\n")
    ? text.split(/\r?\n/).flatMap((line) => line.split(";"))
    : text.split(";");

  for (const part of parts) {
    const cleaned = part.trim();
    if (!cleaned) continue;
    const lower = cleaned.toLowerCase();
    if (
      lower.startsWith("path=") ||
      lower.startsWith("domain=") ||
      lower.startsWith("expires=") ||
      lower === "secure" ||
      lower === "httponly"
    ) {
      continue;
    }
    if (!cleaned.includes("=") && /\s+/.test(cleaned)) {
      const [name, ...rest] = cleaned.split(/\s+/);
      if (name && rest.length) out[name] = rest.join(" ");
      continue;
    }
    const idx = cleaned.indexOf("=");
    if (idx <= 0) continue;
    const name = cleaned.slice(0, idx).trim();
    const value = cleaned.slice(idx + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}
