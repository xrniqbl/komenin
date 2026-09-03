import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const tokens = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const updateMany = vi.fn(
    async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      let count = 0;
      for (const [id, t] of tokens) {
        const emailMatch = !where.email || t.email === where.email;
        const idMatch = !where.id || id === where.id;
        const consumedMatch =
          where.consumedAt === null ? t.consumedAt == null : true;
        if (emailMatch && idMatch && consumedMatch) {
          tokens.set(id, { ...t, ...data });
          count += 1;
        }
      }
      return { count };
    },
  );
  return {
    db: {
      emailOtpToken: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = `otp_${++seq}`;
          tokens.set(id, { id, attempts: 0, consumedAt: null, ...data });
          return { id, ...data };
        }),
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
          const rows = [...tokens.values()].filter(
            (t) => t.email === where.email && (where.consumedAt === null ? t.consumedAt == null : true),
          );
          return rows.sort(
            (a, b) =>
              new Date(b.createdAt as Date).getTime() - new Date(a.createdAt as Date).getTime(),
          )[0] ?? null;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const t = tokens.get(where.id);
          if (!t) return null;
          const inc = (data.attempts as { increment?: number } | undefined)?.increment;
          const attempts = (t.attempts as number) + (inc ? 1 : 0);
          tokens.set(where.id, { ...t, attempts });
          return tokens.get(where.id);
        }),
        updateMany,
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          emailOtpToken: {
            updateMany,
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
              const id = `otp_${++seq}`;
              tokens.set(id, { id, attempts: 0, consumedAt: null, ...data });
              return { id, ...data };
            }),
          },
        }),
      ),
      __tokens: tokens,
    },
  };
});

import { issueEmailOtp, verifyEmailOtp, __otpInternals } from "@/lib/email-otp";
import { db } from "@/lib/db";

const tokens = (db as unknown as { __tokens: Map<string, Record<string, unknown>> }).__tokens;

beforeEach(() => {
  tokens.clear();
  vi.clearAllMocks();
});

describe("issueEmailOtp", () => {
  it("issues a 6-digit code stored hashed (never plaintext)", async () => {
    const { code } = await issueEmailOtp("User@Example.com");
    expect(code).toMatch(/^\d{6}$/);
    const stored = [...tokens.values()][0];
    expect(stored.email).toBe("user@example.com"); // normalized
    expect(stored.codeHash).not.toBe(code);
    expect(String(stored.codeHash)).toHaveLength(64); // sha256 hex
    expect(stored.salt).toBeTruthy();
  });

  it("invalidates prior unconsumed codes for the same email", async () => {
    await issueEmailOtp("a@b.com");
    await issueEmailOtp("a@b.com");
    const unconsumed = [...tokens.values()].filter(
      (t) => t.email === "a@b.com" && t.consumedAt == null,
    );
    expect(unconsumed).toHaveLength(1);
  });
});

describe("verifyEmailOtp", () => {
  it("verifies a correct code and consumes it (single-use)", async () => {
    const { code } = await issueEmailOtp("a@b.com");
    const ok = await verifyEmailOtp("a@b.com", code);
    expect(ok.ok).toBe(true);
    // second use must fail (already consumed)
    const again = await verifyEmailOtp("a@b.com", code);
    expect(again.ok).toBe(false);
  });

  it("rejects a wrong code and increments attempts", async () => {
    await issueEmailOtp("a@b.com");
    const bad = await verifyEmailOtp("a@b.com", "000000");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe("mismatch");
    const stored = [...tokens.values()][0];
    expect(stored.attempts).toBe(1);
  });

  it("locks after MAX_ATTEMPTS mismatches", async () => {
    const { code } = await issueEmailOtp("a@b.com");
    for (let i = 0; i < __otpInternals.MAX_ATTEMPTS; i++) {
      await verifyEmailOtp("a@b.com", "999999");
    }
    const locked = await verifyEmailOtp("a@b.com", code);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.reason).toBe("locked");
  });

  it("rejects expired codes", async () => {
    const { code } = await issueEmailOtp("a@b.com");
    // force expiry
    const stored = [...tokens.values()][0];
    const id = stored.id as string;
    tokens.set(id, { ...stored, expiresAt: new Date(Date.now() - 1000) });
    const res = await verifyEmailOtp("a@b.com", code);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("expired");
  });

  it("returns not_found when no code was issued", async () => {
    const res = await verifyEmailOtp("ghost@b.com", "123456");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("not_found");
  });

  it("is case/whitespace-insensitive on the code input", async () => {
    const { code } = await issueEmailOtp("a@b.com");
    const res = await verifyEmailOtp("a@b.com", ` ${code} `);
    expect(res.ok).toBe(true);
  });
});
