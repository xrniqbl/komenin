"use server";

import { headers } from "next/headers";

import { auth, unstable_update } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { consumeRateLimit } from "@/lib/rate-limit";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { writeAuditLog } from "@/server/audit";

/**
 * Brute-force brake for every TOTP verify path. These are server actions, so
 * the /api/auth/* route limit never applies — without this, a 6-digit code
 * with a ±1 window has ~300 valid candidates and online guessing is feasible.
 *
 * Server actions cannot trust client-controlled proxy headers, so the key is
 * anchored on the user id. The raw IP chain is appended as a secondary suffix
 * (best-effort, never trusted): it spreads the budget across NATs without
 * letting X-Forwarded-For spoofing reset it, because the userId prefix alone
 * already enforces the 5/5min cap per account.
 */
async function enforceTotpAttemptLimit(userId: string): Promise<void> {
  let ipSuffix = "unknown";
  try {
    const h = await headers();
    const chain = [
      h.get("x-vercel-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
      h.get("cf-connecting-ip") ? [h.get("cf-connecting-ip")!.trim()] : [],
      h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
    ].flat();
    // Prefer the right-most (last-proxy-added) hop; attacker-controlled
    // left-most entries are never used alone.
    ipSuffix = chain.length > 0 ? chain[chain.length - 1] : "unknown";
  } catch {
    // headers() unavailable (e.g. unusual runtime) — key on user only.
  }
  const result = await consumeRateLimit({
    key: `totp-verify:${userId}:${ipSuffix}`,
    limit: 5,
    windowMs: 5 * 60_000,
    failClosed: true,
  });
  if (!result.ok) {
    throw new Error("Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi.");
  }
}

/**
 * Consume a code atomically: verify it AND record its counter step in one
 * guarded update, so two concurrent verifies cannot both burn the same code.
 * Returns false when the code is wrong OR was already used (step ≤ lastUsed).
 */
async function consumeTotpCode(
  userId: string,
  secretEnc: string,
  code: string,
): Promise<boolean> {
  const step = verifyTotp(decryptSecret(secretEnc), code);
  if (step === null) return false;
  const claimed = await db.user.updateMany({
    where: {
      id: userId,
      OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: step } }],
    },
    data: { totpLastUsedStep: step },
  });
  return claimed.count === 1;
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

export async function getTotpStatus(): Promise<{
  enabled: boolean;
  pending: boolean;
}> {
  const session = await requireUser();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabledAt: true, totpSecretEnc: true },
  });
  return {
    enabled: Boolean(user?.totpEnabledAt),
    pending: Boolean(user?.totpSecretEnc && !user?.totpEnabledAt),
  };
}

/** Mint a new TOTP secret (encrypted at rest). Not active until confirmed. */
export async function startTotpEnrollment(): Promise<{
  secret: string;
  otpauthUri: string;
}> {
  const session = await requireUser();
  if (!session.user.email) throw new Error("Missing user email");

  const secret = generateTotpSecret();
  await db.user.update({
    where: { id: session.user.id },
    // Fresh enrollment resets replay tracking together with the secret.
    data: { totpSecretEnc: encryptSecret(secret), totpEnabledAt: null, totpLastUsedStep: null },
  });

  return {
    secret,
    otpauthUri: otpauthUri({ secret, email: session.user.email }),
  };
}

/** Verify a code against the pending secret and activate 2FA. */
export async function confirmTotpEnrollment(code: string): Promise<{ ok: boolean }> {
  const session = await requireUser();
  await enforceTotpAttemptLimit(session.user.id);
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecretEnc: true },
  });
  if (!user?.totpSecretEnc) throw new Error("Missing pending TOTP enrollment");
  if (!(await consumeTotpCode(session.user.id, user.totpSecretEnc, code))) {
    return { ok: false };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { totpEnabledAt: new Date() },
  });
  await writeAuditLog({
    actorUserId: session.user.id,
    action: "user.totp.enabled",
    resourceType: "user",
    resourceId: session.user.id,
  });
  // Privilege change: rotate every other device session so a stolen token
  // cannot ride through 2FA enrollment. The current device (jti) keeps its
  // session; the poll revokes the rest within ~60s.
  await db.loginSession.updateMany({
    where: { userId: session.user.id, revokedAt: null, jti: { not: session.currentJti ?? "__none__" } },
    data: { revokedAt: new Date() },
  });
  // Server-side gate clearance (H1): stamp THIS device session so the jwt
  // callback re-opens the gate from the DB row, not from a client value.
  // The following unstable_update only forces a session refresh — the jwt
  // callback ignores its payload and re-reads the stamp.
  if (session.currentJti) {
    await db.loginSession
      .update({
        where: { jti: session.currentJti },
        data: { totpVerifiedAt: new Date() },
      })
      .catch(() => {});
  }
  // Make sure an in-flight gate flag never sticks once 2FA is confirmed.
  await unstable_update({}).catch(() => {});
  return { ok: true };
}

/** Disable 2FA — requires a valid current code (possession proof). */
export async function disableTotp(code: string): Promise<{ ok: boolean }> {
  const session = await requireUser();
  await enforceTotpAttemptLimit(session.user.id);
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecretEnc: true, totpEnabledAt: true },
  });
  if (!user?.totpEnabledAt || !user.totpSecretEnc) {
    throw new Error("Missing active TOTP enrollment");
  }
  if (!(await consumeTotpCode(session.user.id, user.totpSecretEnc, code))) {
    return { ok: false };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { totpSecretEnc: null, totpEnabledAt: null, totpLastUsedStep: null },
  });
  await writeAuditLog({
    actorUserId: session.user.id,
    action: "user.totp.disabled",
    resourceType: "user",
    resourceId: session.user.id,
  });
  return { ok: true };
}

/**
 * TOTP challenge used by /auth/totp-gate. Verifies possession of the second
 * factor and clears the gate server-side (H1: never from a client value).
 */
export async function verifyTotpGate(code: string): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  await enforceTotpAttemptLimit(session.user.id);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecretEnc: true, totpEnabledAt: true },
  });
  if (!user?.totpEnabledAt || !user.totpSecretEnc) {
    // 2FA was disabled mid-session — stamp the device row so the gate opens
    // from the DB (same path as a passed challenge) instead of locking out.
    if (session.currentJti) {
      await db.loginSession
        .update({
          where: { jti: session.currentJti },
          data: { totpVerifiedAt: new Date() },
        })
        .catch(() => {});
    }
    await unstable_update({}).catch(() => {});
    return { ok: true };
  }
  if (!(await consumeTotpCode(session.user.id, user.totpSecretEnc, code))) {
    return { ok: false };
  }

  // Stamp THIS device session; the jwt revocation poll re-opens the gate
  // from this row on the next request. unstable_update only refreshes the
  // session — its payload is ignored by the jwt callback.
  if (session.currentJti) {
    await db.loginSession
      .update({
        where: { jti: session.currentJti },
        data: { totpVerifiedAt: new Date() },
      })
      .catch(() => {});
  }
  await unstable_update({}).catch(() => {});
  await writeAuditLog({
    actorUserId: session.user.id,
    action: "user.totp.challenge_passed",
    resourceType: "user",
    resourceId: session.user.id,
  });
  return { ok: true };
}
