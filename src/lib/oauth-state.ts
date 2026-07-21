import { createHmac, timingSafeEqual } from "node:crypto";
import { isProductionRuntime } from "@/lib/security";

export type OAuthStatePayload = {
  workspaceId: string;
  provider: "instagram" | "threads" | "tiktok";
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
  provider: OAuthStatePayload["provider"];
  socialAccountId?: string | null;
  ttlSeconds?: number;
}): string {
  const ttl = input.ttlSeconds ?? 60 * 15;
  return signOAuthState({
    workspaceId: input.workspaceId,
    provider: input.provider,
    socialAccountId: input.socialAccountId || null,
    nonce: b64url(Buffer.from(`${Date.now()}-${Math.random()}`)),
    exp: Math.floor(Date.now() / 1000) + ttl,
  });
}

/** True when Instagram OAuth env is complete enough to start authorize. */
export function isInstagramOAuthConfigured(): boolean {
  return Boolean(
    process.env.INSTAGRAM_APP_ID?.trim() &&
      process.env.INSTAGRAM_APP_SECRET?.trim() &&
      (process.env.APP_URL?.trim() || process.env.AUTH_URL?.trim()),
  );
}

export function instagramOAuthCallbackUrl(): string {
  const base = (process.env.APP_URL || process.env.AUTH_URL || "").replace(/\/$/, "");
  return `${base}/api/connectors/instagram/callback`;
}

export function assertOAuthAllowedInRuntime(): void {
  // OAuth code exchange is only safe when app secrets are present.
  // Production always requires full config; non-prod also requires config (no fake connect).
  if (!isInstagramOAuthConfigured() && isProductionRuntime()) {
    throw new Error("Instagram OAuth is not configured");
  }
}
