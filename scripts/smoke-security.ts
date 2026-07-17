/**
 * Production/staging smoke checks for critical security gates.
 * Usage: npx tsx scripts/smoke-security.ts
 */
import { evaluateProductionGate } from "../src/lib/production-gate";
import { getEnv } from "../src/lib/env";
import { isProductionRuntime } from "../src/lib/security";

function line(ok: boolean, msg: string) {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${msg}`);
}

async function main() {
  let failed = 0;
  try {
    const env = getEnv();
    line(Boolean(env.DATABASE_URL), "DATABASE_URL configured");
    line(Boolean(env.AUTH_SECRET && env.AUTH_SECRET.length >= 16), "AUTH_SECRET configured");
    line(Boolean(env.ENCRYPTION_KEY), "ENCRYPTION_KEY configured");
    line(Boolean(env.WORKER_SECRET), "WORKER_SECRET configured");

    if (isProductionRuntime()) {
      const gate = evaluateProductionGate();
      for (const err of gate.errors) {
        line(false, err);
        failed += 1;
      }
      for (const warn of gate.warnings) {
        console.log(`[WARN] ${warn}`);
      }
      line(gate.ok, "Production gate");
      if (!gate.ok) failed += 1;
    } else {
      console.log("[INFO] Not production runtime; gate warnings only");
      const gate = evaluateProductionGate();
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
      if (hasWebhook) {
        line(
          Boolean(process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim()),
          "Webhook token configured",
        );
        if (!process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim()) failed += 1;
      }
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