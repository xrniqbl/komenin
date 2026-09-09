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
 * If the durable limiter errors, the per-instance memory fallback applies and
 * an error is logged for alerting (see consumeRateLimit).
 */
async function enforceTotpAttemptLimit(userId: string): Promise<void> {
  let ip = "unknown";
  try {
    const h = await headers();
    ip =
      h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("cf-connecting-ip")?.trim() ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
  } catch {
    // headers() unavailable (e.g. unusual runtime) — key on user only.
  }
  const result = await consumeRateLimit({
    key: `totp-verify:${userId}:${ip}`,
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
  // Make sure an in-flight gate flag never sticks once 2FA is confirmed.
  await unstable_update({ user: { totpGate: false } }).catch(() => {});
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
 * factor and clears the gate flag on the session.
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
    // 2FA was disabled mid-session — clear the gate instead of locking out.
    await unstable_update({ user: { totpGate: false } }).catch(() => {});
    return { ok: true };
  }
  if (!(await consumeTotpCode(session.user.id, user.totpSecretEnc, code))) {
    return { ok: false };
  }

  await unstable_update({ user: { totpGate: false } }).catch(() => {});
  await writeAuditLog({
    actorUserId: session.user.id,
    action: "user.totp.challenge_passed",
    resourceType: "user",
    resourceId: session.user.id,
  });
  return { ok: true };
}
