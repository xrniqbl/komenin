import type { ConnectorAction, DiscoveredPost } from "./types";

/** All valid bridge actions */
export type BridgeAction =
  | 'discoverPosts'
  | 'sendComment'
  | 'publishPost'
  | 'healthProbe'
  | 'rotateProxy';

/** Request/response contract version for the external social bridge. */
export const BRIDGE_CONTRACT_VERSION = "v1";
export const BRIDGE_CONTRACT_HEADER = "x-komenin-contract";

export type BridgeRawPayload = {
  ok?: unknown;
  id?: unknown;
  externalId?: unknown;
  externalPostId?: unknown;
  message?: unknown;
  error?: unknown;
  posts?: unknown;
  healthy?: unknown;
  ip?: unknown;
  details?: unknown;
};

export type BridgeParseResult =
  | {
      ok: true;
      externalId?: string;
      posts?: DiscoveredPost[];
      healthy?: boolean;
      ip?: string;
      message: string;
      details?: Record<string, unknown>;
    }
  | {
      ok: false;
      message: string;
      details?: Record<string, unknown>;
    };

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pickExternalId(payload: BridgeRawPayload): string | undefined {
  return (
    asNonEmptyString(payload.externalId) ||
    asNonEmptyString(payload.externalPostId) ||
    asNonEmptyString(payload.id) ||
    undefined
  );
}

function normalizePost(raw: unknown, fallbackPlatform: string): DiscoveredPost | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const externalId = asNonEmptyString(row.externalId);
  const authorHandle = asNonEmptyString(row.authorHandle);
  const content = asNonEmptyString(row.content);
  const url = asNonEmptyString(row.url);
  const platform = asNonEmptyString(row.platform) || fallbackPlatform;
  if (!externalId || !authorHandle || !content || !url || !platform) return null;
  return { externalId, authorHandle, content, url, platform };
}

/**
 * Validate a bridge JSON body for a given action after HTTP 2xx.
 * Fail closed on `ok: false`, non-array posts, or unparseable shapes.
 */
export function parseBridgeSuccessPayload(input: {
  action: ConnectorAction;
  payload: unknown;
  platform?: string;
  httpStatus: number;
}): BridgeParseResult {
  if (input.payload === null || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return {
      ok: false,
      message: "Invalid bridge response: expected a JSON object",
      details: { action: input.action, httpStatus: input.httpStatus },
    };
  }

  const payload = input.payload as BridgeRawPayload;

  if (payload.ok === false) {
    return {
      ok: false,
      message:
        asNonEmptyString(payload.error) ||
        asNonEmptyString(payload.message) ||
        "Invalid bridge response: ok=false",
      details: { action: input.action, httpStatus: input.httpStatus },
    };
  }

  const platform = input.platform || "unknown";
  const message =
    asNonEmptyString(payload.message) ||
    `Webhook accepted ${input.action} for ${platform}`;

  if (input.action === "discoverPosts") {
    if (payload.posts !== undefined && !Array.isArray(payload.posts)) {
      return {
        ok: false,
        message: "Invalid bridge response: posts must be an array",
        details: { action: input.action },
      };
    }
    const rawPosts = Array.isArray(payload.posts) ? payload.posts : [];
    const posts = rawPosts
      .map((row) => normalizePost(row, platform))
      .filter((row): row is DiscoveredPost => Boolean(row));
    return {
      ok: true,
      posts,
      message,
      externalId: pickExternalId(payload),
      details: {
        received: rawPosts.length,
        accepted: posts.length,
        filtered: rawPosts.length - posts.length,
      },
    };
  }

  if (input.action === "healthProbe") {
    const healthy =
      typeof payload.healthy === "boolean" ? payload.healthy : true;
    return {
      ok: true,
      healthy,
      message,
      details: typeof payload.details === "object" && payload.details
        ? (payload.details as Record<string, unknown>)
        : undefined,
    };
  }

  if (input.action === "rotateProxy") {
    return {
      ok: true,
      ip: asNonEmptyString(payload.ip) || undefined,
      message,
      externalId: pickExternalId(payload),
    };
  }

  // sendComment / publishPost
  const externalId = pickExternalId(payload);
  const details: Record<string, unknown> = {};
  if (!externalId) {
    details.warning = "Bridge success without externalId";
  }
  return {
    ok: true,
    externalId,
    message,
    details: Object.keys(details).length ? details : undefined,
  };
}

/**
 * Handle a mock bridge request — used by BridgeServer in mock mode.
 * Returns a simulated { status, body } response without hitting a real bridge.
 */
export function handleMockBridgeRequest(input: {
  action: BridgeAction;
  platform?: string;
  [key: string]: unknown;
}): { status: number; body: Record<string, unknown> } {
  const { action, platform = 'unknown', ...rest } = input;

  switch (action) {
    case 'discoverPosts':
      return {
        status: 200,
        body: {
          ok: true,
          posts: [
            {
              externalId: `mock_post_${Date.now()}`,
              authorHandle: `@mock_user_${platform}`,
              content: `Mock post content for query: ${rest.query ?? ''}`,
              url: `https://mock.${platform}.com/post/${Date.now()}`,
              platform,
            },
          ],
          message: `Mock discoverPosts for ${platform}`,
        },
      };

    case 'sendComment':
      return {
        status: 200,
        body: {
          ok: true,
          externalId: `mock_comment_${Date.now()}`,
          message: `Mock comment sent on ${platform}`,
        },
      };

    case 'publishPost':
      return {
        status: 200,
        body: {
          ok: true,
          externalId: `mock_published_${Date.now()}`,
          message: `Mock post published on ${platform}`,
        },
      };

    case 'healthProbe':
      return {
        status: 200,
        body: {
          ok: true,
          healthy: true,
          message: `Mock bridge healthy for ${platform}`,
        },
      };

    case 'rotateProxy':
      return {
        status: 200,
        body: {
          ok: true,
          ip: '127.0.0.1',
          message: `Mock proxy rotated for ${platform}`,
        },
      };

    default: {
      const _exhaustive: never = action;
      return {
        status: 400,
        body: { ok: false, error: `Unknown bridge action: ${String(_exhaustive)}` },
      };
    }
  }
}
