/**
 * Model allowlist per Komenin AI tier — enforced SERVER-SIDE in the router
 * (spec §3.6, owner decision #4). Lists are configurable via env so the owner
 * can rotate the 9Router model catalogue without a redeploy:
 *
 *   KOMENIN_AI_MODELS_STARTER   = "gpt-4o-mini,gpt-4o-mini-2024-07-18"
 *   KOMENIN_AI_MODELS_PRO       = adds Standard (GPT-4o class)
 *   KOMENIN_AI_MODELS_PRO_MAX   = adds Premium
 *
 * Each tier inherits the models of the tier below it. When an env var is
 * empty we fall back to the built-in defaults below.
 */

import type { AiTier } from "@prisma/client";

const ECONOMIC_DEFAULT = ["gpt-4o-mini", "gpt-4o-mini-2024-07-18"];
const STANDARD_DEFAULT = ["gpt-4o", "gpt-4o-2024-08-06"];
const PREMIUM_DEFAULT = ["gpt-4o-2024-11-20", "o1", "claude-3-5-sonnet"];

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw?.trim()) return fallback;
  return raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

function envModels(tier: Exclude<AiTier, "none">): string[] {
  switch (tier) {
    case "starter":
      return parseList(process.env.KOMENIN_AI_MODELS_STARTER, ECONOMIC_DEFAULT);
    case "pro":
      return parseList(process.env.KOMENIN_AI_MODELS_PRO, [
        ...ECONOMIC_DEFAULT,
        ...STANDARD_DEFAULT,
      ]);
    case "pro_max":
      return parseList(process.env.KOMENIN_AI_MODELS_PRO_MAX, [
        ...ECONOMIC_DEFAULT,
        ...STANDARD_DEFAULT,
        ...PREMIUM_DEFAULT,
      ]);
  }
}

/**
 * Models a tier is allowed to run on the Komenin gateway. `none` (BYOK only)
 * is unrestricted because those calls use the workspace's own key/models.
 */
export function allowedModelsForTier(tier: AiTier): string[] | null {
  if (tier === "none") return null;
  return envModels(tier);
}

/** True when `model` may run on the Komenin gateway for `tier`. */
export function isModelAllowedForTier(tier: AiTier, model: string): boolean {
  const allowed = allowedModelsForTier(tier);
  if (allowed === null) return true; // BYOK / own key
  return allowed.includes(model);
}

/** Narrow a candidate model list to what the tier may use (order preserved). */
export function filterModelsForTier(tier: AiTier, models: string[]): string[] {
  const allowed = allowedModelsForTier(tier);
  if (allowed === null) return models;
  return models.filter((m) => allowed.includes(m));
}
