import type {
  CommentPayload,
  ConnectorActionInput,
  ConnectorResult,
  DiscoverPayload,
  HealthPayload,
  PublishPayload,
  RotatePayload,
} from "@/lib/connectors/types";
import { simulateIp } from "@/lib/session-routing";

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

export async function runSimulatorConnector(
  input: ConnectorActionInput,
): Promise<ConnectorResult> {
  const platform = input.target.platform || "unknown";
  const username = input.target.username || "unassigned";
  const now = Date.now();

  switch (input.action) {
    case "discoverPosts": {
      const payload = asDiscover(input.payload);
      const limit = Math.min(Math.max(payload.limit || 3, 1), 10);
      const posts = Array.from({ length: limit }).map((_, index) => {
        const externalId = `${platform}_${payload.listenerId || "sim"}_${now}_${index}`;
        return {
          externalId,
          authorHandle: `user_${1000 + index}`,
          content: `Simulator discovery for ${payload.query} (#${index + 1})`,
          url: `https://example.com/p/${externalId}`,
          platform,
        };
      });
      return {
        ok: true,
        mode: "simulator",
        connector: "simulator",
        message: `Simulator discovered ${posts.length} posts`,
        posts,
      };
    }
    case "sendComment": {
      const payload = asComment(input.payload);
      return {
        ok: true,
        mode: "simulator",
        connector: "simulator",
        externalId: `sim_comment_${now}`,
        message: `Simulator sent comment via @${username}`,
        details: {
          bodyPreview: payload.body.slice(0, 160),
          targetPostExternalId: payload.targetPostExternalId || null,
        },
      };
    }
    case "publishPost": {
      const payload = asPublish(input.payload);
      return {
        ok: true,
        mode: "simulator",
        connector: "simulator",
        externalId: `sim_${platform}_${now}`,
        message: `Simulator published to ${platform} @${username}`,
        details: {
          title: payload.title || null,
          bodyPreview: payload.body.slice(0, 160),
          hashtags: payload.hashtags || [],
        },
      };
    }
    case "healthProbe": {
      const payload = asHealth(input.payload);
      const hasSession = payload.hasSession !== false;
      const proxyHealthy = payload.proxyHealthy !== false;
      const healthy = hasSession && proxyHealthy;
      return {
        ok: true,
        mode: "simulator",
        connector: "simulator",
        healthy,
        message: healthy ? "Simulator health probe ok" : "Simulator health probe degraded",
        details: { hasSession, proxyHealthy },
      };
    }
    case "rotateProxy": {
      const payload = asRotate(input.payload);
      const seed = payload.seed || input.target.accountId || username;
      return {
        ok: true,
        mode: "simulator",
        connector: "simulator",
        ip: simulateIp(seed + String(now)),
        message: "Simulator rotated proxy IP",
      };
    }
    default:
      return {
        ok: false,
        mode: "simulator",
        connector: "simulator",
        message: `Unsupported simulator action`,
      };
  }
}
