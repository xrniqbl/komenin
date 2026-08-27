/**
 * Fixed-window rate limiter.
 *
 * Backends:
 * - "upstash": durable, shared across instances (serverless-safe). Used when
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are configured.
 * - "memory": single-process fallback. On Vercel/serverless each function
 *   instance has its own budget, so memory limiting only softens abuse —
 *   configure Upstash for any real protection.
 *
 * All callers must `await consumeRateLimit(...)`; the async signature lets
 * the durable backend work without changing call sites again.
 */

type RateBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateBucket>();

export type RateLimitBackend = "memory" | "upstash";

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  backend: RateLimitBackend;
};

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

export function resolveBackendLabel(): RateLimitBackend {
  return upstashConfig() ? "upstash" : "memory";
}

function pruneExpired(now: number) {
  // Opportunistic cleanup to avoid unbounded growth in long-lived processes.
  if (buckets.size < 2_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function consumeRateLimitMemory(input: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const existing = buckets.get(input.key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs;
    buckets.set(input.key, { count: 1, resetAt });
    return {
      ok: true,
      limit: input.limit,
      remaining: Math.max(input.limit - 1, 0),
      resetAt,
      backend: "memory",
    };
  }

  if (existing.count >= input.limit) {
    return {
      ok: false,
      limit: input.limit,
      remaining: 0,
      resetAt: existing.resetAt,
      backend: "memory",
    };
  }

  existing.count += 1;
  buckets.set(input.key, existing);
  return {
    ok: true,
    limit: input.limit,
    remaining: Math.max(input.limit - existing.count, 0),
    resetAt: existing.resetAt,
    backend: "memory",
  };
}

async function upstashCommand(
  config: { url: string; token: string },
  command: Array<string | number>,
): Promise<unknown> {
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(2_500),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const data = (await res.json()) as { result?: unknown };
  return data.result ?? null;
}

async function consumeUpstash(
  input: { key: string; limit: number; windowMs: number },
  config: { url: string; token: string },
): Promise<RateLimitResult> {
  const redisKey = `komenin:rl:${input.key}`;
  const count = await upstashCommand(config, ["INCR", redisKey]);
  if (typeof count !== "number") throw new Error("Unexpected Upstash INCR result");
  // Fix the window only on the first hit so the TTL is not reset per request.
  if (count === 1) {
    await upstashCommand(config, ["PEXPIRE", redisKey, input.windowMs]);
  }
  return {
    ok: count <= input.limit,
    limit: input.limit,
    remaining: Math.max(input.limit - count, 0),
    resetAt: Date.now() + input.windowMs,
    backend: "upstash",
  };
}

/**
 * Consume one rate-limit token for `input.key`. Prefers the durable Upstash
 * backend; transparently falls back to the in-memory bucket on outage so a
 * Redis failure never takes the endpoint down.
 */
export async function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const config = upstashConfig();
  if (config) {
    try {
      return await consumeUpstash(input, config);
    } catch (error) {
      console.warn("[rate-limit] upstash backend failed, using memory", error);
    }
  }
  return consumeRateLimitMemory(input);
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
 * Extract the client IP for rate limiting.
 *
 * Priority: platform-set headers that the edge overwrites (not client-settable
 * in practice), then X-Forwarded-For as a last resort. Reading a generic
 * X-Forwarded-For FIRST is a known bypass: clients prepend arbitrary hops and
 * the app ends up keying on attacker-controlled values.
 */
export function extractClientIp(request: Request): string {
  // Vercel sets x-vercel-forwarded-for at the edge (client value is ignored).
  const vercel = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;

  // Cloudflare overwrites cf-connecting-ip with the real client address.
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  // Generic fallback: right-most public hop (added by the last proxy).
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

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function getRequestRateKey(request: Request, prefix: string): string {
  const ip = extractClientIp(request);
  // Do not key on Authorization/API-key prefixes (can collide and leak material into logs).
  return `${prefix}:ip:${ip}`;
}
