/**
 * OAuth token refresh for connector credentials.
 *
 * Instagram/Threads long-lived tokens live ~60 days and TikTok access tokens
 * ~24h; without a refresh job credentials expire silently and official
 * adapters start failing. `refreshDueCredentials` refreshes anything that
 * expires within the lead time.
 */
import { OUTBOUND_FETCH_TIMEOUT_MS } from "@/lib/url-safety";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { db } from "@/lib/db";

export type RefreshResult = {
  ok: boolean;
  provider: string;
  message: string;
};

const REFRESH_LEAD_MS = 7 * 24 * 60 * 60 * 1000;

export function isDueForRefresh(expiresAt: Date | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime() + REFRESH_LEAD_MS;
}

async function refreshMetaToken(
  accessToken: string,
  provider: "instagram" | "threads",
): Promise<{ accessToken: string; expiresIn?: number } | { error: string }> {
  // IG: GET /v21.0/oauth/access_token?grant_type=ig_refresh_token
  // Threads: GET /v1.0/refresh_access_token?grant_type=th_refresh_token
  const url = new URL(
    provider === "instagram"
      ? "https://graph.facebook.com/v21.0/oauth/access_token"
      : "https://graph.threads.net/v1.0/refresh_access_token",
  );
  url.searchParams.set(
    "grant_type",
    provider === "instagram" ? "ig_refresh_token" : "th_refresh_token",
  );
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), {
    method: "GET",
    signal: AbortSignal.timeout(OUTBOUND_FETCH_TIMEOUT_MS),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string; code?: number };
  };
  if (!res.ok || !payload.access_token) {
    return {
      error: payload.error?.message || `Refresh failed (${res.status})`,
    };
  }
  return { accessToken: payload.access_token, expiresIn: payload.expires_in };
}

async function refreshTikTokToken(
  refreshToken: string,
): Promise<
  | { accessToken: string; refreshToken?: string; expiresIn?: number }
  | { error: string }
> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY?.trim();
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!clientKey || !clientSecret) {
    return { error: "TikTok client key/secret not configured" };
  }
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    signal: AbortSignal.timeout(OUTBOUND_FETCH_TIMEOUT_MS),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
    message?: string;
  };
  if (!res.ok || !payload.access_token) {
    return {
      error:
        payload.error_description || payload.error || payload.message || `Refresh failed (${res.status})`,
    };
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
  };
}

/** Refresh a single credential row in place. Returns a structured result. */
export async function refreshConnectorCredential(credential: {
  id: string;
  provider: string;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
}): Promise<RefreshResult> {
  const provider = credential.provider.toLowerCase();

  try {
    if (provider === "instagram" || provider === "threads") {
      const accessToken = decryptSecret(credential.accessTokenEnc);
      const result = await refreshMetaToken(
        accessToken,
        provider as "instagram" | "threads",
      );
      if ("error" in result) {
        return { ok: false, provider, message: result.error };
      }
      await db.connectorCredential.update({
        where: { id: credential.id },
        data: {
          accessTokenEnc: encryptSecret(result.accessToken),
          expiresAt: result.expiresIn
            ? new Date(Date.now() + result.expiresIn * 1000)
            : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      });
      return { ok: true, provider, message: "Token refreshed" };
    }

    if (provider === "tiktok") {
      if (!credential.refreshTokenEnc) {
        return { ok: false, provider, message: "No refresh token stored" };
      }
      const refreshToken = decryptSecret(credential.refreshTokenEnc);
      const result = await refreshTikTokToken(refreshToken);
      if ("error" in result) {
        return { ok: false, provider, message: result.error };
      }
      await db.connectorCredential.update({
        where: { id: credential.id },
        data: {
          accessTokenEnc: encryptSecret(result.accessToken),
          refreshTokenEnc: result.refreshToken
            ? encryptSecret(result.refreshToken)
            : credential.refreshTokenEnc,
          expiresAt: result.expiresIn
            ? new Date(Date.now() + result.expiresIn * 1000)
            : new Date(Date.now() + 23 * 60 * 60 * 1000),
        },
      });
      return { ok: true, provider, message: "Token refreshed" };
    }

    return { ok: false, provider, message: `Unsupported provider: ${provider}` };
  } catch (error) {
    return {
      ok: false,
      provider,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Refresh all active credentials expiring within the lead window.
 * Credentials without an expiresAt (unknown TTL) are skipped.
 */
export async function refreshDueCredentials(limit = 20): Promise<{
  checked: number;
  refreshed: number;
  failures: Array<{ credentialId: string; provider: string; message: string }>;
}> {
  const due = await db.connectorCredential.findMany({
    where: {
      isActive: true,
      expiresAt: { lte: new Date(Date.now() + REFRESH_LEAD_MS) },
    },
    orderBy: { expiresAt: "asc" },
    take: limit,
  });

  let refreshed = 0;
  const failures: Array<{ credentialId: string; provider: string; message: string }> = [];

  for (const credential of due) {
    const result = await refreshConnectorCredential(credential);
    if (result.ok) {
      refreshed += 1;
    } else {
      failures.push({
        credentialId: credential.id,
        provider: credential.provider,
        message: result.message,
      });
    }
  }

  return { checked: due.length, refreshed, failures };
}
