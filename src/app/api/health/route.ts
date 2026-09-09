/**
 * Liveness probe — deliberately does NOT touch the database, rate limits, or
 * the production gate. Used by deploy health checks, load balancers, and
 * uptime monitors: if this fails, the process is dead and needs restarting.
 * Deep readiness (DB reachability, migrations, external services) belongs to
 * /api/status, which is heavier and rate-limited.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    { ok: true, service: "aether", timestamp: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
