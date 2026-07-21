import { getEnv } from "@/lib/env";
import { isProductionRuntime } from "@/lib/security";

export type ProductionGateResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function evaluateProductionGate(): ProductionGateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isProductionRuntime()) {
    return { ok: true, errors, warnings: ["Not running in production runtime"] };
  }

  const env = getEnv();

  // Fail closed: simulator must not run as production.
  if (env.SIMULATOR_MODE) {
    errors.push("SIMULATOR_MODE=true is not allowed in production runtime");
  }

  if (!env.WORKER_SECRET) {
    errors.push("WORKER_SECRET is required");
  }

  // Live social mode requires authenticated publish webhook token.
  if (process.env.SIMULATOR_MODE === "false") {
    if (!process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim()) {
      errors.push("SOCIAL_PUBLISH_WEBHOOK_TOKEN is required when SIMULATOR_MODE=false");
    }
  }

  if (process.env.MIDTRANS_IS_PRODUCTION === "true") {
    if (!process.env.MIDTRANS_SERVER_KEY?.trim()) {
      errors.push("MIDTRANS_SERVER_KEY required when MIDTRANS_IS_PRODUCTION=true");
    }
    if (!process.env.MIDTRANS_CLIENT_KEY?.trim()) {
      errors.push("MIDTRANS_CLIENT_KEY required when MIDTRANS_IS_PRODUCTION=true");
    }
  }

  if (process.env.AUTH_URL && process.env.APP_URL && process.env.AUTH_URL !== process.env.APP_URL) {
    warnings.push("AUTH_URL and APP_URL differ");
  }

  return { ok: errors.length === 0, errors, warnings };
}
