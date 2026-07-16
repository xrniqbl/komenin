import {
  parseConnectorPolicy,
  runConnectorAction,
  type ConnectorOfficialConfig,
  type ConnectorPolicy,
  type ConnectorWebhookConfig,
  type PublishPayload as ConnectorPublishPayload,
} from "@/lib/connectors";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";

export type PublishTarget = {
  platform: "instagram" | "threads" | "tiktok" | string;
  username?: string | null;
  accountId?: string | null;
};

export type PublishPayload = {
  title?: string | null;
  body: string;
  hashtags?: string[];
  scheduledFor?: Date | null;
};

export type PublishResult = {
  ok: boolean;
  mode: "simulator" | "live";
  connector: "simulator" | "webhook" | "official" | "live_webhook" | "live_stub" | "none";
  externalPostId?: string;
  publishedAt: Date;
  message: string;
  details?: Record<string, unknown>;
};

export function getDefaultWebhookConfig(): ConnectorWebhookConfig | null {
  const url = process.env.SOCIAL_PUBLISH_WEBHOOK_URL?.trim();
  if (!url) return null;
  return {
    url,
    token: process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim() || null,
  };
}

export function getDefaultOfficialConfig(
  platform?: string,
): ConnectorOfficialConfig | null {
  const token =
    process.env.SOCIAL_OFFICIAL_API_TOKEN?.trim() ||
    process.env.INSTAGRAM_ACCESS_TOKEN?.trim() ||
    process.env.THREADS_ACCESS_TOKEN?.trim() ||
    process.env.TIKTOK_ACCESS_TOKEN?.trim() ||
    "";
  if (!token) return null;
  return {
    provider: platform || "instagram",
    accessToken: token,
    apiBaseUrl:
      process.env.SOCIAL_OFFICIAL_API_BASE_URL?.trim() ||
      process.env.INSTAGRAM_API_BASE_URL?.trim() ||
      process.env.THREADS_API_BASE_URL?.trim() ||
      process.env.TIKTOK_API_BASE_URL?.trim() ||
      null,
  };
}

export function getDefaultConnectorPolicy(
  override?: string | null,
): ConnectorPolicy {
  return parseConnectorPolicy(
    override || process.env.SOCIAL_CONNECTOR_POLICY || "prefer_webhook",
  );
}

/**
 * Social publish connector via hybrid router.
 * - simulator: always succeeds and records a fake external id
 * - live: webhook and/or official adapters, else fail closed
 */
export async function publishSocialPost(input: {
  target: PublishTarget;
  payload: PublishPayload;
  forceMode?: "simulator" | "live";
  policy?: ConnectorPolicy | string | null;
  webhook?: ConnectorWebhookConfig | null;
  official?: ConnectorOfficialConfig | null;
}): Promise<PublishResult> {
  const mode = input.forceMode || getRuntimeModeLabel();
  const publishedAt = new Date();
  const result = await runConnectorAction({
    action: "publishPost",
    runtimeMode: mode,
    policy: getDefaultConnectorPolicy(input.policy),
    target: {
      platform: input.target.platform,
      username: input.target.username,
      accountId: input.target.accountId,
    },
    payload: input.payload as ConnectorPublishPayload,
    webhook: input.webhook === undefined ? getDefaultWebhookConfig() : input.webhook,
    official:
      input.official === undefined
        ? getDefaultOfficialConfig(input.target.platform)
        : input.official,
  });

  return {
    ok: result.ok,
    mode: result.mode,
    connector:
      result.connector === "webhook"
        ? "live_webhook"
        : result.connector === "official"
          ? "official"
          : result.connector === "simulator"
            ? "simulator"
            : "live_stub",
    externalPostId: result.externalId,
    publishedAt,
    message: result.message,
    details: result.details,
  };
}

