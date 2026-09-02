import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AiTier } from "@prisma/client";

vi.mock("@/lib/db", () => {
  const subscriptionRows = new Map<string, unknown>();
  const workspaceRows = new Map<string, unknown>();
  const ledgerAggregate = vi.fn();
  const ledgerFindFirst = vi.fn();
  const usageCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "evt_1",
    ...data,
  }));
  const ledgerCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "led_1",
    ...data,
  }));

  return {
    db: {
      workspaceAiSubscription: {
        findUnique: vi.fn(async ({ where }: { where: { workspaceId: string } }) =>
          subscriptionRows.get(where.workspaceId) ?? null,
        ),
      },
      workspace: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          workspaceRows.get(where.id) ?? { aiPreferOwnKey: true },
        ),
      },
      aiCreditLedger: {
        aggregate: ledgerAggregate,
        findFirst: ledgerFindFirst,
        create: ledgerCreate,
      },
      aiUsageEvent: {
        create: usageCreate,
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          aiCreditLedger: { findFirst: ledgerFindFirst, create: ledgerCreate },
          aiUsageEvent: { create: usageCreate },
        }),
      ),
      __setSubscription: (id: string, row: unknown) => subscriptionRows.set(id, row),
      __setWorkspace: (id: string, row: unknown) => workspaceRows.set(id, row),
      __ledgerAggregate: ledgerAggregate,
      __ledgerFindFirst: ledgerFindFirst,
      __ledgerCreate: ledgerCreate,
      __usageCreate: usageCreate,
    },
  };
});

import {
  resolveAiBilling,
  recordAiUsage,
  tierAllowsPaygFallback,
  tierFromPlanCode,
} from "@/lib/ai/billing";
import { db } from "@/lib/db";

const mocked = db as unknown as {
  __setSubscription: (id: string, row: unknown) => void;
  __setWorkspace: (id: string, row: unknown) => void;
  __ledgerAggregate: ReturnType<typeof vi.fn>;
  __ledgerFindFirst: ReturnType<typeof vi.fn>;
  __ledgerCreate: ReturnType<typeof vi.fn>;
  __usageCreate: ReturnType<typeof vi.fn>;
};

function activeSub(over: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    tier: "starter",
    monthlyCredits: 1_000_000n,
    status: "active",
    termStart: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
    termEnd: new Date(now.getTime() + 25 * 24 * 3600 * 1000),
    quotaPeriodStart: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
    quotaPeriodEnd: new Date(now.getTime() + 25 * 24 * 3600 * 1000),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.__ledgerAggregate.mockResolvedValue({ _sum: { credits: null } });
});

describe("tierAllowsPaygFallback", () => {
  it("only pro_max falls back to PAYG", () => {
    expect(tierAllowsPaygFallback("pro_max")).toBe(true);
    expect(tierAllowsPaygFallback("pro")).toBe(false);
    expect(tierAllowsPaygFallback("starter")).toBe(false);
    expect(tierAllowsPaygFallback("none")).toBe(false);
  });
});

describe("tierFromPlanCode", () => {
  it("maps AI plan codes to tiers", () => {
    expect(tierFromPlanCode("ai_starter_1m")).toBe("starter");
    expect(tierFromPlanCode("ai_pro_12m")).toBe("pro");
    expect(tierFromPlanCode("ai_pro_max_1m")).toBe("pro_max");
    expect(tierFromPlanCode("starter_1m")).toBeNull();
  });
});

