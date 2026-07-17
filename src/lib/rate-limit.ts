type RateBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateBucket>();

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

/**
 * Simple in-memory fixed-window rate limiter.
 * Suitable for single-node deployments; use Redis for multi-node production.
 */
export function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(input.key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs;
    buckets.set(input.key, { count: 1, resetAt });
    return {
      ok: true,
      limit: input.limit,
      remaining: Math.max(input.limit - 1, 0),
      resetAt,
    };
  }

  if (existing.count >= input.limit) {
    return {
      ok: false,
      limit: input.limit,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  buckets.set(input.key, existing);
  return {
    ok: true,
    limit: input.limit,
    remaining: Math.max(input.limit - existing.count, 0),
    resetAt: existing.resetAt,
  };
}

export function getRequestRateKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const auth = request.headers.get("authorization") || request.headers.get("x-api-key") || "";
  const identity = auth ? auth.slice(0, 24) : ip;
  return `${prefix}:${identity}`;
}