export function getRuntimeModeLabel(): "simulator" | "live" {
  const raw = process.env.SIMULATOR_MODE;
  if (raw === "false") return "live";
  return "simulator";
}

export function describeSendResult(mode: "simulator" | "live" = getRuntimeModeLabel()): string {
  return mode === "simulator"
    ? "Comment sent via managed session worker (simulator mode)"
    : "Comment send accepted by live connector";
}

export type LiveReadiness = {
  mode: "simulator" | "live";
  ready: boolean;
  blockers: string[];
  warnings: string[];
};

/**
 * Operator-facing readiness for live social actions.
 * Distinct from production-gate (deploy hard-fail): this is advisory UI truth.
 */
export function evaluateLiveReadiness(): LiveReadiness {
  const mode = getRuntimeModeLabel();
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (mode === "simulator") {
    warnings.push("SIMULATOR_MODE is on — outbound comments/posts are simulated, not delivered to platforms.");
    return { mode, ready: false, blockers, warnings };
  }

  const webhookUrl = process.env.SOCIAL_PUBLISH_WEBHOOK_URL?.trim();
  const webhookToken = process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim();
  const policy = (process.env.SOCIAL_CONNECTOR_POLICY || "prefer_webhook").trim();

  if (!webhookUrl && !process.env.SOCIAL_OFFICIAL_API_BASE_URL?.trim()) {
    blockers.push("No live connector configured (set SOCIAL_PUBLISH_WEBHOOK_URL or official API base URL).");
  }
  if (webhookUrl && !webhookToken) {
    blockers.push("SOCIAL_PUBLISH_WEBHOOK_TOKEN is required when using the publish webhook.");
  }
  if (policy === "simulator_only") {
    blockers.push("SOCIAL_CONNECTOR_POLICY=simulator_only forces simulator even when SIMULATOR_MODE=false.");
  }
  if (policy === "official_only" && !process.env.SOCIAL_OFFICIAL_API_BASE_URL?.trim()) {
    warnings.push("official_only policy set but SOCIAL_OFFICIAL_API_BASE_URL is missing.");
  }
  if (!process.env.WORKER_SECRET?.trim()) {
    warnings.push("WORKER_SECRET is empty — worker tick endpoints are unprotected.");
  }

  return {
    mode,
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}