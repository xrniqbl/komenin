import { NextRequest } from "next/server";
import { hashApiKey } from "@/lib/api-keys";
import { db } from "@/lib/db";
import type { ApiScope } from "@/lib/api-keys";

type AuthResult = {
  workspaceId: string;
  scopes: string[];
  keyId: string;
  keyName: string;
};

export async function authenticateApiKey(req: NextRequest): Promise<AuthResult | null> {
  const header = req.headers.get("x-api-key") || req.headers.get("authorization") || "";
  let raw = "";

  if (header.startsWith("Bearer ")) {
    raw = header.slice(7).trim();
  } else if (header.startsWith("aeth_")) {
    raw = header.trim();
  } else if (header) {
    // x-api-key header directly
    raw = header.trim();
  }

  if (!raw || !raw.startsWith("aeth_")) return null;

  const hashed = hashApiKey(raw);

  const key = await db.apiKey.findFirst({
    where: {
      hashedKey: hashed,
      isActive: true,
    },
  });

  if (!key) return null;

  if (key.expiresAt && key.expiresAt < new Date()) return null;

  // Async update lastUsedAt without blocking
  db.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    workspaceId: key.workspaceId,
    scopes: key.scopes,
    keyId: key.id,
    keyName: key.name,
  };
}

export function hasScope(scopes: string[], required: ApiScope): boolean {
  return scopes.includes(required) || scopes.includes("*");
}

export function requireScope(scopes: string[], required: ApiScope): { ok: true } | { ok: false; error: string } {
  if (!hasScope(scopes, required)) {
    return { ok: false, error: `Missing scope: ${required}` };
  }
  return { ok: true };
}
