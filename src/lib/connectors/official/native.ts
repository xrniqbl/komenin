import type {
  ConnectorActionInput,
  ConnectorResult,
} from "@/lib/connectors/types";
import {
  assertSafeOutboundUrl,
  safeOutboundFetch,
  UnsafeUrlError,
} from "@/lib/url-safety";
import { isAllowedOfficialApiBaseUrl } from "@/lib/connectors/official-base";

/** Guard for workspace/env-controlled Graph base URLs (SSRF + token exfiltration).
 * resolveOfficialBase pins the base to the approved provider allowlist: a
 * workspace admin with settings.manage may store an arbitrary `apiBaseUrl`,
 * and without the pin the platform bearer token would be sent to that host.
 */
function resolveOfficialBase(raw: string | undefined | null, fallback: string): {
  base: string;
} | { error: string } {
  const candidate = raw?.replace(/\/$/, "") || fallback;
  if (!isAllowedOfficialApiBaseUrl(candidate)) {
    return {
      error:
        "Official API base blocked: hostname must be from an approved provider domain",
    };
  }
  try {
    const url = assertSafeOutboundUrl(candidate);
    return { base: url.toString().replace(/\/$/, "") };
  } catch (error) {
    return {
      error:
        error instanceof UnsafeUrlError
          ? `Official API base blocked: ${error.message}`
          : "Official API base URL is not allowed",
    };
  }
}

async function graphFetch(input: {
  url: string;
  token: string;
  method?: string;
  body?: unknown;
}) {
  const response = await safeOutboundFetch(input.url, {
    method: input.method || "GET",
    headers: {
      authorization: `Bearer ${input.token}`,
      ...(input.body ? { "content-type": "application/json" } : {}),
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function runInstagramNative(
  input: ConnectorActionInput,
): Promise<ConnectorResult> {
  const token = input.official?.accessToken;
  if (!token) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: "Instagram access token missing",
    };
  }
  const base =
    input.official?.apiBaseUrl?.replace(/\/$/, "") ||
    process.env.INSTAGRAM_GRAPH_BASE_URL?.replace(/\/$/, "") ||
    "https://graph.facebook.com/v21.0";
  const resolvedBase = resolveOfficialBase(input.official?.apiBaseUrl, base);
  if ("error" in resolvedBase) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: resolvedBase.error,
    };
  }
  const safeBase = resolvedBase.base;

  try {
    switch (input.action) {
      case "healthProbe": {
        const { response, payload } = await graphFetch({
          url: `${safeBase}/me?fields=id,username`,
          token,
        });
        if (!response.ok) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message: payload.error?.message || `Instagram health failed (${response.status})`,
          };
        }
        return {
          ok: true,
          mode: "live",
          connector: "official",
          healthy: true,
          message: `Instagram token ok for @${payload.username || "me"}`,
          details: payload,
        };
      }
      case "publishPost": {
        const publish = input.payload as {
          body: string;
          title?: string | null;
          mediaUrl?: string | null;
          hashtags?: string[];
        };
        const caption = [publish.body, (publish.hashtags || []).map((tag) => `#${tag}`).join(" ")]
          .filter(Boolean)
          .join("\n");

        // Instagram Graph requires a media container flow: create a container
        // from a public image URL, then publish it. Text-only posts are not
        // supported — fail loudly with an actionable message instead of
        // posting an empty container.
        if (!publish.mediaUrl) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message:
              "Instagram native publish requires a public image URL (mediaUrl). Attach media to the draft or switch the connector policy to prefer_webhook.",
          };
        }

        const createRes = await graphFetch({
          url: `${safeBase}/me/media`,
          token,
          method: "POST",
          body: { image_url: publish.mediaUrl, caption, access_token: token },
        });
        if (!createRes.response.ok) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message:
              createRes.payload.error?.message ||
              `Instagram container create failed (${createRes.response.status})`,
            details: createRes.payload,
          };
        }
        const creationId = createRes.payload.id as string | undefined;
        if (!creationId) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message: "Instagram container create returned no id",
            details: createRes.payload,
          };
        }

        const publishRes = await graphFetch({
          url: `${safeBase}/me/media_publish`,
          token,
          method: "POST",
          body: { creation_id: creationId, access_token: token },
        });
        if (!publishRes.response.ok) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message:
              publishRes.payload.error?.message ||
              `Instagram publish failed (${publishRes.response.status})`,
            details: publishRes.payload,
          };
        }
        return {
          ok: true,
          mode: "live",
          connector: "official",
          externalId: publishRes.payload.id,
          message: "Instagram publish accepted",
          details: publishRes.payload,
        };
      }
      case "sendComment": {
        const payloadIn = input.payload as {
          body: string;
          targetPostExternalId?: string | null;
        };
        if (!payloadIn.targetPostExternalId) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message: "Instagram sendComment requires targetPostExternalId",
          };
        }
        const { response, payload } = await graphFetch({
          url: `${safeBase}/${payloadIn.targetPostExternalId}/comments`,
          token,
          method: "POST",
          body: { message: payloadIn.body },
        });
        if (!response.ok) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message: payload.error?.message || `Instagram comment failed (${response.status})`,
            details: payload,
          };
        }
        return {
          ok: true,
          mode: "live",
          connector: "official",
          externalId: payload.id,
          message: "Instagram comment accepted",
          details: payload,
        };
      }
      case "discoverPosts": {
        const query = (input.payload as { query: string }).query;
        const limit = (input.payload as { limit?: number }).limit ?? 3;
        // Instagram hashtag discovery: resolve the hashtag id, then fetch its
        // recent media. Requires instagram_basic + business discovery perms —
        // a permission failure surfaces as a normal failed result so the
        // router can fall back to the webhook bridge.
        const tag = query.replace(/^#/, "").trim();
        if (!tag) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message: "Instagram discovery requires a non-empty hashtag query",
          };
        }
        // Meta requires the Instagram Business Account id (the platform-side
        // id stored in SocialAccount.externalId) for user_id — the internal
        // SocialAccount UUID would make every hashtag call fail with a 400.
        const igUserId = input.target.externalId;
        if (!igUserId) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message:
              "Instagram discovery requires the account's platform externalId (SocialAccount.externalId) on the connector target",
          };
        }
        const searchRes = await graphFetch({
          url: `${safeBase}/ig_hashtag_search?user_id=${encodeURIComponent(
            igUserId,
          )}&q=${encodeURIComponent(tag)}`,
          token,
        });
        if (!searchRes.response.ok) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message:
              searchRes.payload.error?.message ||
              `Instagram hashtag search failed (${searchRes.response.status})`,
            details: searchRes.payload,
          };
        }
        const hashtagId = (searchRes.payload.data as Array<{ id?: string }> | undefined)?.[0]?.id;
        if (!hashtagId) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message: `Instagram hashtag "${tag}" returned no id`,
            details: searchRes.payload,
          };
        }
        const topRes = await graphFetch({
          url: `${safeBase}/${hashtagId}/top_media?user_id=${encodeURIComponent(
            igUserId,
          )}&fields=id,caption,permalink,username,media_product_type&limit=${limit}`,
          token,
        });
        if (!topRes.response.ok) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message:
              topRes.payload.error?.message ||
              `Instagram top media failed (${topRes.response.status})`,
            details: topRes.payload,
          };
        }
        const media = ((topRes.payload.data as Array<Record<string, unknown>>) || []).filter(
          (m) => typeof m.id === "string",
        );
        return {
          ok: true,
          mode: "live",
          connector: "official",
          message: `Instagram discovered ${media.length} posts for #${tag}`,
          posts: media.map((m) => ({
            externalId: String(m.id),
            authorHandle: String(m.username || "unknown"),
            content: String(m.caption || "").slice(0, 500),
            url: String(m.permalink || ""),
            platform: "instagram",
          })),
        };
      }
      default:
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: `Instagram native unsupported action ${input.action}`,
        };
    }
  } catch (error) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: error instanceof Error ? error.message : "Instagram native error",
    };
  }
}

