import {
  parseConnectorPolicy,
  runConnectorAction,
  type ConnectorOfficialConfig,
  type ConnectorPolicy,
  type ConnectorWebhookConfig,
  type PublishPayload as ConnectorPublishPayload,
} from "@/lib/connectors";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/encryption";

export type PublishTarget = {
  platform: "instagram" | "threads" | "tiktok" | string;
  username?: string | null;
  accountId?: string | null;
  workspaceId?: string | null;
};

export type PublishPayload = {
  title?: string | null;
  body: string;
  hashtags?: string[];
  scheduledFor?: Date | null;
  /** Public image URL required for native Instagram/Threads image posts. */
  mediaUrl?: string | null;
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

/**
 * Validate a draft mediaUrl: must be an absolute public http(s) URL.
 * The app never fetches this URL itself (the platform does), so this is a
 * sanity/format check — it prevents `javascript:`/`data:` garbage and
 * obviously-local URLs from reaching connector payloads.
 */
export function isValidMediaUrl(raw: string | null | undefined): boolean {
  const value = raw?.trim();
  if (!value) return true; // optional field
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "127.0.0.1" ||
      host === "::1" ||
      /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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
  const provider = (platform || "instagram").toLowerCase();
  const token =
    process.env.SOCIAL_OFFICIAL_API_TOKEN?.trim() ||
    (provider.includes("instagram")
      ? process.env.INSTAGRAM_ACCESS_TOKEN?.trim()
      : provider.includes("threads")
        ? process.env.THREADS_ACCESS_TOKEN?.trim()
        : provider.includes("tiktok")
          ? process.env.TIKTOK_ACCESS_TOKEN?.trim()
          : "") ||
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

/** Prefer workspace vault credentials, then env-based official tokens. */
export async function resolveOfficialConfigForPublish(input: {
  platform?: string | null;
  workspaceId?: string | null;
  accountId?: string | null;
  official?: ConnectorOfficialConfig | null;
}): Promise<ConnectorOfficialConfig | null> {
  if (input.official) return input.official;

  if (input.workspaceId) {
    try {
      const vault = await resolveOfficialCredential({
        workspaceId: input.workspaceId,
        provider: (input.platform || "instagram").toLowerCase(),
        socialAccountId: input.accountId,
      });
      if (vault) {
        return {
          provider: vault.provider,
          accessToken: vault.accessToken,
          apiBaseUrl: vault.apiBaseUrl,
        };
      }
    } catch {
      // fall through to env config
    }
  }

  return getDefaultOfficialConfig(input.platform || undefined);
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
  /** Dedup key for publish retries (see ConnectorActionInput). */
  idempotencyKey?: string | null;
}): Promise<PublishResult> {
  const mode = input.forceMode || getRuntimeModeLabel();
  const publishedAt = new Date();

  if (!isValidMediaUrl(input.payload.mediaUrl)) {
    return {
      ok: false,
      mode,
      connector: "none",
      publishedAt,
      message: "Invalid media URL: must be a public http(s) URL",
    };
  }

  // Simulator mode never touches the credential vault: resolving it hits the
  // database even though the simulator needs no credentials. Skip the DB
  // round-trip so simulator publishes stay instant and DB-independent.
  const official =
    mode === "simulator"
      ? (input.official ?? null)
      : await resolveOfficialConfigForPublish({
          platform: input.target.platform,
          workspaceId: input.target.workspaceId,
          accountId: input.target.accountId,
          official: input.official,
        });

  const result = await runConnectorAction({
    action: "publishPost",
    runtimeMode: mode,
    policy: getDefaultConnectorPolicy(input.policy),
    target: {
      platform: input.target.platform,
      username: input.target.username,
      accountId: input.target.accountId,
      workspaceId: input.target.workspaceId,
    },
    payload: input.payload as ConnectorPublishPayload,
    webhook: input.webhook === undefined ? getDefaultWebhookConfig() : input.webhook,
    official,
    idempotencyKey: input.idempotencyKey ?? null,
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


/**
 * Decrypt active official credentials for connector runtime.
 *
 * NOTE: sengaja ditaruh di modul ini (bukan di "use server") — fungsi ini
 * menerima workspaceId dari caller dan MENGEMBALIKAN access token terdekripsi.
 * Kalau berada di modul "use server", satu import dari client component saja
 * sudah cukup untuk mengeksposnya sebagai server action tanpa auth dan membuka
 * celah exfiltrasi token antar-tenant. Semua caller saat ini server-side dan
 * mewariskan workspaceId yang di-derive dari session/DB, bukan dari input user.
 */
export async function resolveOfficialCredential(input: {
  workspaceId: string;
  provider: string;
  socialAccountId?: string | null;
}): Promise<{
  provider: string;
  accessToken: string;
  apiBaseUrl: string | null;
  credentialId: string;
} | null> {
  const provider = input.provider.trim().toLowerCase();
  const rows = await db.connectorCredential.findMany({
    where: {
      workspaceId: input.workspaceId,
      provider,
      isActive: true,
      OR: [
        input.socialAccountId ? { socialAccountId: input.socialAccountId } : undefined,
        { socialAccountId: null },
      ].filter(Boolean) as object[],
    },
    orderBy: [{ socialAccountId: "desc" }, { updatedAt: "desc" }],
    take: 5,
  });

  const row =
    rows.find((r) => r.socialAccountId && r.socialAccountId === input.socialAccountId) ||
    rows.find((r) => r.socialAccountId == null) ||
    rows[0];
  if (!row) return null;

  try {
    return {
      provider: row.provider,
      accessToken: decryptSecret(row.accessTokenEnc),
      apiBaseUrl: row.apiBaseUrl,
      credentialId: row.id,
    };
  } catch {
    return null;
  }
}
