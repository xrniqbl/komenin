/**
 * Next.js instrumentation hook — runs once when the Node.js server starts
 * (not during `next build`, not on the Edge runtime).
 *
 * Fail fast on bad configuration: validate env and the production gate at
 * boot instead of exploding on the first request (fail-late). Outside a
 * production runtime the gate is a no-op, so local dev is unaffected.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Throws (zod) on missing/invalid required env vars.
  const { getEnv } = await import("@/lib/env");
  getEnv();

  const { evaluateProductionGate } = await import("@/lib/production-gate");
  const gate = evaluateProductionGate();
  for (const warning of gate.warnings) {
    console.warn(`[boot] production-gate warning: ${warning}`);
  }
  if (!gate.ok) {
    for (const error of gate.errors) {
      console.error(`[boot] production-gate error: ${error}`);
    }
    throw new Error(
      `Production gate failed (${gate.errors.length} error(s)); refusing to start. Fix the configuration and redeploy.`,
    );
  }
  console.log("[boot] env + production gate OK");
}