describe("resolveAiBilling", () => {
  it("prefers own key when workspace has providers and prefers it", async () => {
    const result = await resolveAiBilling({
      workspaceId: "ws_1",
      hasOwnProvider: true,
      preferOwnKey: true,
    });
    expect(result).toEqual({
      ok: true,
      source: "own_key",
      remaining: null,
      tier: "none",
    });
  });

  it("honours the persisted aiPreferOwnKey=false workspace preference", async () => {
    mocked.__setWorkspace("ws_byok_off", { aiPreferOwnKey: false });
    mocked.__setSubscription("ws_byok_off", activeSub());
    mocked.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: -100_000n } });

    const result = await resolveAiBilling({
      workspaceId: "ws_byok_off",
      hasOwnProvider: true, // own provider exists but is NOT preferred
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.source).toBe("subscription");
  });

  it("uses subscription quota when active and not spent", async () => {
    mocked.__setSubscription("ws_1", activeSub());
    // subscription_used aggregate (usage stored negative) — called FIRST
    mocked.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: -300_000n } });

    const result = await resolveAiBilling({ workspaceId: "ws_1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("subscription");
      expect(result.remaining).toBe(700_000n);
    }
  });

  it("stops (fail-closed) when starter quota is spent", async () => {
    mocked.__setSubscription("ws_1", activeSub({ tier: "starter" }));
    mocked.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: -1_000_000n } });

    const result = await resolveAiBilling({ workspaceId: "ws_1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no_source");
      expect(result.message).toMatch(/habis/i);
    }
  });

  it("pro_max falls back to PAYG when quota is spent", async () => {
    mocked.__setSubscription("ws_1", activeSub({ tier: "pro_max", monthlyCredits: 25_000_000n }));
    mocked.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: -25_000_000n } }); // subscription used
    mocked.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: 500_000n } }); // payg balance

    const result = await resolveAiBilling({ workspaceId: "ws_1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("payg");
      expect(result.remaining).toBe(500_000n);
    }
  });

  it("uses PAYG when there is no subscription but balance exists", async () => {
    // no subscription row → findUnique returns null
    mocked.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: 250_000n } });

    const result = await resolveAiBilling({ workspaceId: "ws_2" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe("payg");
      expect(result.remaining).toBe(250_000n);
    }
  });

  it("fails closed with a helpful message when no source exists", async () => {
    const result = await resolveAiBilling({ workspaceId: "ws_3" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no_source");
      expect(result.message).toMatch(/Settings → AI|berlangganan/i);
    }
  });

  it("ignores expired subscriptions", async () => {
    mocked.__setSubscription(
      "ws_4",
      activeSub({
        termEnd: new Date(Date.now() - 24 * 3600 * 1000), // expired
      }),
    );
    mocked.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: null } }); // payg = 0

    const result = await resolveAiBilling({ workspaceId: "ws_4" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.tier).toBe("none");
  });
});

describe("recordAiUsage", () => {
  it("own_key calls write a zero-credit usage event only", async () => {
    const result = await recordAiUsage({
      workspaceId: "ws_1",
      source: "own_key",
      model: "gpt-4o-mini",
      inputTokens: 100,
      outputTokens: 50,
      providerId: "wp_1",
    });

    expect(result.creditsUsed).toBe(0n);
    expect(mocked.__usageCreate).toHaveBeenCalledTimes(1);
    expect(mocked.__ledgerCreate).not.toHaveBeenCalled();
    const event = mocked.__usageCreate.mock.calls[0][0];
    expect(event.data.billedTo).toBe("own_key");
    expect(event.data.creditsUsed).toBe(0n);
    expect(event.data.inputTokens).toBe(100);
    expect(event.data.outputTokens).toBe(50);
    expect(event.data.requestId).toBeTruthy();
  });

  it("subscription calls debit the ledger and write a usage event", async () => {
    const result = await recordAiUsage({
      workspaceId: "ws_1",
      source: "subscription",
      model: "gpt-4o-mini",
      inputTokens: 200,
      outputTokens: 100,
      refType: "comment_action",
      refId: "ca_1",
      requestId: "req_abc",
    });

    expect(result.creditsUsed).toBe(300n);
    expect(mocked.__ledgerCreate).toHaveBeenCalledTimes(1);
    const ledgerRow = mocked.__ledgerCreate.mock.calls[0][0];
    expect(ledgerRow.data.kind).toBe("subscription_use");
    expect(ledgerRow.data.credits).toBe(-300n);
    expect(ledgerRow.data.operationId).toBe("use:req_abc");
    expect(ledgerRow.data.usageEventId).toBe("evt_1");
    expect(mocked.__usageCreate).toHaveBeenCalledTimes(1);
    const event = mocked.__usageCreate.mock.calls[0][0];
    expect(event.data.billedTo).toBe("subscription");
    expect(event.data.creditsUsed).toBe(300n);
    expect(event.data.providerId).toBe("komenin:gpt-4o-mini");
  });

  it("payg calls debit with payg_use kind", async () => {
    await recordAiUsage({
      workspaceId: "ws_1",
      source: "payg",
      model: "gpt-4o",
      inputTokens: 0,
      outputTokens: 1000,
    });

    const ledgerRow = mocked.__ledgerCreate.mock.calls[0][0];
    expect(ledgerRow.data.kind).toBe("payg_use");
    expect(ledgerRow.data.credits).toBe(-1000n);
  });

  it("never charges negative tokens", async () => {
    const result = await recordAiUsage({
      workspaceId: "ws_1",
      source: "subscription",
      model: "m",
      inputTokens: -50,
      outputTokens: 100,
    });
    expect(result.creditsUsed).toBe(100n);
  });

  it("marks estimated usage when the provider does not report tokens", async () => {
    await recordAiUsage({
      workspaceId: "ws_1",
      source: "subscription",
      model: "m",
      inputTokens: 10,
      outputTokens: 10,
      reported: false,
    });
    const event = mocked.__usageCreate.mock.calls[0][0];
    expect(event.data.usageSource).toBe("estimated");
  });
});
