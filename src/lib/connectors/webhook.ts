import type {
  CommentPayload,
  ConnectorActionInput,
  ConnectorResult,
  DiscoverPayload,
  HealthPayload,
  PublishPayload,
  RotatePayload,
} from "@/lib/connectors/types";
import {
  BRIDGE_CONTRACT_HEADER,
  BRIDGE_CONTRACT_VERSION,
  parseBridgeSuccessPayload,
} from "@/lib/connectors/bridge-contract";
import { safeOutboundFetch, UnsafeUrlError } from "@/lib/url-safety";

function asDiscover(payload: ConnectorActionInput["payload"]): DiscoverPayload {
  return payload as DiscoverPayload;
}
function asComment(payload: ConnectorActionInput["payload"]): CommentPayload {
  return payload as CommentPayload;
}
function asPublish(payload: ConnectorActionInput["payload"]): PublishPayload {
  return payload as PublishPayload;
}
function asHealth(payload: ConnectorActionInput["payload"]): HealthPayload {
  return payload as HealthPayload;
}
function asRotate(payload: ConnectorActionInput["payload"]): RotatePayload {
  return payload as RotatePayload;
}

function buildCaption(payload: PublishPayload): string {
  const tags = (payload.hashtags || [])
    .map((tag) => tag.replace(/^#/, "").trim())
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(" ");
  return [payload.title?.trim(), payload.body.trim(), tags].filter(Boolean).join("\n\n");
}

async function postWebhook(
  input: ConnectorActionInput,
  body: Record<string, unknown>,
): Promise<ConnectorResult> {
  const webhook = input.webhook;
  if (!webhook?.url) {
    return {
      ok: false,
      mode: "live",
      connector: "webhook",
      message: "Webhook connector is not configured",
    };
  }

  try {
    const response = await safeOutboundFetch(webhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(webhook.token ? { authorization: `Bearer ${webhook.token}` } : {}),
        "x-komenin-action": input.action,
        [BRIDGE_CONTRACT_HEADER]: BRIDGE_CONTRACT_VERSION,
        ...(input.idempotencyKey
          ? { "x-komenin-idempotency-key": input.idempotencyKey }
          : {}),
      },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let rawPayload: unknown = {};
    if (rawText.trim()) {
      try {
        rawPayload = JSON.parse(rawText);
      } catch {
        return {
          ok: false,
          mode: "live",
          connector: "webhook",
          message: "Invalid bridge response: body is not JSON",
          details: { status: response.status, action: input.action },
        };
      }
    }

    const payload = (rawPayload && typeof rawPayload === "object"
      ? rawPayload
      : {}) as {
      id?: string;
      externalId?: string;
      externalPostId?: string;
      message?: string;
      error?: string;
      posts?: ConnectorResult["posts"];
      healthy?: boolean;
      ip?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        mode: "live",
        connector: "webhook",
        message:
          payload.error ||
          payload.message ||
          `Webhook failed with HTTP ${response.status}`,
        details: { status: response.status, action: input.action },
      };
    }

    const parsed = parseBridgeSuccessPayload({
      action: input.action,
      payload: rawPayload,
      platform: input.target.platform,
      httpStatus: response.status,
    });

    if (!parsed.ok) {
      return {
        ok: false,
        mode: "live",
        connector: "webhook",
        message: parsed.message,
        details: {
          status: response.status,
          action: input.action,
          ...(parsed.details || {}),
        },
      };
    }

    return {
      ok: true,
      mode: "live",
      connector: "webhook",
      externalId: parsed.externalId,
      posts: parsed.posts,
      healthy: parsed.healthy,
      ip: parsed.ip,
      message: parsed.message,
      details: {
        platform: input.target.platform,
        username: input.target.username || null,
        accountId: input.target.accountId || null,
        contract: BRIDGE_CONTRACT_VERSION,
        ...(parsed.details || {}),
      },
    };
  } catch (error) {
    return {
      ok: false,
      mode: "live",
      connector: "webhook",
      message:
        error instanceof UnsafeUrlError
          ? `Webhook blocked: ${error.message}`
          : error instanceof Error
            ? `Webhook error: ${error.message}`
            : "Webhook error",
    };
  }
}

export async function runWebhookConnector(
  input: ConnectorActionInput,
): Promise<ConnectorResult> {
  const platform = input.target.platform || "unknown";
  const username = input.target.username || null;
  const accountId = input.target.accountId || null;
  const workspaceId = input.target.workspaceId || null;

  switch (input.action) {
    case "discoverPosts": {
      const payload = asDiscover(input.payload);
      return postWebhook(input, {
        action: "discoverPosts",
        platform,
        username,
        accountId,
        workspaceId,
        query: payload.query,
        limit: payload.limit || 5,
        listenerId: payload.listenerId || null,
      });
    }
    case "sendComment": {
      const payload = asComment(input.payload);
      return postWebhook(input, {
        action: "sendComment",
        platform,
        username,
        accountId,
        workspaceId,
        body: payload.body,
        targetPostExternalId: payload.targetPostExternalId || null,
        targetPostUrl: payload.targetPostUrl || null,
        authorHandle: payload.authorHandle || null,
      });
    }
    case "publishPost": {
      const payload = asPublish(input.payload);
      const caption = buildCaption(payload);
      return postWebhook(input, {
        action: "publishPost",
        platform,
        username,
        accountId,
        workspaceId,
        title: payload.title || null,
        body: payload.body,
        hashtags: payload.hashtags || [],
        caption,
        scheduledFor: payload.scheduledFor?.toISOString() || null,
        publishedAt: new Date().toISOString(),
      });
    }
    case "healthProbe": {
      const payload = asHealth(input.payload);
      return postWebhook(input, {
        action: "healthProbe",
        platform,
        username,
        accountId,
        workspaceId,
        hasSession: payload.hasSession !== false,
        proxyHealthy: payload.proxyHealthy !== false,
      });
    }
    case "rotateProxy": {
      const payload = asRotate(input.payload);
      return postWebhook(input, {
        action: "rotateProxy",
        platform,
        username,
        accountId,
        workspaceId,
        proxyId: payload.proxyId || null,
        seed: payload.seed || null,
      });
    }
    default:
      return {
        ok: false,
        mode: "live",
        connector: "webhook",
        message: "Unsupported webhook action",
      };
  }
}
