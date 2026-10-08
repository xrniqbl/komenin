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

  // External schedulers authenticate scheduled /api/worker/cron requests with
  // either CRON_SECRET (Authorization: Bearer) or WORKER_SECRET (Bearer or
  // x-worker-secret). At least one of them is required in production.
  if (!env.CRON_SECRET && !env.WORKER_SECRET) {
    errors.push("CRON_SECRET or WORKER_SECRET is required for scheduled worker auth");
  } else if (!env.CRON_SECRET) {
    warnings.push(
      "CRON_SECRET is unset — schedulers sending Authorization: Bearer $CRON_SECRET will fail; WORKER_SECRET can still drive the endpoint",
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
    errors.push(
      "AUTH_URL and APP_URL differ — Auth.js no longer trusts the Host header in production, so OAuth callbacks must share one canonical origin",
    );
  }
  if (!process.env.AUTH_URL?.trim() || !process.env.APP_URL?.trim()) {
    errors.push("AUTH_URL and APP_URL are both required in production (canonical OAuth origin)");
  }

  // SSO/SAML is not production-ready (signature validation unimplemented, ACS
  // returns 501). A single stray flag would otherwise silently change login
  // behaviour or imply enterprise SSO that does not exist.
  if (process.env.SSO_ENFORCE_LOGIN === "true") {
    errors.push(
      "SSO_ENFORCE_LOGIN=true is not allowed in production — SAML ACS returns 501 until XML signature validation ships",
    );
  }
  if (process.env.SAML_ALLOW_UNSIGNED === "true") {
    errors.push("SAML_ALLOW_UNSIGNED=true is never allowed in production");
  }
  if (process.env.ALLOW_SECURITY_STUBS === "true") {
    errors.push("ALLOW_SECURITY_STUBS=true is never allowed in production");
  }

  // Neon pooler guidance: Prisma migrations through PgBouncer strand the
  // advisory lock (P1002), so DIRECT_DATABASE_URL must be the direct endpoint.
  const directUrl = process.env.DIRECT_DATABASE_URL || "";
  if (!directUrl.trim()) {
    errors.push("DIRECT_DATABASE_URL is required in production (direct non-pooler endpoint for migrations)");
  } else if (/-pooler[.-]/.test(directUrl)) {
    errors.push(
      "DIRECT_DATABASE_URL looks like a -pooler endpoint — use the direct (non-pooler) endpoint for migrations",
    );
  }
  const pooledUrl = process.env.DATABASE_URL || "";
  // Neon/Vercel: pooler vs direct must differ (PgBouncer strands the advisory
  // lock P1002). Self-hosted Docker Postgres (@db, no pooler in either URL) has
  // no PgBouncer in the path, so identical URLs are safe there.
  if (
    directUrl.trim() &&
    pooledUrl.trim() &&
    directUrl.trim() === pooledUrl.trim() &&
    /-pooler[.-]/.test(pooledUrl)
  ) {
    errors.push(
      "DIRECT_DATABASE_URL must differ from DATABASE_URL on a pooled endpoint — migrations through PgBouncer can strand the advisory lock (P1002)",
    );
  }
  if (/-pooler[.-]/.test(pooledUrl) && !/[?&]connection_limit=\d+/.test(pooledUrl)) {
    warnings.push(
      "DATABASE_URL looks like a Neon pooler endpoint without connection_limit — append ?connection_limit=5&pool_timeout=20 to stay under the compute's max connections",
    );
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
  // Database backups: an unencrypted dump is a full plaintext copy of every
  // secret in the DB (session cookies, OAuth tokens, TOTP seeds). The dismiss
  // path is a conscious "we keep plaintext backups" decision, not an omission.
  if (!process.env.BACKUP_ENCRYPTION_KEY?.trim()) {
    // Conscious opt-out: BACKUP_PLAINTEXT_OK=true means the operator knowingly
    // accepts plaintext backups — warn only on a genuine omission.
    if (process.env.BACKUP_PLAINTEXT_OK?.trim().toLowerCase() !== "true") {
      warnings.push(
        "BACKUP_ENCRYPTION_KEY is unset — database backups are stored unencrypted (set it to AES-256-encrypt dumps, or set BACKUP_PLAINTEXT_OK=true to acknowledge plaintext backups)",
      );
    }
  } else if (!/^[0-9a-fA-F]{64}$/.test(process.env.BACKUP_ENCRYPTION_KEY.trim())) {
    errors.push("BACKUP_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)");
  }
  if (isEncryptionRotationStaged()) {
    warnings.push(
      "ENCRYPTION_KEY_PREVIOUS is staged — finish rotation with scripts/re-encrypt-secrets.mjs, then remove it and redeploy",
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}
