"use server";

import { auth, unstable_update } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { writeAuditLog } from "@/server/audit";

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
    data: { totpSecretEnc: encryptSecret(secret), totpEnabledAt: null },
  });

  return {
    secret,
    otpauthUri: otpauthUri({ secret, email: session.user.email }),
  };
}

/** Verify a code against the pending secret and activate 2FA. */
export async function confirmTotpEnrollment(code: string): Promise<{ ok: boolean }> {
  const session = await requireUser();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecretEnc: true },
  });
  if (!user?.totpSecretEnc) throw new Error("Missing pending TOTP enrollment");
  if (!verifyTotp(decryptSecret(user.totpSecretEnc), code)) {
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
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecretEnc: true, totpEnabledAt: true },
  });
  if (!user?.totpEnabledAt || !user.totpSecretEnc) {
    throw new Error("Missing active TOTP enrollment");
  }
  if (!verifyTotp(decryptSecret(user.totpSecretEnc), code)) {
    return { ok: false };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { totpSecretEnc: null, totpEnabledAt: null },
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

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecretEnc: true, totpEnabledAt: true },
  });
  if (!user?.totpEnabledAt || !user.totpSecretEnc) {
    // 2FA was disabled mid-session — clear the gate instead of locking out.
    await unstable_update({ user: { totpGate: false } }).catch(() => {});
    return { ok: true };
  }
  if (!verifyTotp(decryptSecret(user.totpSecretEnc), code)) {
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
