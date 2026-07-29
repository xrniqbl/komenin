export type MockBridgeRequest = {
  action: string;
  platform?: string;
  query?: string;
  limit?: number;
  body?: string;
  targetPostExternalId?: string | null;
  targetPostUrl?: string | null;
  authorHandle?: string | null;
  title?: string | null;
  hashtags?: string[];
  caption?: string;
  hasSession?: boolean;
  proxyHealthy?: boolean | null;
  proxyId?: string | null;
  seed?: string | null;
  idempotencyKey?: string | null;
  [key: string]: unknown;
};

export type MockBridgeResponse = {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

function slug(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "query"
  );
}

export function handleMockBridgeRequest(req: MockBridgeRequest): MockBridgeResponse {
  const platform = (req.platform || "instagram").toLowerCase();
  const headers = { "x-aether-contract": "v1" };

  switch (req.action) {
    case "discoverPosts": {
      const limit = Math.min(Math.max(Number(req.limit) || 3, 1), 5);
      const q = slug(String(req.query || "trend"));
      const posts = Array.from({ length: limit }, (_, i) => {
        const externalId = `mock_${platform}_${q}_${i + 1}`;
        return {
          externalId,
          authorHandle: `mock_user_${i + 1}`,
          content: `Mock discovery for "${req.query || "trend"}" #${i + 1}`,
          url: `https://example.com/mock/${externalId}`,
          platform,
        };
      });
      return {
        status: 200,
        headers,
        body: {
          ok: true,
          message: `Mock discovered ${posts.length} posts`,
          posts,
        },
      };
    }
    case "sendComment": {
      const target = req.targetPostExternalId || "unknown";
      return {
        status: 200,
        headers,
        body: {
          ok: true,
          externalId: `mock_comment_${platform}_${target}`.slice(0, 120),
          message: "Mock comment accepted",
        },
      };
    }
    case "publishPost": {
      const seed = slug(String(req.caption || req.body || "post"));
      return {
        status: 200,
        headers,
        body: {
          ok: true,
          externalId: `mock_post_${platform}_${seed}`,
          message: "Mock publish accepted",
        },
      };
    }
    case "healthProbe": {
      return {
        status: 200,
        headers,
        body: {
          ok: true,
          healthy: true,
          message: "Mock health ok",
        },
      };
    }
    case "rotateProxy": {
      return {
        status: 200,
        headers,
        body: {
          ok: true,
          ip: "203.0.113.10",
          message: "Mock proxy rotated",
        },
      };
    }
    default:
      return {
        status: 400,
        headers,
        body: {
          ok: false,
          error: `Unsupported mock bridge action: ${req.action || "(missing)"}`,
        },
      };
  }
}
