import type {
  ConnectorActionInput,
  ConnectorResult,
} from "@/lib/connectors/types";

async function graphFetch(input: {
  url: string;
  token: string;
  method?: string;
  body?: unknown;
}) {
  const response = await fetch(input.url, {
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

  try {
    switch (input.action) {
      case "healthProbe": {
        const { response, payload } = await graphFetch({
          url: `${base}/me?fields=id,username`,
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
        const body = (input.payload as { body: string; title?: string | null }).body;
        // Native publish often requires media container flow. Support text-caption endpoint bridge first.
        const { response, payload } = await graphFetch({
          url: `${base}/me/media`,
          token,
          method: "POST",
          body: {
            caption: body,
            // media publish requires image/video URL in real Graph usage; keep bridge-compatible payload
            access_token: token,
          },
        });
        if (!response.ok) {
          return {
            ok: false,
            mode: "live",
            connector: "official",
            message:
              payload.error?.message ||
              "Instagram publish requires approved app + media container flow",
            details: payload,
          };
        }
        return {
          ok: true,
          mode: "live",
          connector: "official",
          externalId: payload.id,
          message: "Instagram publish accepted",
          details: payload,
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
          url: `${base}/${payloadIn.targetPostExternalId}/comments`,
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
        // Hashtag search requires business discovery permissions; return actionable fail for fallback.
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: `Instagram native discover for "${query}" needs hashtag permissions; use webhook fallback`,
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
  const base =
    input.official?.apiBaseUrl?.replace(/\/$/, "") ||
    process.env.THREADS_API_BASE_URL?.replace(/\/$/, "") ||
    "https://graph.threads.net/v1.0";

  try {
    if (input.action === "healthProbe") {
      const response = await fetch(`${base}/me?fields=id,username`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
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
      const create = await fetch(`${base}/me/threads`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ media_type: "TEXT", text }),
      });
      const created = await create.json().catch(() => ({}));
      if (!create.ok) {
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: created.error?.message || "Threads create failed",
          details: created,
        };
      }
      const publish = await fetch(`${base}/me/threads_publish`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ creation_id: created.id }),
      });
      const published = await publish.json().catch(() => ({}));
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
      const create = await fetch(`${base}/me/threads`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          media_type: "TEXT",
          text: payloadIn.body,
          reply_to_id: payloadIn.targetPostExternalId,
        }),
      });
      const created = await create.json().catch(() => ({}));
      if (!create.ok) {
        return {
          ok: false,
          mode: "live",
          connector: "official",
          message: created.error?.message || "Threads reply create failed",
          details: created,
        };
      }
      const publish = await fetch(`${base}/me/threads_publish`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ creation_id: created.id }),
      });
      const published = await publish.json().catch(() => ({}));
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
  const base =
    input.official?.apiBaseUrl?.replace(/\/$/, "") ||
    process.env.TIKTOK_API_BASE_URL?.replace(/\/$/, "") ||
    "https://open.tiktokapis.com";

  try {
    if (input.action === "healthProbe") {
      const response = await fetch(`${base}/v2/user/info/?fields=open_id,display_name`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
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
