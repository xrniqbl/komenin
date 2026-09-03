/**
 * Upstream model cost table for the admin margin view (spec §6 risk #1).
 * Values are IDR per 1 credit (= 1 token, input+output blended), configurable
 * via env so the owner can update 9Router pricing without a redeploy:
 *
 *   AI_MODEL_COST_IDR='{"gpt-4o-mini":0.03,"gpt-4o":0.20,"o1":0.80}'
 *
 * The default table below is a conservative placeholder — REPLACE with real
 * 9Router rates before trusting the margin numbers. Unknown models fall back
 * to DEFAULT_COST_PER_CREDIT_IDR so an unmapped premium model never reads as
 * "free" and artificially inflates margin.
 */

/** Default fallback cost per credit when a model isn't in the table. */
export const DEFAULT_COST_PER_CREDIT_IDR = 0.05;

// Default cost table (IDR per credit) — ESTIMATES from public list prices,
// updated 2026-09 to the current model generation. Override via AI_MODEL_COST_IDR
// with your REAL gateway rates before trusting the admin margin numbers.
const DEFAULT_TABLE: Record<string, number> = {
  // economic
  "gpt-4o-mini": 0.003,
  "deepseek-v3.2": 0.004,
  "glm-4.6-flash": 0.003,
  "gemini-2.0-flash": 0.002,
  // standard
  "gpt-4o": 0.04,
  "deepseek-v3.2-exp": 0.006,
  "kimi-k2": 0.015,
  "glm-4.6": 0.02,
  "gemini-2.5-flash": 0.005,
  // premium / reasoning
  o1: 0.24,
  "claude-sonnet-4.5": 0.05,
  "gemini-2.5-pro": 0.02,
  "deepseek-r1": 0.009,
};

function loadTable(): Record<string, number> {
  const raw = process.env.AI_MODEL_COST_IDR;
  if (!raw?.trim()) return DEFAULT_TABLE;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const table: Record<string, number> = {};
    for (const [model, value] of Object.entries(parsed)) {
      const n = Number(value);
      if (model.trim() && Number.isFinite(n) && n >= 0) table[model] = n;
    }
    return Object.keys(table).length > 0 ? table : DEFAULT_TABLE;
  } catch {
    return DEFAULT_TABLE;
  }
}

/** Upstream cost in IDR for one credit of `model` (fallback: default rate). */
export function costPerCreditIdr(model: string): number {
  const table = loadTable();
  return table[model] ?? DEFAULT_COST_PER_CREDIT_IDR;
}

/** Estimated upstream cost in IDR for `credits` of `model`. */
export function estimateCostIdr(model: string, credits: bigint | number): number {
  return Number(credits) * costPerCreditIdr(model);
}
