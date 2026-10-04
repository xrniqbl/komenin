/**
 * Scanner guard — edge-safe detection of automated vulnerability probes.
 *
 * Runs in `src/proxy.ts` (Edge runtime): no Node imports, no Prisma, no
 * Upstash fetch. Pure string matching on pathname + query so it stays fast
 * for every request. Confirmed probes get a generic 404 (never 403/500 —
 * informative statuses teach scanners what exists) and are logged for
 * alerting via the reporter's console line (Sentry ships from Node, not Edge).
 *
 * Throttling of /api/* lives here as pure config; the actual token bucket
 * stays in `src/lib/rate-limit.ts` (Upstash-backed) and is consulted by
 * proxy via a lightweight in-Edge fallback map.
 */

/** Path fragments that legitimate browsers never request. Matched lowercase. */
export const SCANNER_PATH_SIGNATURES = [
  "/.env",
  "/.git/",
  "/.git\\",
  "/.svn/",
  "/.hg/",
  "/.ds_store",
  "wp-admin",
  "wp-login",
  "wp-content",
  "wp-includes",
  "phpmyadmin",
  "phpinfo",
  "actuator",
  ".php",
  ".asp",
  ".aspx",
  ".jsp",
  "/cgi-bin/",
  "/boaform/",
  "/config.json",
  "/server-status",
  "/.aws/",
  "/.ssh/",
  "aws-secret",
  ".bak",
  ".swp",
  "/backup",
  "/dump.sql",
  "/database.sql",
  "xmlrpc.php",
  "/api/.env",
  "/debug/",
  "/console/",
  "/adminer",
  "/solr/",
  "/elastic",
  "/graphql/console",
] as const;

/** Query-string fragments typical of injection scanners. Matched lowercase. */
export const SCANNER_QUERY_SIGNATURES = [
  "union+select",
  "union%20select",
  "' or '1'='1",
  "\" or \"1\"=\"1",
  "<script",
  "%3cscript",
  "../",
  "..%2f",
  "%2e%2e",
  "/etc/passwd",
  "windows/win.ini",
  "${",
  "#{",
  "{{7*7}}",
  "sleep(",
  "benchmark(",
  "pg_sleep",
  "information_schema",
  "@@version",
] as const;

function lowerHaystack(pathname: string, search: string): { path: string; query: string } {
  return { path: pathname.toLowerCase(), query: (search || "").toLowerCase() };
}

/**
 * True when the request looks like an automated vulnerability probe.
 * Conservative by design: only matches fragments no legitimate client sends.
 */
export function isScannerProbe(pathname: string, search = ""): boolean {
  const { path, query } = lowerHaystack(pathname, search);
  for (const sig of SCANNER_PATH_SIGNATURES) {
    if (path.includes(sig)) return true;
  }
  if (query) {
    for (const sig of SCANNER_QUERY_SIGNATURES) {
      if (query.includes(sig)) return true;
    }
  }
  return false;
}

/**
 * One-line log for probe hits. Deliberately console-only: proxy runs on the
 * Edge runtime where the Sentry reporter (node:crypto) is unavailable; the
 * line is greppable in Vercel logs and cheap to alert on.
 */
export function logScannerProbe(input: {
  pathname: string;
  search?: string;
  ip?: string | null;
  userAgent?: string | null;
}): void {
  const ua = (input.userAgent || "-").slice(0, 120);
  console.warn(
    `[scanner-probe] path=${input.pathname}${input.search || ""} ip=${input.ip || "unknown"} ua=${ua}`,
  );
}

// ---------------------------------------------------------------------------
// Edge-local throttle for /api/* (proxy fast path).
//
// The durable limiter (Upstash, src/lib/rate-limit.ts) cannot be awaited
// cheaply on every proxied request without adding latency, so proxy keeps a
// small in-memory fixed window per instance. This only softens abuse on
// serverless (each instance has its own budget); Upstash remains the real
// enforcement inside route handlers. Keys are IP-scoped, never auth-scoped.
// ---------------------------------------------------------------------------

export const EDGE_API_THROTTLE = {
  /** Max /api/* requests per IP per window before proxy returns 429. */
  limit: 180,
  /** Window length in milliseconds. */
  windowMs: 60_000,
  /** Cap so the map cannot grow unbounded in long-lived processes. */
  maxKeys: 5_000,
} as const;

type EdgeBucket = { count: number; resetAt: number };

const edgeBuckets = new Map<string, EdgeBucket>();

/** Test seam: clears the module-local bucket map. */
export function resetEdgeThrottleForTests(): void {
  edgeBuckets.clear();
}

/**
 * Consume one edge throttle token for an IP. Returns null when allowed, or
 * the epoch-ms `resetAt` when the caller should answer 429.
 */
export function consumeEdgeThrottle(ip: string, now = Date.now()): { allowed: true } | { allowed: false; resetAt: number } {
  const key = (ip || "unknown").trim() || "unknown";
  const existing = edgeBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (edgeBuckets.size >= EDGE_API_THROTTLE.maxKeys) {
      // Shed oldest entries instead of growing forever.
      const oldest = edgeBuckets.keys().next();
      if (!oldest.done) edgeBuckets.delete(oldest.value);
    }
    edgeBuckets.set(key, { count: 1, resetAt: now + EDGE_API_THROTTLE.windowMs });
    return { allowed: true };
  }
  if (existing.count >= EDGE_API_THROTTLE.limit) {
    return { allowed: false, resetAt: existing.resetAt };
  }
  existing.count += 1;
  edgeBuckets.set(key, existing);
  return { allowed: true };
}

/** True for API routes that deserve the edge throttle. Cron/worker routes use secrets, not IP budgets. */
export function isThrottledApiPath(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/api/worker/")) return false;
  if (pathname.startsWith("/api/health")) return false;
  return true;
}

export function resolveSecurityContact(): string {
  const fromEnv = process.env.SECURITY_CONTACT?.trim();
  if (fromEnv) return fromEnv;
  const support = process.env.SUPPORT_INBOX_EMAIL?.trim();
  if (support) return support.startsWith("mailto:") ? support : `mailto:${support}`;
  return "mailto:cs@komenin.id";
}

export function buildSecurityTxt(): string {
  const contact = resolveSecurityContact();
  return [
    `Contact: ${contact}`,
    "Expires: 2027-12-31T00:00:00.000Z",
    "Preferred-Languages: id, en",
  ].join("\n") + "\n";
}
