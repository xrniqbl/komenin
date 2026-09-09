#!/usr/bin/env node
/**
 * Rotate ENCRYPTION_KEY — decrypt every AES-256-GCM blob with the old key and
 * re-encrypt it with the new key, in one transaction per row.
 *
 * Usage (from the repo root or a release bundle):
 *   OLD_ENCRYPTION_KEY=<64-hex old> ENCRYPTION_KEY=<64-hex new> \
 *     node scripts/rotate-encryption-key.mjs [--dry-run]
 *
 *   --dry-run  decrypt-only pass: verifies the old key can read every blob
 *              without writing anything.
 *
 * Covered columns (everything encryptSecret()/decryptSecret() ever touches):
 *   User.totpSecretEnc
 *   AccountSession.encryptedBlob
 *   ProxyEndpoint.usernameEnc / passwordEnc
 *   WorkspaceAiProvider.apiKeyEnc
 *   WebhookEndpoint.secretEnc
 *   ConnectorCredential.accessTokenEnc / refreshTokenEnc
 *   ApiKey.apiKeyEnc
 *   Skill.configJson.tokenEnc (nested JSON field)
 *
 * Run while the app is STOPPED (or in maintenance) so rows are not rewritten
 * concurrently. Never prints plaintext or key material.
 */

import { readFileSync, existsSync } from "node:fs";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// ── env loading (same parser as preflight-deploy.mjs, zero deps) ──────────
function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[m[1]] = val;
  }
}
loadDotEnv(".env.local");
loadDotEnv(".env");

const OLD_KEY = process.env.OLD_ENCRYPTION_KEY?.trim() || "";
const NEW_KEY = process.env.ENCRYPTION_KEY?.trim() || "";
const DRY_RUN = process.argv.includes("--dry-run");

const HEX64 = /^[0-9a-fA-F]{64}$/;
if (!HEX64.test(OLD_KEY)) {
  console.error("✗ OLD_ENCRYPTION_KEY must be 64 hex characters");
  process.exit(1);
}
if (!HEX64.test(NEW_KEY)) {
  console.error("✗ ENCRYPTION_KEY (the NEW key) must be 64 hex characters");
  process.exit(1);
}
if (OLD_KEY === NEW_KEY) {
  console.error("✗ OLD_ENCRYPTION_KEY and ENCRYPTION_KEY must differ");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set");
  process.exit(1);
}

const oldKeyBuf = Buffer.from(OLD_KEY, "hex");
const newKeyBuf = Buffer.from(NEW_KEY, "hex");

function decryptWith(payload, keyBuf) {
  const [version, ivHex, tagHex, dataHex] = String(payload).split(":");
  if (version !== "v1" || !ivHex || !tagHex || !dataHex) {
    throw new Error("invalid payload envelope");
  }
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("invalid payload envelope");
  const decipher = createDecipheriv("aes-256-gcm", keyBuf, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptWith(plaintext, keyBuf) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuf, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

function rotateBlob(payload) {
  const plaintext = decryptWith(payload, oldKeyBuf);
  return encryptWith(plaintext, newKeyBuf);
}

/** Re-encrypt `tokenEnc` inside a webhook-skill configJson blob. */
function rotateSkillConfig(json) {
  if (!json || typeof json !== "object") return null;
  const tokenEnc = json.tokenEnc;
  if (typeof tokenEnc !== "string" || !tokenEnc.startsWith("v1:")) return null;
  return { ...json, tokenEnc: rotateBlob(tokenEnc) };
}

// ── targets: [label, prisma delegate, field(s)] ────────────────────────────
const STRING_TARGETS = [
  ["User.totpSecretEnc", "user", "totpSecretEnc"],
  ["AccountSession.encryptedBlob", "accountSession", "encryptedBlob"],
  ["ProxyEndpoint.usernameEnc", "proxyEndpoint", "usernameEnc"],
  ["ProxyEndpoint.passwordEnc", "proxyEndpoint", "passwordEnc"],
  ["WorkspaceAiProvider.apiKeyEnc", "workspaceAiProvider", "apiKeyEnc"],
  ["WebhookEndpoint.secretEnc", "webhookEndpoint", "secretEnc"],
  ["ConnectorCredential.accessTokenEnc", "connectorCredential", "accessTokenEnc"],
  ["ConnectorCredential.refreshTokenEnc", "connectorCredential", "refreshTokenEnc"],
  ["ApiKey.apiKeyEnc", "apiKey", "apiKeyEnc"],
];

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  let rotated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (const [label, delegate, field] of STRING_TARGETS) {
      const rows = await db[delegate].findMany({
        where: { [field]: { not: null } },
        select: { id: true, [field]: true },
      });
      for (const row of rows) {
        const payload = row[field];
        if (!payload) {
          skipped += 1;
          continue;
        }
        try {
          // Verify the old key can read it BEFORE any write.
          decryptWith(payload, oldKeyBuf);
        } catch {
          failed += 1;
          console.error(`✗ ${label} id=${row.id}: old key cannot decrypt (skipped)`);
          continue;
        }
        if (DRY_RUN) {
          rotated += 1;
          continue;
        }
        try {
          await db[delegate].update({
            where: { id: row.id },
            data: { [field]: rotateBlob(payload) },
          });
          rotated += 1;
        } catch (error) {
          failed += 1;
          console.error(
            `✗ ${label} id=${row.id}: re-encrypt failed: ${error?.message || error}`,
          );
        }
      }
      const n = rows.length;
      console.log(`· ${label}: ${n} row(s) scanned`);
    }

    // Skill.configJson.tokenEnc (nested)
    const skills = await db.skill.findMany({
      where: { executor: "webhook" },
      select: { id: true, configJson: true },
    });
    for (const skill of skills) {
      const next = rotateSkillConfig(skill.configJson);
      if (!next) {
        skipped += 1;
        continue;
      }
      try {
        decryptWith(skill.configJson.tokenEnc, oldKeyBuf);
      } catch {
        failed += 1;
        console.error(`✗ Skill.configJson id=${skill.id}: old key cannot decrypt`);
        continue;
      }
      if (DRY_RUN) {
        rotated += 1;
        continue;
      }
      await db.skill.update({
        where: { id: skill.id },
        data: { configJson: next },
      });
      rotated += 1;
    }
    console.log(`· Skill.configJson.tokenEnc: ${skills.length} row(s) scanned`);

    console.log(
      `\n${DRY_RUN ? "DRY RUN" : "DONE"}: rotated=${rotated} skipped=${skipped} failed=${failed}`,
    );
    if (failed > 0) {
      console.error(
        "✗ Some blobs failed rotation. Fix and re-run before switching the runtime key.",
      );
      process.exit(3);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("✗ rotation aborted:", error?.message || error);
  process.exit(1);
});