export async function runThreadsNative(
  input: ConnectorActionInput,
): Promise<ConnectorResult> {
  const token = input.official?.accessToken;
  if (!token) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: "Threads access token missing",
    };
  }
  const threadsBase =
    input.official?.apiBaseUrl?.replace(/\/$/, "") ||
    process.env.THREADS_API_BASE_URL?.replace(/\/$/, "") ||
    "https://graph.threads.net/v1.0";
  const resolvedThreads = resolveOfficialBase(input.official?.apiBaseUrl, threadsBase);
  if ("error" in resolvedThreads) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: resolvedThreads.error,
    };
  }
  const threadsSafe = resolvedThreads.base;

  try {
    if (input.action === "healthProbe") {
      const { response, payload } = await graphFetch({
        url: `${threadsSafe}/me?fields=id,username`,
        token,
      });
      if (!response.ok) {
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: payload.error?.message || `Threads health failed (${response.status})`,
        };
      }
      return {
        ok: true,
        mode: "live",
        connector: "official",
        healthy: true,
        message: `Threads token ok for @${payload.username || "me"}`,
      };
    }

    if (input.action === "publishPost") {
      const text = (input.payload as { body: string }).body;
      const { response: createRes, payload: created } = await graphFetch({
        url: `${threadsSafe}/me/threads`,
        token,
        method: "POST",
        body: { media_type: "TEXT", text },
      });
      const create = { ok: createRes.ok };
      if (!create.ok) {
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: created.error?.message || "Threads create failed",
          details: created,
        };
      }
      const { response: publishRes, payload: published } = await graphFetch({
        url: `${threadsSafe}/me/threads_publish`,
        token,
        method: "POST",
        body: { creation_id: created.id },
      });
      const publish = { ok: publishRes.ok };
      if (!publish.ok) {
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: published.error?.message || "Threads publish failed",
          details: published,
        };
      }
      return {
        ok: true,
        mode: "live",
        connector: "official",
        externalId: published.id || created.id,
        message: "Threads publish accepted",
      };
    }

    if (input.action === "sendComment") {
      const payloadIn = input.payload as {
        body: string;
        targetPostExternalId?: string | null;
      };
      if (!payloadIn.targetPostExternalId) {
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: "Threads sendComment requires targetPostExternalId",
        };
      }
      // A Threads reply is a TEXT thread created with reply_to_id, then published
      // via the same two-step create → publish flow used for a normal post.
      const { response: replyCreateRes, payload: created } = await graphFetch({
        url: `${threadsSafe}/me/threads`,
        token,
        method: "POST",
        body: {
          media_type: "TEXT",
          text: payloadIn.body,
          reply_to_id: payloadIn.targetPostExternalId,
        },
      });
      const create = { ok: replyCreateRes.ok };
      if (!create.ok) {
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: created.error?.message || "Threads reply create failed",
          details: created,
        };
      }
      const { response: replyPublishRes, payload: published } = await graphFetch({
        url: `${threadsSafe}/me/threads_publish`,
        token,
        method: "POST",
        body: { creation_id: created.id },
      });
      const publish = { ok: replyPublishRes.ok };
      if (!publish.ok) {
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: published.error?.message || "Threads reply publish failed",
          details: published,
        };
      }
      return {
        ok: true,
        mode: "live",
        connector: "official",
        externalId: published.id || created.id,
        message: "Threads reply accepted",
      };
    }

    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: `Threads native action ${input.action} not implemented; use webhook fallback`,
    };
  } catch (error) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: error instanceof Error ? error.message : "Threads native error",
    };
  }
}

