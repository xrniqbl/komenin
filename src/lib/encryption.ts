import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Envelope format: `v1:iv:tag:ciphertext` (hex parts).
 *
 * Rotation: encrypt with ENCRYPTION_KEY; decrypt accepts ENCRYPTION_KEY and
 * (during rotation) ENCRYPTION_KEY_PREVIOUS. Rotate by (1) setting
 * ENCRYPTION_KEY_PREVIOUS to the old key, (2) deploying, (3) running
 * `npm run secrets:re-encrypt` (scripts/re-encrypt-secrets.mjs) to re-wrap
 * every encrypted column with the new key, (4) removing PREVIOUS and
 * redeploying. Never rotate without the re-encrypt step on a DB that still
 * holds old blobs.
 */

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters");
  }
  return Buffer.from(hex, "hex");
}

function getPreviousKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY_PREVIOUS?.trim();
  if (!hex) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("ENCRYPTION_KEY_PREVIOUS must be 64 hex characters");
  }
  return Buffer.from(hex, "hex");
}

/** True when a rotation is staged (dual-decrypt active). For gates/scripts. */
export function isEncryptionRotationStaged(): boolean {
  return getPreviousKey() !== null;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivHex, tagHex, dataHex] = payload.split(":");
  if (version !== "v1" || !ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid encrypted payload");
  }
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  // Pin IV (96-bit) and auth tag (128-bit) lengths. Node's GCM otherwise accepts
  // short tags, which weakens forgery resistance for any attacker-supplied blob.
  if (iv.length !== 12) throw new Error("Invalid encrypted payload");
  if (tag.length !== 16) throw new Error("Invalid encrypted payload");
  const keys = [getKey(), getPreviousKey()].filter(
    (key): key is Buffer => key !== null,
  );
  let lastError: unknown = null;
  for (const key of keys) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv, {
        authTagLength: 16,
      });
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(dataHex, "hex")),
        decipher.final(),
      ]);
      return plaintext.toString("utf8");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Invalid encrypted payload");
}
