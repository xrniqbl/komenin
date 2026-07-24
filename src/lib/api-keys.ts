import { createHash, randomBytes } from "node:crypto";

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

export function generateApiKey(): { raw: string; prefix: string; hashed: string } {
  const random = randomBytes(24).toString("hex"); // 48 chars
  const raw = `aeth_${random}`;
  const prefix = raw.slice(0, 12); // aeth_ + 7 chars visible
  const hashed = hashApiKey(raw);
  return { raw, prefix, hashed };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function isValidScope(scope: string): boolean {
  return (SCOPES as readonly string[]).includes(scope);
}
