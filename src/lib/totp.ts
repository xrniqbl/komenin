import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 TOTP (SHA-1, 30s step, 6 digits) with zero dependencies.
 * Compatible with Google Authenticator, Authy, 1Password, and any RFC 6238 app.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 (no padding) — the format authenticator apps expect. */
export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160-bit secret (20 bytes) — the RFC 4226 recommended length. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAt(
  secretBase32: string,
  timestampMs: number = Date.now(),
  options: { stepSeconds?: number; digits?: number } = {},
): string {
  const step = options.stepSeconds ?? 30;
  const digits = options.digits ?? 6;
  // Clamp at 0 — writeUInt32BE rejects negative, and pre-epoch counters are meaningless.
  const counter = Math.max(0, Math.floor(timestampMs / 1000 / step));
  const key = base32Decode(secretBase32);
  const message = Buffer.alloc(8);
  message.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  message.writeUInt32BE(counter % 2 ** 32, 4);
  const digest = createHmac("sha1", key).update(message).digest();
  // Dynamic truncation (RFC 4226 §5.3)
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/**
 * Verify a 6-digit code allowing ±1 time step of clock drift (±30s).
 * Comparison is timing-safe; input is normalized (spaces, non-digits).
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  options: { window?: number; timestampMs?: number; stepSeconds?: number } = {},
): boolean {
  const normalized = String(code || "").replace(/\D/g, "");
  if (normalized.length !== 6) return false;
  const step = options.stepSeconds ?? 30;
  const window = options.window ?? 1;
  const now = options.timestampMs ?? Date.now();
  const expected = Buffer.from(normalized, "utf8");
  for (let drift = -window; drift <= window; drift += 1) {
    const candidate = totpAt(secretBase32, now + drift * step * 1000, {
      stepSeconds: step,
    });
    if (candidate.length === expected.length && timingSafeEqual(Buffer.from(candidate, "utf8"), expected)) {
      return true;
    }
  }
  return false;
}

export function otpauthUri(input: {
  secret: string;
  email: string;
  issuer?: string;
}): string {
  const issuer = input.issuer?.trim() || "Komenin";
  const label = encodeURIComponent(`${issuer}:${input.email}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
