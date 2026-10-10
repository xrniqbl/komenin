import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isProductionRuntime } from "@/lib/security";

/**
 * Pairing token for the cookie-import bridge.
 *
 * The bookmarklet/extension runs on instagram.com / threads.net and posts the
 * user's cookies to our ingest route. It cannot carry our session cookie —
 * SameSite=Lax blocks cross-site credentialed requests — so the route is
 * authenticated by a signed, short-lived token minted by the wizard while the
 * user is logged in here.
 *
 * Threat model:
 *   - HMAC-SHA256 over a base64url body, verified with timingSafeEqual.
 *   - 10-minute expiry, single platform, bound to user + workspace.
 *   - Token is visible to any script running in the user's browser on the
 *     platform origin, so it must never grant more than "write cookies for
 *     this user in this workspace" — which is exactly what it grants.
 *   - Cookie values are never embedded in the token, only in the request body.
 */

export type SessionIngestTokenPayload = {
  userId: string;
  workspaceId: string;
  platform: "instagram" | "threads" | "tiktok";
  nonce: string;
  exp: number;
};

const MAX_TTL_SECONDS = 10 * 60;

function tokenSecret(): string {
  const dedicated = process.env.SESSION_INGEST_SECRET?.trim();
  if (dedicated) return dedicated;
  if (isProductionRuntime()) {
    throw new Error(
      "SESSION_INGEST_SECRET is required in production (no AUTH_SECRET fallback)",
    );
  }
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    "dev-session-ingest-secret"
  );
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(normalized, "base64");
}

export function signSessionIngestToken(
  payload: Omit<SessionIngestTokenPayload, "nonce" | "exp">,
): string {
  const full: SessionIngestTokenPayload = {
    ...payload,
    nonce: randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + MAX_TTL_SECONDS,
  };
  const secret = tokenSecret();
  const body = b64url(JSON.stringify(full));
  const sig = createHmac("sha256", secret).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

export function verifySessionIngestToken(
  raw: string,
): SessionIngestTokenPayload | null {
  const secret = tokenSecret();
  if (!secret || !raw || !raw.includes(".")) return null;
  const [body, sigPart] = raw.split(".");
  if (!body || !sigPart) return null;

  const expected = createHmac("sha256", secret).update(body).digest();
  let provided: Buffer;
  try {
    provided = fromB64url(sigPart);
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  let payload: SessionIngestTokenPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as SessionIngestTokenPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.exp !== "number" ||
    payload.exp * 1000 < Date.now() ||
    typeof payload.userId !== "string" ||
    typeof payload.workspaceId !== "string" ||
    typeof payload.platform !== "string"
  ) {
    return null;
  }
  return payload;
}

/**
 * Origins allowed to call the ingest route with CORS. Only the official
 * platform web origins are listed — a malicious site must not be able to
 * POST to the bridge even with a stolen token, because the browser enforces
 * Origin against this list before the request body is even sent.
 */
export const INGEST_ALLOWED_ORIGINS = [
  "https://www.instagram.com",
  "https://instagram.com",
  "https://www.threads.net",
  "https://threads.net",
  "https://www.threads.com",
  "https://threads.com",
] as const;

export function ingestCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && INGEST_ALLOWED_ORIGINS.includes(origin as never);
  return {
    // Never `*` — credentialed requests require an explicit origin echo.
    ...(allowed ? { "access-control-allow-origin": origin } : {}),
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}
