/**
 * Fixed-window rate limiter.
 *
 * Default backend is in-memory (single Node process). For multi-instance
 * production, set a durable backend later (Redis/Upstash) behind the same
 * `consumeRateLimit` API — do not rely on this Map across replicas.
 */

type RateBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateBucket>();

export type RateLimitBackend = "memory" | "redis-unconfigured";

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  backend: RateLimitBackend;
};

/**
 * Future multi-node hook.
 * When REDIS_URL / UPSTASH_REDIS_REST_URL is present we still use memory today,
 * but label the backend so ops can detect missing durable limiter wiring.
 */
function resolveBackendLabel(): RateLimitBackend {
  if (
    process.env.REDIS_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    process.env.RATE_LIMIT_REDIS_URL?.trim()
  ) {
    return "redis-unconfigured";
  }
  return "memory";
}

function pruneExpired(now: number) {
  // Opportunistic cleanup to avoid unbounded growth in long-lived processes.
  if (buckets.size < 2_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);
  const backend = resolveBackendLabel();

  const existing = buckets.get(input.key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs;
    buckets.set(input.key, { count: 1, resetAt });
    return {
      ok: true,
      limit: input.limit,
      remaining: Math.max(input.limit - 1, 0),
      resetAt,
      backend,
    };
  }

  if (existing.count >= input.limit) {
    return {
      ok: false,
      limit: input.limit,
      remaining: 0,
      resetAt: existing.resetAt,
      backend,
    };
  }

  existing.count += 1;
  buckets.set(input.key, existing);
  return {
    ok: true,
    limit: input.limit,
    remaining: Math.max(input.limit - existing.count, 0),
    resetAt: existing.resetAt,
    backend,
  };
}

function isPrivateOrLocalIp(ip: string): boolean {
  const value = ip.trim().toLowerCase();
  if (!value || value === "unknown") return true;
  if (value === "::1" || value === "127.0.0.1" || value === "0.0.0.0") return true;
  if (value.startsWith("10.") || value.startsWith("192.168.") || value.startsWith("169.254.")) {
    return true;
  }
  const m = value.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * Prefer the right-most public X-Forwarded-For hop when present.
 * Left-most is client-spoofable unless the edge proxy strips untrusted hops.
 * Still not a substitute for trusted-proxy configuration at the load balancer.
 */
export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const parts = forwarded
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 0) {
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (!isPrivateOrLocalIp(parts[i])) return parts[i];
    }
    return parts[parts.length - 1];
  }

  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  );
}

export function getRequestRateKey(request: Request, prefix: string): string {
  const ip = extractClientIp(request);
  // Do not key on Authorization/API-key prefixes (can collide and leak material into logs).
  return `${prefix}:ip:${ip}`;
}
