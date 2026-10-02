import {
  runInstagramNative,
  runThreadsNative,
  runTikTokNative,
} from "@/lib/connectors/official/native";
import type {
  ConnectorActionInput,
  ConnectorResult,
} from "@/lib/connectors/types";
import {
  assertSafeOutboundUrl,
  safeOutboundFetch,
  UnsafeUrlError,
} from "@/lib/url-safety";

/**
 * Official adapters are capability-gated.
 * Provider-native Graph/Open APIs are used when possible.
 * Unsupported actions fail closed so policy can fall back to webhook.
 */
export async function runOfficialConnector(
  input: ConnectorActionInput,
): Promise<ConnectorResult> {
  const official = input.official;
  if (!official?.accessToken) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: "Official API credentials are not configured",
    };
  }

  const provider = (official.provider || input.target.platform || "").toLowerCase();

  if (provider.includes("instagram")) return runInstagramNative(input);
  if (provider.includes("threads")) return runThreadsNative(input);
  if (provider.includes("tiktok")) return runTikTokNative(input);

  // Generic official bridge fallback
  const apiBase =
    official.apiBaseUrl?.replace(/\/$/, "") ||
    process.env.SOCIAL_OFFICIAL_API_BASE_URL?.trim() ||
    null;
  if (!apiBase) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: `No official API base configured for provider ${provider}`,
    };
  }

  try {
    // SSRF guard: a workspace-controlled apiBaseUrl must pass the same
    // resolved-DNS policy as AI providers. assertSafeOutboundUrl is checked
    // again here (defense in depth) because this value crosses a trust
    // boundary from DB/env into an outbound fetch.
    let validatedBase: string;
    try {
      validatedBase = assertSafeOutboundUrl(apiBase).toString().replace(/\/$/, "");
    } catch (error) {
      return {
        ok: false,
        mode: "live",
        connector: "official",
        message:
          error instanceof UnsafeUrlError
            ? `Official API base blocked: ${error.message}`
            : "Official API base URL is not allowed",
      };
    }
    const response = await safeOutboundFetch(`${validatedBase}/${input.action}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${official.accessToken}`,
      },
      body: JSON.stringify({
        platform: input.target.platform,
        username: input.target.username || null,
        accountId: input.target.accountId || null,
        payload: input.payload,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      externalId?: string;
      message?: string;
      error?: string;
      posts?: ConnectorResult["posts"];
      healthy?: boolean;
    };
    if (!response.ok) {
      return {
        ok: false,
        mode: "live",
        connector: "official",
        message: payload.error || payload.message || `Official API failed (${response.status})`,
      };
    }
    return {
      ok: true,
      mode: "live",
      connector: "official",
      externalId: payload.externalId || payload.id,
      posts: payload.posts,
      healthy: payload.healthy,
      message: payload.message || `Official API accepted ${input.action}`,
    };
  } catch (error) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: error instanceof Error ? error.message : "Official API error",
    };
  }
}
