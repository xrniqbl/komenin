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
  if (env.SIMULATOR_MODE) {
    warnings.push("SIMULATOR_MODE=true in production runtime");
  }
  if (!env.WORKER_SECRET) {
    errors.push("WORKER_SECRET is required");
  }
  if (!process.env.SOCIAL_PUBLISH_WEBHOOK_TOKEN?.trim() && process.env.SIMULATOR_MODE === "false") {
    warnings.push("SOCIAL_PUBLISH_WEBHOOK_TOKEN missing while live mode enabled");
  }
  if (process.env.MIDTRANS_IS_PRODUCTION === "true" && !process.env.MIDTRANS_SERVER_KEY?.trim()) {
    errors.push("MIDTRANS_SERVER_KEY required when MIDTRANS_IS_PRODUCTION=true");
  }
  if (process.env.AUTH_URL && process.env.APP_URL && process.env.AUTH_URL !== process.env.APP_URL) {
    warnings.push("AUTH_URL and APP_URL differ");
  }

  return { ok: errors.length === 0, errors, warnings };
}