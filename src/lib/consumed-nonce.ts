import { createHash } from "node:crypto";

import { db } from "@/lib/db";

/**
 * Durable single-use nonce store (M5).
 *
 * The old in-memory Map registries in sso-ticket.ts / oauth-state.ts only
 * work per server process — on multi-instance or serverless deploys a
 * sniffed ticket/state (browser history, access logs, Referer) could be
 * replayed against a different instance inside the TTL window and mint a
 * second session / OAuth binding.
 *
 * This store persists consumed nonces in the database so every instance sees
 * every consumption. The claim is atomic: exactly one concurrent consumer
 * wins because `nonceHash` is UNIQUE — the loser's insert throws P2002.
 *
 * Rows are tiny (one hash + expiry) and pruned opportunistically on insert,
 * so no cron job is needed.
 */

const KIND_SSO_TICKET = "sso_ticket";
const KIND_OAUTH_STATE = "oauth_state";

function hashNonce(kind: string, nonce: string): string {
  return createHash("sha256").update(`${kind}:${nonce}`).digest("hex");
}

async function pruneExpiredNonces(now: Date): Promise<void> {
  try {
    await db.consumedNonce.deleteMany({ where: { expiresAt: { lt: now } } });
  } catch {
    // Pruning is best-effort — a failure must never block auth.
  }
}

/**
 * Atomically claim a nonce. Returns true when this caller is the first (and
 * only) consumer; false when the nonce was already used.
 */
async function claimNonce(input: {
  kind: string;
  nonce: string;
  expiresAt: Date;
}): Promise<boolean> {
  if (!input.nonce) return false;
  const now = new Date();
  if (input.expiresAt <= now) return false;
  try {
    await db.consumedNonce.create({
      data: {
        kind: input.kind,
        nonceHash: hashNonce(input.kind, input.nonce),
        expiresAt: input.expiresAt,
      },
    });
  } catch (error) {
    // P2002 unique violation = another request already consumed this nonce.
    if ((error as { code?: string }).code === "P2002") return false;
    // Any other DB failure must NOT read as "not consumed" — that would
    // reopen the replay window. Fail closed: reject the consumption.
    console.error("[consumed-nonce] claim failed (fail-closed)", error);
    return false;
  }
  // Opportunistic cleanup, fire-and-forget.
  void pruneExpiredNonces(now);
  return true;
}

/** Claim an SSO ticket nonce (single-use across all instances). */
export async function claimSsoTicketNonce(
  nonce: string,
  expSeconds: number,
): Promise<boolean> {
  return claimNonce({
    kind: KIND_SSO_TICKET,
    nonce,
    expiresAt: new Date(expSeconds * 1000),
  });
}

/** Claim an OAuth state nonce (single-use across all instances). */
export async function claimOAuthStateNonce(
  nonce: string,
  expSeconds: number,
): Promise<boolean> {
  return claimNonce({
    kind: KIND_OAUTH_STATE,
    nonce,
    expiresAt: new Date(expSeconds * 1000),
  });
}
