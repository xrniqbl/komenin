export function getRuntimeModeLabel(): "simulator" | "live" {
  const raw = process.env.SIMULATOR_MODE;
  if (raw === "false") return "live";
  return "simulator";
}

export function describeSendResult(mode: "simulator" | "live" = getRuntimeModeLabel()): string {
  return mode === "simulator"
    ? "Comment sent via managed session worker (simulator mode)"
    : "Comment send accepted by live connector";
}

export type LiveReadiness = {
  mode: "simulator" | "live";
  ready: boolean;
  blockers: string[];
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

/**
 * Operator-facing readiness for live social actions.
 * Distinct from production-gate (deploy hard-fail): this is advisory UI truth.
 */
export function evaluateLiveReadiness(): LiveReadiness {
  const mode = getRuntimeModeLabel();
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (mode === "simulator") {
    warnings.push("SIMULATOR_MODE is on — outbound comments/posts are simulated, not delivered to platforms.");
    return { mode, ready: false, blockers, warnings };
  }

  const webhookUrl = process.env.SOCIAL_PUBLISH_WEBHOOK_URL?.trim();
  const webhookToken = process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim();
  const policy = (process.env.SOCIAL_CONNECTOR_POLICY || "prefer_webhook").trim();
  const hasOfficialEnv = Boolean(
    process.env.SOCIAL_OFFICIAL_API_BASE_URL?.trim() ||
      process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ||
      process.env.THREADS_ACCESS_TOKEN?.trim() ||
      process.env.TIKTOK_ACCESS_TOKEN?.trim() ||
      process.env.SOCIAL_OFFICIAL_API_TOKEN?.trim(),
  );

  if (!webhookUrl && !hasOfficialEnv) {
    blockers.push(
      "No live connector configured (set an external SOCIAL_PUBLISH_WEBHOOK_URL or official API tokens / OAuth vault).",
    );
  }
  if (webhookUrl && !webhookToken) {
    blockers.push("SOCIAL_PUBLISH_WEBHOOK_TOKEN is required when using the publish webhook.");
  }
  if (webhookUrl && isSelfHostedPublishWebhook(webhookUrl, process.env.APP_URL)) {
    blockers.push(
      "SOCIAL_PUBLISH_WEBHOOK_URL points at this app's own /api/publish/webhook — that only logs deliveries, it does not post to Instagram/Threads/TikTok.",
    );
  }
  if (policy === "simulator_only") {
    blockers.push("SOCIAL_CONNECTOR_POLICY=simulator_only forces simulator even when SIMULATOR_MODE=false.");
  }
  if (policy === "official_only" && !hasOfficialEnv) {
    warnings.push("official_only policy set but no official API base URL / access tokens are configured.");
  }
  // Mention auto-reply ingestion readiness (F2): the webhook receiver fails
  // closed without a platform app secret, so without one (and without official
  // tokens for polling fallback) incoming mentions can never arrive.
  const hasMentionIngestPath = Boolean(
    process.env.INSTAGRAM_APP_SECRET?.trim() ||
      process.env.THREADS_APP_SECRET?.trim() ||
      process.env.TIKTOK_CLIENT_SECRET?.trim() ||
      process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ||
      process.env.THREADS_ACCESS_TOKEN?.trim() ||
      process.env.TIKTOK_ACCESS_TOKEN?.trim(),
  );
  if (!hasMentionIngestPath) {
    warnings.push(
      "No mention ingest path: set a platform app secret (INSTAGRAM_APP_SECRET / THREADS_APP_SECRET / TIKTOK_CLIENT_SECRET) for webhooks or official tokens for polling — otherwise incoming mentions never reach /app/mentions.",
    );
  }
  if (
    !process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim() &&
    (process.env.INSTAGRAM_APP_SECRET?.trim() ||
      process.env.THREADS_APP_SECRET?.trim())
  ) {
    warnings.push(
      "INSTAGRAM_WEBHOOK_VERIFY_TOKEN is empty — the Meta subscription handshake accepts any hub.verify_token.",
    );
  }
  if (!process.env.WORKER_SECRET?.trim()) {
    warnings.push("WORKER_SECRET is empty — worker tick endpoints are unprotected.");
  }
  if (!process.env.CRON_SECRET?.trim()) {
    warnings.push("CRON_SECRET is empty — scheduled requests using Authorization bearer will not authenticate.");
  }

  return {
    mode,
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}