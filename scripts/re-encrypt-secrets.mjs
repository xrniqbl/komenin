#!/usr/bin/env node
/**
 * Re-encrypt every ENCRYPTION_KEY-wrapped column with the CURRENT key.
 *
 * Rotation runbook:
 *   1. Set ENCRYPTION_KEY_PREVIOUS to the old key, ENCRYPTION_KEY to the new key.
 *   2. Deploy (decryptSecret dual-decrypts, encryptSecret uses the new key).
 *   3. Run: node scripts/re-encrypt-secrets.mjs   (needs DIRECT_DATABASE_URL or DATABASE_URL)
 *   4. Remove ENCRYPTION_KEY_PREVIOUS, redeploy.
 *
 * Dry run: node scripts/re-encrypt-secrets.mjs --dry-run
 * Without ENCRYPTION_KEY_PREVIOUS this is a no-op verifier: it decrypts every
 * row to prove the current key reads the whole table, but rewrites nothing.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const DRY_RUN = process.argv.includes("--dry-run");

function keyFromEnv(name, { required = true } = {}) {
  const hex = process.env[name]?.trim();
  if (!hex) {
    if (!required) return null;
    throw new Error(`${name} is required`);
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error(`${name} must be 64 hex characters`);
  return Buffer.from(hex, "hex");
}

function decryptWith(payload, key) {
  const [version, ivHex, tagHex, dataHex] = String(payload).split(":");
  if (version !== "v1" || !ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted payload");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}

function encryptWith(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}

// model -> client delegate -> encrypted string columns
const TARGETS = [
  { model: "user", columns: ["totpSecretEnc"] },
  { model: "proxyEndpoint", columns: ["usernameEnc", "passwordEnc"] },
  { model: "webhookEndpoint", columns: ["secretEnc"] },
  { model: "connectorCredential", columns: ["accessTokenEnc", "refreshTokenEnc"] },
];

const prisma = new PrismaClient();

async function main() {
  const current = keyFromEnv("ENCRYPTION_KEY");
  const previous = keyFromEnv("ENCRYPTION_KEY_PREVIOUS", { required: false });
  const keys = [current, previous].filter(Boolean);
  console.log(
    previous
      ? "Rotation staged: dual-decrypt ON, re-wrapping rows with the new key."
      : "No ENCRYPTION_KEY_PREVIOUS: verify-only mode (decrypt check, no rewrites).",
  );
  if (DRY_RUN) console.log("Dry run: no writes will be performed.");

  let checked = 0;
  let rewrapped = 0;
  const failures = [];

  for (const { model, columns } of TARGETS) {
    const delegate = prisma[model];
    if (!delegate) {
      console.log(`(skip) model ${model} not in Prisma client`);
      continue;
    }
    const where = { OR: columns.map((c) => ({ [c]: { not: null } })) };
    const rows = await delegate.findMany({ where });
    for (const row of rows) {
      for (const column of columns) {
        const blob = row[column];
        if (!blob) continue;
        checked += 1;
        let plaintext = null;
        let usedPrevious = false;
        for (const [i, key] of keys.entries()) {
          try {
            plaintext = decryptWith(blob, key);
            usedPrevious = i === 1;
            break;
          } catch {
            // try next key
          }
        }
        if (plaintext === null) {
          failures.push(`${model}:${row.id}:${column} unreadable with staged keys`);
          continue;
        }
        if (previous && usedPrevious && !DRY_RUN) {
          await delegate.update({
            where: { id: row.id },
            data: { [column]: encryptWith(plaintext, current) },
          });
          rewrapped += 1;
        }
      }
    }
    console.log(`model ${model}: scanned ${rows.length} row(s)`);
  }

  console.log(`checked blobs: ${checked}, rewrapped: ${rewrapped}, failures: ${failures.length}`);
  for (const failure of failures.slice(0, 20)) console.log(`  FAIL ${failure}`);
  await prisma.$disconnect();
  if (failures.length > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error?.message || error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
