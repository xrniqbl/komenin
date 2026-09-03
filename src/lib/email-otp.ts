/**
 * Email one-time passcode (OTP) sign-in.
 *
 * Security model:
 * - 6-digit code, CSPRNG-generated.
 * - Stored HASHED (sha256(salt + ":" + code)) — a DB read never reveals codes.
 * - Single-use (consumedAt) and short-lived (default 10 minutes).
 * - Attempt-capped per code (default 5) to blunt brute force; the code is
 *   locked after the cap even if it hasn't expired.
 * - Issuing a new code invalidates prior unconsumed codes for that email.
 *
 * Verification is a constant-ish-time comparison via hash equality.
 */

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

function hashCode(salt: string, code: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Issue a new OTP for `email`, invalidating any prior unconsumed codes. */
export async function issueEmailOtp(email: string): Promise<{ code: string; expiresAt: Date }> {
  const normalized = normalizeEmail(email);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.$transaction(async (tx) => {
    // Invalidate previous unconsumed codes for this email.
    await tx.emailOtpToken.updateMany({
      where: { email: normalized, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.emailOtpToken.create({
      data: {
        email: normalized,
        codeHash: hashCode(salt, code),
        salt,
        expiresAt,
      },
    });
  });

  return { code, expiresAt };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "expired" | "locked" | "mismatch" };

/**
 * Verify an OTP. Consumes the code on success; increments the attempt counter
 * (and locks after MAX_ATTEMPTS) on mismatch. Always single-use.
 */
export async function verifyEmailOtp(email: string, code: string): Promise<VerifyOtpResult> {
  const normalized = normalizeEmail(email);
  const cleaned = code.replace(/\s+/g, "");

  const token = await db.emailOtpToken.findFirst({
    where: { email: normalized, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return { ok: false, reason: "not_found" };

  const now = new Date();
  if (token.expiresAt <= now) return { ok: false, reason: "expired" };
  if (token.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };

  const candidate = hashCode(token.salt, cleaned);
  const match =
    candidate.length === token.codeHash.length &&
    timingSafeEqual(Buffer.from(candidate), Buffer.from(token.codeHash));

  if (!match) {
    await db.emailOtpToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "mismatch" };
  }

  // Single-use: consume atomically so two concurrent verifies can't both pass.
  const consumed = await db.emailOtpToken.updateMany({
    where: { id: token.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count === 0) return { ok: false, reason: "mismatch" };

  return { ok: true };
}

/** For tests/introspection only. */
export const __otpInternals = { hashCode, MAX_ATTEMPTS, OTP_TTL_MS };
