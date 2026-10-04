import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => {
  const rows: Array<{ nonceHash: string; expiresAt: Date }> = [];
  return {
    db: {
      consumedNonce: {
        create: vi.fn(async ({ data }: { data: { nonceHash: string; expiresAt: Date } }) => {
          if (rows.some((r) => r.nonceHash === data.nonceHash)) {
            const error = new Error("Unique constraint failed") as Error & { code: string };
            error.code = "P2002";
            throw error;
          }
          rows.push({ nonceHash: data.nonceHash, expiresAt: data.expiresAt });
          return data;
        }),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    },
  };
});

import { claimOAuthStateNonce, claimSsoTicketNonce } from "@/lib/consumed-nonce";
import { cleanObject, sanitizeHTML } from "@/lib/validation";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("security hardening (audit follow-up)", () => {
  it("consumed-nonce claim is single-use: second claim loses", async () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(await claimSsoTicketNonce("nonce-abc", exp)).toBe(true);
    expect(await claimSsoTicketNonce("nonce-abc", exp)).toBe(false);
  });

  it("consumed-nonce namespaces kinds: same nonce, different kind both win", async () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(await claimSsoTicketNonce("shared-nonce", exp)).toBe(true);
    expect(await claimOAuthStateNonce("shared-nonce", exp)).toBe(true);
    // But a repeat within the same kind still loses.
    expect(await claimSsoTicketNonce("shared-nonce", exp)).toBe(false);
  });

  it("consumed-nonce rejects expired nonces without touching the DB", async () => {
    const { db } = await import("@/lib/db");
    const past = Math.floor(Date.now() / 1000) - 10;
    expect(await claimSsoTicketNonce("expired-nonce", past)).toBe(false);
    expect(db.consumedNonce.create).not.toHaveBeenCalled();
  });

  it("consumed-nonce fails closed on unexpected DB errors", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.consumedNonce.create).mockRejectedValueOnce(new Error("boom"));
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(await claimSsoTicketNonce("db-error-nonce", exp)).toBe(false);
  });

  it("cleanObject drops __proto__/constructor/prototype keys (no pollution)", () => {
    const malicious = JSON.parse(
      '{"a":1,"__proto__":{"polluted":true},"constructor":{"x":1},"prototype":{"y":2}}',
    );
    const cleaned = cleanObject(malicious) as Record<string, unknown>;
    expect(cleaned).toEqual({ a: 1 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("cleanObject still strips null/undefined/empty and recurses", () => {
    const cleaned = cleanObject({
      keep: "x",
      gone: null,
      missing: undefined,
      empty: "",
      nested: { deep: 1, skip: null },
    }) as Record<string, unknown>;
    expect(cleaned).toEqual({ keep: "x", nested: { deep: 1 } });
  });

  it("sanitizeHTML keeps neutralizing event handlers + javascript: URLs", () => {
    expect(sanitizeHTML('<img src=x onerror=alert(1)>')).not.toContain("onerror");
    expect(sanitizeHTML('<a href="javascript:alert(1)">click</a>')).not.toContain("javascript");
  });
});
