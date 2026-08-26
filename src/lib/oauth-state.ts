import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type OAuthProvider = "instagram" | "threads" | "tiktok";

export type OAuthStatePayload = {
  workspaceId: string;
  provider: OAuthProvider;
  socialAccountId?: string | null;
  nonce: string;
  exp: number; // unix seconds
};

function stateSecret(): string {
  return (
    process.env.OAUTH_STATE_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    ""
  );
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(normalized, "base64");
}

export function signOAuthState(payload: OAuthStatePayload): string {
  const secret = stateSecret();
  if (!secret) throw new Error("OAUTH_STATE_SECRET or AUTH_SECRET required to sign OAuth state");
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

export function verifyOAuthState(raw: string): OAuthStatePayload | null {
  const secret = stateSecret();
  if (!secret || !raw || !raw.includes(".")) return null;
  const [body, sigPart] = raw.split(".");
  if (!body || !sigPart) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const provided = fromB64url(sigPart);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as OAuthStatePayload;
    if (!payload.workspaceId || !payload.provider || !payload.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createOAuthState(input: {
  workspaceId: string;
  provider: OAuthProvider;
  socialAccountId?: string | null;
  ttlSeconds?: number;
}): string {
  const ttl = input.ttlSeconds ?? 60 * 15;
  return signOAuthState({
    workspaceId: input.workspaceId,
    provider: input.provider,
    socialAccountId: input.socialAccountId || null,
    nonce: randomBytes(16).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + ttl,
  });
}

/** Generate base URL from env (production-ready). */
export function appBaseUrl(): string {
  return (process.env.APP_URL || process.env.AUTH_URL || "").replace(/\/$/, "");
}

/** Rate limit helper for OAuth callbacks. */
export const OAUTH_CALLBACK_RATE_LIMIT = 10; // requests per minute
export const OAUTH_CALLBACK_WINDOW_MS = 60 * 1000; // 1-minute sliding window

export function oauthCallbackUrl(provider: OAuthProvider): string {
  return `${appBaseUrl()}/api/connectors/${provider}/callback`;
}

/** @deprecated use oauthCallbackUrl('instagram') */
export function instagramOAuthCallbackUrl(): string {
  return oauthCallbackUrl("instagram");
}

export function isInstagramOAuthConfigured(): boolean {
  return Boolean(
    process.env.INSTAGRAM_APP_ID?.trim() &&
      process.env.INSTAGRAM_APP_SECRET?.trim() &&
      appBaseUrl(),
  );
}

export function isThreadsOAuthConfigured(): boolean {
  // Threads uses Meta app credentials (can share IG app or dedicated).
  return Boolean(
    (process.env.THREADS_APP_ID?.trim() || process.env.INSTAGRAM_APP_ID?.trim()) &&
      (process.env.THREADS_APP_SECRET?.trim() || process.env.INSTAGRAM_APP_SECRET?.trim()) &&
      appBaseUrl(),
  );
}

export function isTikTokOAuthConfigured(): boolean {
  return Boolean(
    process.env.TIKTOK_CLIENT_KEY?.trim() &&
      process.env.TIKTOK_CLIENT_SECRET?.trim() &&
      appBaseUrl(),
  );
}

export function isOAuthProviderConfigured(provider: OAuthProvider): boolean {
  if (provider === "instagram") return isInstagramOAuthConfigured();
  if (provider === "threads") return isThreadsOAuthConfigured();
  return isTikTokOAuthConfigured();
}