export async function runTikTokNative(
  input: ConnectorActionInput,
): Promise<ConnectorResult> {
  const token = input.official?.accessToken;
  if (!token) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: "TikTok access token missing",
    };
  }
  const tiktokBase =
    input.official?.apiBaseUrl?.replace(/\/$/, "") ||
    process.env.TIKTOK_API_BASE_URL?.replace(/\/$/, "") ||
    "https://open.tiktokapis.com";
  const resolvedTiktok = resolveOfficialBase(input.official?.apiBaseUrl, tiktokBase);
  if ("error" in resolvedTiktok) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: resolvedTiktok.error,
    };
  }
  const tiktokSafe = resolvedTiktok.base;

  try {
    if (input.action === "healthProbe") {
      const { response, payload } = await graphFetch({
        url: `${tiktokSafe}/v2/user/info/?fields=open_id,display_name`,
        token,
      });
      if (!response.ok) {
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: payload.error?.message || `TikTok health failed (${response.status})`,
        };
      }
      return {
        ok: true,
        mode: "live",
        connector: "official",
        healthy: true,
        message: "TikTok token ok",
        details: payload,
      };
    }

    if (input.action === "sendComment") {
      const payloadIn = input.payload as {
        body: string;
        targetPostExternalId?: string | null;
      };
      if (!payloadIn.targetPostExternalId) {
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: "TikTok sendComment requires targetPostExternalId",
        };
      }
      // TikTok Content Posting API comment reply: the reply_list endpoint on
      // the发表 API (v2). The comment id for a video comment is addressed via
      // the /v2/comment/list/create/ manage endpoint.
      const { response, payload } = await graphFetch({
        url: `${tiktokSafe}/v2/comment/create/`,
        token,
        method: "POST",
        body: {
          video_id: payloadIn.targetPostExternalId,
          text: payloadIn.body,
        },
      });
      // TikTok returns 200 with an error block on business failures
      // (error.code !== "ok"), so the body must be inspected, not just the status.
      const tiktokError = payload?.error;
      if (!response.ok || (tiktokError?.code && tiktokError.code !== "ok")) {
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message:
            tiktokError?.message || `TikTok comment failed (${response.status})`,
          details: payload,
        };
      }
      return {
        ok: true,
        mode: "live",
        connector: "official",
        externalId: payload?.data?.comment_id || payload?.data?.id,
        message: "TikTok comment accepted",
        details: payload,
      };
    }

    if (input.action === "publishPost") {
      // Content Posting API requires media transfer; provide clear fail for fallback/webhook.
      return {
        ok: false,
        mode: "live",
        connector: "official",
        message:
          "TikTok native publish requires Content Posting media transfer; configure webhook bridge or media source",
      };
    }

    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: `TikTok native action ${input.action} not implemented; use webhook fallback`,
    };
  } catch (error) {
    return {
      ok: false,
      mode: "live",
      connector: "official",
      message: error instanceof Error ? error.message : "TikTok native error",
    };
  }
}
