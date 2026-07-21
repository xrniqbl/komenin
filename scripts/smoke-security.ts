/**
 * Production/staging smoke checks for critical security gates.
 * Usage: npx tsx scripts/smoke-security.ts
 *
 * Loads .env then .env.local from cwd (does not override existing process env).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateProductionGate } from "../src/lib/production-gate";
import { getEnv } from "../src/lib/env";
import { isProductionRuntime } from "../src/lib/security";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadProjectEnv() {
  const root = process.cwd();
  // Base first, then local overrides for keys not already set.
  loadEnvFile(resolve(root, ".env"));
  loadEnvFile(resolve(root, ".env.local"));
}

function line(ok: boolean, msg: string) {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${msg}`);
}

function checkRequiredPresent(): string[] {
  const missing: string[] = [];
  const required = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "AUTH_GOOGLE_ID",
    "AUTH_GOOGLE_SECRET",
    "ENCRYPTION_KEY",
  ] as const;
  for (const key of required) {
    if (!process.env[key]?.trim()) missing.push(key);
  }
  return missing;
}

async function main() {
  loadProjectEnv();

  let failed = 0;
  try {
    const missing = checkRequiredPresent();
    if (missing.length > 0) {
      for (const key of missing) {
        line(false, `${key} missing (set in .env / .env.local or process env)`);
        failed += 1;
      }
      console.error(
        "\nHint: run from repo root so scripts/smoke-security.ts can load .env and .env.local",
      );
      console.error(`Smoke checks failed: ${failed}`);
      process.exit(1);
    }

    const env = getEnv();
    line(Boolean(env.DATABASE_URL), "DATABASE_URL configured");
    line(Boolean(env.AUTH_SECRET && env.AUTH_SECRET.length >= 16), "AUTH_SECRET configured");
    line(Boolean(env.ENCRYPTION_KEY), "ENCRYPTION_KEY configured");
    line(Boolean(env.WORKER_SECRET), "WORKER_SECRET configured");
    if (!env.WORKER_SECRET) failed += 1;

    const gate = evaluateProductionGate();
    if (isProductionRuntime()) {
      for (const err of gate.errors) {
        line(false, err);
        failed += 1;
      }
      for (const warn of gate.warnings) {
        console.log(`[WARN] ${warn}`);
      }
      line(gate.ok, "Production gate (fail-closed)");
      if (!gate.ok) failed += 1;
    } else {
      console.log("[INFO] Not production runtime; gate errors treated as info");
      for (const err of gate.errors) console.log(`[INFO] ${err}`);
      for (const warn of gate.warnings) console.log(`[WARN] ${warn}`);
    }

    if (process.env.SIMULATOR_MODE === "false") {
      const hasWebhook = Boolean(process.env.SOCIAL_PUBLISH_WEBHOOK_URL?.trim());
      const hasOfficial = Boolean(
        process.env.SOCIAL_OFFICIAL_API_TOKEN?.trim() ||
          process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ||
          process.env.THREADS_ACCESS_TOKEN?.trim() ||
          process.env.TIKTOK_ACCESS_TOKEN?.trim(),
      );
      const liveOk = hasWebhook || hasOfficial;
      line(liveOk, "Live connector configured (webhook or official)");
      if (!liveOk) failed += 1;
      line(
        Boolean(process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim()),
        "Publish webhook token configured",
      );
      if (!process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim()) failed += 1;
    }

    if (process.env.MIDTRANS_IS_PRODUCTION === "true") {
      line(Boolean(process.env.MIDTRANS_SERVER_KEY?.trim()), "Midtrans server key configured");
      line(Boolean(process.env.MIDTRANS_CLIENT_KEY?.trim()), "Midtrans client key configured");
      if (!process.env.MIDTRANS_SERVER_KEY?.trim()) failed += 1;
      if (!process.env.MIDTRANS_CLIENT_KEY?.trim()) failed += 1;
    }
  } catch (error) {
    failed += 1;
    line(false, error instanceof Error ? error.message : "Smoke check failed");
  }

  if (failed > 0) {
    console.error(`\nSmoke checks failed: ${failed}`);
    process.exit(1);
  }
  console.log("\nSmoke checks passed");
}

main();
