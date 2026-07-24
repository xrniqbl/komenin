import { db } from "@/lib/db";

/**
 * Runtime feature flags backed by the FeatureFlag table (admin CRUD).
 *
 * Defaults are fail-open for unknown keys so missing rows do not brick the app.
 * Known keys can declare a safer default (usually false for experimental paths).
 */

export const FEATURE_FLAG_KEYS = {
  /** Gate public contact form submissions (kill switch). */
  contactForm: "contact_form",
  /** Allow experimental SSO config UI writes (already partial). */
  ssoConfigUi: "sso_config_ui",
  /** Enable competitor radar module surfaces. */
  competitorRadar: "competitor_radar",
  /**
   * Enable public API write endpoints.
   * Default on so API keys with campaigns:write work out of the box;
   * ops can kill-switch via admin flags.
   */
  publicApiWrite: "public_api_write",
  /** Enable guided onboarding checklist in app shell. */
  guidedOnboarding: "guided_onboarding",
  /** Enable knowledge embeddings path when available. */
  knowledgeEmbeddings: "knowledge_embeddings",
  /** Enable leads CRM surface. */
  leadCapture: "lead_capture",
  /** Enable agency client profiles surface. */
  agencyClients: "agency_clients",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS] | string;

const DEFAULTS: Record<string, boolean> = {
  [FEATURE_FLAG_KEYS.contactForm]: true,
  [FEATURE_FLAG_KEYS.ssoConfigUi]: true,
  [FEATURE_FLAG_KEYS.competitorRadar]: true,
  [FEATURE_FLAG_KEYS.publicApiWrite]: true,
  [FEATURE_FLAG_KEYS.guidedOnboarding]: true,
  [FEATURE_FLAG_KEYS.knowledgeEmbeddings]: false,
  [FEATURE_FLAG_KEYS.leadCapture]: true,
  [FEATURE_FLAG_KEYS.agencyClients]: true,
};

const cache = new Map<string, { value: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 15_000;

function defaultFor(key: string): boolean {
  return DEFAULTS[key] ?? true;
}

export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const row = await db.featureFlag.findUnique({
      where: { key },
      select: { enabled: true },
    });
    const value = row ? row.enabled : defaultFor(key);
    cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
    return value;
  } catch {
    // DB unavailable — use in-process default, do not throw into request path.
    return defaultFor(key);
  }
}

export function clearFeatureFlagCache(key?: string) {
  if (key) cache.delete(key);
  else cache.clear();
}

/** Ensure known flags exist in DB (idempotent seed for admin visibility). */
export async function ensureDefaultFeatureFlags() {
  for (const [key, enabled] of Object.entries(DEFAULTS)) {
    await db.featureFlag.upsert({
      where: { key },
      create: {
        key,
        enabled,
        description: `Default flag: ${key}`,
      },
      update: {},
    });
  }
}
