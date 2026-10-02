import { getEnv } from "@/lib/env";
import { isEncryptionRotationStaged } from "@/lib/encryption";
import { isProductionRuntime } from "@/lib/security";

export type ProductionGateResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function isSelfHostedPublishWebhook(webhookUrl: string, appUrl?: string): boolean {
  try {
    const webhook = new URL(webhookUrl);
    const path = webhook.pathname.replace(/\/$/, "");
    if (path !== "/api/publish/webhook") return false;
    if (!appUrl) return true;
    const app = new URL(appUrl);
    return webhook.host === app.host;
  } catch {
    return false;
  }
}

export function evaluateProductionGate(): ProductionGateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isProductionRuntime()) {
    return { ok: true, errors, warnings: ["Not running in production runtime"] };
  }

  const env = getEnv();
  const policy = (process.env.SOCIAL_CONNECTOR_POLICY || "prefer_webhook").trim();
  const live = process.env.SIMULATOR_MODE === "false";
  const hasOfficial =
    Boolean(process.env.SOCIAL_OFFICIAL_API_TOKEN?.trim()) ||
    Boolean(process.env.INSTAGRAM_ACCESS_TOKEN?.trim()) ||
    Boolean(process.env.THREADS_ACCESS_TOKEN?.trim()) ||
    Boolean(process.env.TIKTOK_ACCESS_TOKEN?.trim()) ||
    Boolean(process.env.SOCIAL_OFFICIAL_API_BASE_URL?.trim());

  // Fail closed: simulator must not run as production.
  if (env.SIMULATOR_MODE) {
    errors.push("SIMULATOR_MODE=true is not allowed in production runtime");
  }

  if (!env.WORKER_SECRET) {
    errors.push("WORKER_SECRET is required");
  }

  const authSecret = process.env.AUTH_SECRET || "";
  if (authSecret.includes("placeholder")) {
    errors.push(
      "AUTH_SECRET is still a build-time placeholder — set a real secret before running in production",
    );
  }

  // Vercel Cron needs CRON_SECRET. External schedulers can use WORKER_SECRET.
  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    if (!env.CRON_SECRET) {
      errors.push(
        "CRON_SECRET is required on Vercel so scheduled /api/worker/cron requests authenticate",
      );
    }
  } else if (!env.CRON_SECRET && !env.WORKER_SECRET) {
    errors.push("CRON_SECRET or WORKER_SECRET is required for scheduled worker auth");
  } else if (!env.CRON_SECRET) {
    warnings.push(
      "CRON_SECRET is unset — Vercel Cron Authorization: Bearer $CRON_SECRET will fail; WORKER_SECRET can still drive the endpoint",
    );
  }

  if (live) {
    const webhookUrl = process.env.SOCIAL_PUBLISH_WEBHOOK_URL?.trim();
    const webhookToken = process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim();
    const usesWebhook =
      policy === "prefer_webhook" ||
      policy === "webhook_only" ||
      policy === "prefer_official" ||
      !policy;

    if (policy === "official_only") {
      if (!hasOfficial) {
        warnings.push(
          "SOCIAL_CONNECTOR_POLICY=official_only but no official API tokens/base URL are configured (workspace OAuth vault may still work per account)",
        );
      }
    } else if (usesWebhook) {
      if (!webhookToken) {
        errors.push(
          "SOCIAL_PUBLISH_WEBHOOK_TOKEN is required when SIMULATOR_MODE=false and connector policy uses the webhook bridge",
        );
      }
      if (!webhookUrl) {
        errors.push(
          "SOCIAL_PUBLISH_WEBHOOK_URL is required when SIMULATOR_MODE=false and connector policy uses the webhook bridge",
        );
      }
    }

    if (webhookUrl && isSelfHostedPublishWebhook(webhookUrl, process.env.APP_URL)) {
      errors.push(
        "SOCIAL_PUBLISH_WEBHOOK_URL points at this app's /api/publish/webhook — that only logs deliveries and does not post to social networks. Point it at an external bridge.",
      );
    }
  }

  if (process.env.MIDTRANS_IS_PRODUCTION === "true") {
    if (!process.env.MIDTRANS_SERVER_KEY?.trim()) {
      errors.push("MIDTRANS_SERVER_KEY required when MIDTRANS_IS_PRODUCTION=true");
    }
    if (!process.env.MIDTRANS_CLIENT_KEY?.trim()) {
      errors.push("MIDTRANS_CLIENT_KEY required when MIDTRANS_IS_PRODUCTION=true");
    }
  }

  if (process.env.AUTH_URL && process.env.APP_URL && process.env.AUTH_URL !== process.env.APP_URL) {
    warnings.push("AUTH_URL and APP_URL differ");
  }

  if (!process.env.OAUTH_STATE_SECRET?.trim()) {
    errors.push(
      "OAUTH_STATE_SECRET is required in production (OAuth state has no AUTH_SECRET fallback)",
    );
  }
  if (!process.env.SSO_TICKET_SECRET?.trim()) {
    errors.push(
      "SSO_TICKET_SECRET is required in production (SSO tickets have no AUTH_SECRET fallback)",
    );
  }
  if (!process.env.API_KEY_PEPPER?.trim()) {
    errors.push(
      "API_KEY_PEPPER is required in production (unpeppered key hashes are bare sha256)",
    );
  } else if (process.env.API_KEY_PEPPER.trim().length < 16) {
    errors.push("API_KEY_PEPPER must be ≥16 chars");
  }
  if (!process.env.UPSTASH_REDIS_REST_URL?.trim() || !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    errors.push(
      "UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are required in production (fail-closed auth rate limits deny traffic during a limiter outage)",
    );
  }
  if (isEncryptionRotationStaged()) {
    warnings.push(
      "ENCRYPTION_KEY_PREVIOUS is staged — finish rotation with scripts/re-encrypt-secrets.mjs, then remove it and redeploy",
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}
