import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { isProductionRuntime } from "@/lib/security";

export type SsoTicketPayload = {
  userId: string;
  workspaceId: string;
  email: string;
  exp: number; // unix seconds
  nonce: string;
};

function ticketSecret(): string {
  // Dedicated secret in production — falling back to AUTH_SECRET during a
  // rotation would invalidate every in-flight SSO handshake, so the fallback
  // is dev-only and production boot fails loudly.
  const dedicated = process.env.SSO_TICKET_SECRET?.trim();
  if (dedicated) return dedicated;
  if (isProductionRuntime()) {
    throw new Error(
      "SSO_TICKET_SECRET is required in production (no AUTH_SECRET fallback)",
    );
  }
  return (
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

export function signSsoTicket(
  input: Omit<SsoTicketPayload, "exp" | "nonce"> & { ttlSeconds?: number },
): string {
  const secret = ticketSecret();
  if (!secret) throw new Error("AUTH_SECRET required to mint SSO tickets");
  const payload: SsoTicketPayload = {
    userId: input.userId,
    workspaceId: input.workspaceId,
    email: input.email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 120),
    nonce: b64url(randomBytes(12)),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

export function verifySsoTicket(raw: string): SsoTicketPayload | null {
  const secret = ticketSecret();
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
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as SsoTicketPayload;
    if (!payload.userId || !payload.workspaceId || !payload.email || !payload.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Single-use nonce registry: a signed ticket may only be exchanged once.
 * Guards against replay inside the 120s TTL window — a ticket seen in transit
 * (browser history, access logs, Referer) must not mint a second session.
 * Entries are pruned lazily on insert; the map lives per server process,
 * mirroring consumeOAuthState. Cross-process replay is bounded by the short
 * TTL plus the userId/email binding inside the signed payload.
 */
const consumedNonces = new Map<string, number>();

function pruneConsumedNonces(now: number) {
  if (consumedNonces.size < 512) return;
  for (const [nonce, exp] of consumedNonces) {
    if (exp * 1000 < now) consumedNonces.delete(nonce);
  }
}

/** Verify the signed ticket AND mark its nonce consumed (single-use). */
export function consumeSsoTicket(raw: string): SsoTicketPayload | null {
  const payload = verifySsoTicket(raw);
  if (!payload) return null;

  const now = Date.now();
  pruneConsumedNonces(now);

  const nonce = payload.nonce || "";
  if (nonce) {
    if (consumedNonces.has(nonce)) return null;
    consumedNonces.set(nonce, payload.exp);
  }
  return payload;
}
