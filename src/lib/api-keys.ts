import { createHash, createHmac, randomBytes } from "node:crypto";

export const SCOPES = [
  "campaigns:read",
  "campaigns:write",
  "accounts:read",
  "listeners:read",
  "listeners:write",
  "leads:read",
  "leads:write",
  "templates:read",
  "activity:read",
  "analytics:read",
  "competitors:read",
] as const;

export type ApiScope = (typeof SCOPES)[number];

/**
 * Optional server-side pepper for API key hashes. Without it a database leak
 * still cannot realistically brute-force 192-bit random keys, but the pepper
 * removes any doubt and protects weaker hand-picked keys. When set, new
 * lookups must accept BOTH schemes (see hashApiKeyVariants) so keys minted
 * before the pepper stay valid until re-issued.
 */
function pepper(): string {
  return process.env.API_KEY_PEPPER?.trim() || "";
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generateApiKey(): { raw: string; prefix: string; hashed: string } {
  const random = randomBytes(24).toString("hex"); // 48 chars
  const raw = `aeth_${random}`;
  const prefix = raw.slice(0, 12); // aeth_ + 7 chars visible
  const hashed = hashApiKey(raw);
  return { raw, prefix, hashed };
}

/** Current scheme: sha256, wrapped in HMAC-SHA256 when API_KEY_PEPPER is set. */
export function hashApiKey(raw: string): string {
  const digest = sha256Hex(raw);
  const key = pepper();
  if (!key) return digest;
  return createHmac("sha256", key).update(digest).digest("hex");
}

/** Pre-pepper scheme: plain sha256 hex — kept for lookups during migration. */
export function legacyHashApiKey(raw: string): string {
  return sha256Hex(raw);
}

/**
 * Every stored-hash variant that could match `raw`. Callers must query with
 * `hashedKey: { in: hashApiKeyVariants(raw) }`. With no pepper configured the
 * array is single-element, preserving legacy lookups exactly.
 */
export function hashApiKeyVariants(raw: string): string[] {
  const current = hashApiKey(raw);
  if (!pepper()) return [current];
  const legacy = legacyHashApiKey(raw);
  return legacy === current ? [current] : [current, legacy];
}

export function isValidScope(scope: string): boolean {
  return (SCOPES as readonly string[]).includes(scope);
}
