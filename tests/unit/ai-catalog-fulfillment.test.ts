import { describe, expect, it, vi, beforeEach } from "vitest";
import { ALL_PLANS, AI_PLANS, DEFAULT_PLANS } from "@/lib/billing/catalog";

/**
 * Fase 2.1 — catalog exposes 6 AI subscription SKUs + 3 PAYG SKUs with an
 * explicit `kind` and per-SKU `aiCredits`. Fase 2.2 — the fulfillment helpers
 * are idempotent via unique operationId / sourceOrderId.
 */

describe("AI catalog SKUs", () => {
  it("exposes exactly 6 AI subscription SKUs with monthly credits", () => {
    const subs = AI_PLANS.filter((p) => p.kind === "ai_subscription");
    expect(subs).toHaveLength(6);
    const codes = subs.map((p) => p.code).sort();
    expect(codes).toEqual([
      "ai_pro_12m",
      "ai_pro_1m",
      "ai_pro_max_12m",
      "ai_pro_max_1m",
      "ai_starter_12m",
      "ai_starter_1m",
    ]);
    for (const plan of subs) {
      expect(plan.aiCredits).toBeDefined();
      expect(plan.aiCredits! > 0n).toBe(true);
    }
  });

  it("exposes exactly 3 PAYG credit SKUs", () => {
    const payg = AI_PLANS.filter((p) => p.kind === "ai_credits");
    expect(payg).toHaveLength(3);
    expect(payg.map((p) => p.code).sort()).toEqual([
      "ai_credits_l",
      "ai_credits_m",
      "ai_credits_s",
    ]);
    expect(payg.find((p) => p.code === "ai_credits_s")!.aiCredits).toBe(750_000n);
    expect(payg.find((p) => p.code === "ai_credits_m")!.aiCredits).toBe(2_500_000n);
    expect(payg.find((p) => p.code === "ai_credits_l")!.aiCredits).toBe(9_000_000n);
  });

  it("12-month variants are 10% cheaper per month", () => {
    const starter1m = AI_PLANS.find((p) => p.code === "ai_starter_1m")!;
    const starter12m = AI_PLANS.find((p) => p.code === "ai_starter_12m")!;
    expect(starter12m.priceMonthlyIdr).toBe(Math.round(starter1m.priceMonthlyIdr * 0.9));

    const pro1m = AI_PLANS.find((p) => p.code === "ai_pro_1m")!;
    const pro12m = AI_PLANS.find((p) => p.code === "ai_pro_12m")!;
    expect(pro12m.priceMonthlyIdr).toBe(Math.round(pro1m.priceMonthlyIdr * 0.9));
  });

  it("every plan has an explicit kind (no implicit social)", () => {
    for (const plan of ALL_PLANS) {
      expect(["social", "ai_subscription", "ai_credits"]).toContain(plan.kind);
    }
    // social plans are exactly the original DEFAULT_PLANS
    expect(DEFAULT_PLANS.every((p) => p.kind === "social")).toBe(true);
    expect(ALL_PLANS).toHaveLength(DEFAULT_PLANS.length + AI_PLANS.length);
  });

  it("AI subscription credits match tier entitlements", () => {
    expect(AI_PLANS.find((p) => p.code === "ai_starter_1m")!.aiCredits).toBe(1_000_000n);
    expect(AI_PLANS.find((p) => p.code === "ai_pro_1m")!.aiCredits).toBe(5_000_000n);
    expect(AI_PLANS.find((p) => p.code === "ai_pro_max_1m")!.aiCredits).toBe(25_000_000n);
  });
});

// --- Fase 2.2: idempotent fulfillment helpers (mocked transaction) ---

vi.mock("@/lib/db", () => {
  const ledgerUpsert = vi.fn();
  const ledgerFindFirst = vi.fn();
  const ledgerFindUnique = vi.fn();
  const ledgerCreate = vi.fn();
  const ledgerAggregate = vi.fn();
  const subUpsert = vi.fn();
  const subFindUnique = vi.fn();
  const subUpdate = vi.fn();
  return {
    db: {
      aiCreditLedger: {
        upsert: ledgerUpsert,
        findFirst: ledgerFindFirst,
        findUnique: ledgerFindUnique,
        create: ledgerCreate,
        aggregate: ledgerAggregate,
      },
      workspaceAiSubscription: {
        upsert: subUpsert,
        findUnique: subFindUnique,
        update: subUpdate,
      },
      __ledgerUpsert: ledgerUpsert,
      __ledgerFindFirst: ledgerFindFirst,
      __ledgerFindUnique: ledgerFindUnique,
      __ledgerCreate: ledgerCreate,
      __ledgerAggregate: ledgerAggregate,
      __subUpsert: subUpsert,
      __subFindUnique: subFindUnique,
      __subUpdate: subUpdate,
    },
  };
});

import {
  fulfillAiCreditsOrder,
  fulfillAiSubscriptionOrder,
  refundAiOrder,
} from "@/lib/ai/billing";
import { db } from "@/lib/db";

const mock = db as unknown as {
  __ledgerUpsert: ReturnType<typeof vi.fn>;
  __ledgerFindFirst: ReturnType<typeof vi.fn>;
  __ledgerFindUnique: ReturnType<typeof vi.fn>;
  __ledgerCreate: ReturnType<typeof vi.fn>;
  __ledgerAggregate: ReturnType<typeof vi.fn>;
  __subUpsert: ReturnType<typeof vi.fn>;
  __subFindUnique: ReturnType<typeof vi.fn>;
  __subUpdate: ReturnType<typeof vi.fn>;
};

// The fulfillment helpers take a `tx`; we pass the mocked db directly.
const tx = db as never;

beforeEach(() => {
  vi.clearAllMocks();
  mock.__ledgerFindFirst.mockResolvedValue(null);
  mock.__ledgerFindUnique.mockResolvedValue(null);
  mock.__ledgerAggregate.mockResolvedValue({ _sum: { credits: null } });
});

describe("fulfillAiCreditsOrder", () => {
  it("grants PAYG credits with a stable operationId and 12-month expiry", async () => {
    const now = new Date("2026-09-02T00:00:00Z");
    await fulfillAiCreditsOrder(tx, {
      workspaceId: "ws_1",
      orderId: "ord_1",
      credits: 750_000n,
      now,
    });

    expect(mock.__ledgerUpsert).toHaveBeenCalledTimes(1);
    const arg = mock.__ledgerUpsert.mock.calls[0][0];
    expect(arg.where.operationId).toBe("order:ord_1:grant");
    expect(arg.create.kind).toBe("grant");
    expect(arg.create.credits).toBe(750_000n);
    expect(arg.create.sourceOrderId).toBe("ord_1");
    expect(arg.create.expiresAt.getTime()).toBe(now.getTime() + 365 * 24 * 3600 * 1000);
    expect(arg.update).toEqual({}); // retry = no-op
  });

  it("skips zero-credit orders", async () => {
    await fulfillAiCreditsOrder(tx, {
      workspaceId: "ws_1",
      orderId: "ord_0",
      credits: 0n,
      now: new Date(),
    });
    expect(mock.__ledgerUpsert).not.toHaveBeenCalled();
  });
});

describe("fulfillAiSubscriptionOrder", () => {
  it("upserts an active subscription with a monthly quota window inside a 12m term", async () => {
    const now = new Date("2026-09-02T00:00:00Z");
    await fulfillAiSubscriptionOrder(tx, {
      workspaceId: "ws_1",
      orderId: "ord_sub",
      planCode: "ai_pro_12m",
      durationMonths: 12,
      monthlyCredits: 5_000_000n,
      now,
    });

    expect(mock.__subUpsert).toHaveBeenCalledTimes(1);
    const arg = mock.__subUpsert.mock.calls[0][0];
    expect(arg.create.tier).toBe("pro");
    expect(arg.create.monthlyCredits).toBe(5_000_000n);
    expect(arg.create.sourceOrderId).toBe("ord_sub");
    // Term is 12 months; quota period is 1 month.
    expect(arg.create.termEnd.getTime() - arg.create.termStart.getTime()).toBeGreaterThan(
      300 * 24 * 3600 * 1000,
    );
    expect(
      arg.create.quotaPeriodEnd.getTime() - arg.create.quotaPeriodStart.getTime(),
    ).toBeLessThan(32 * 24 * 3600 * 1000);
  });

  it("ignores duplicate-order replays (unique sourceOrderId)", async () => {
    mock.__subUpsert.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );
    await expect(
      fulfillAiSubscriptionOrder(tx, {
        workspaceId: "ws_1",
        orderId: "ord_dup",
        planCode: "ai_starter_1m",
        durationMonths: 1,
        monthlyCredits: 1_000_000n,
        now: new Date(),
      }),
    ).resolves.toBeUndefined();
  });

  it("rethrows non-uniqueness errors", async () => {
    mock.__subUpsert.mockRejectedValueOnce(new Error("connection reset"));
    await expect(
      fulfillAiSubscriptionOrder(tx, {
        workspaceId: "ws_1",
        orderId: "ord_err",
        planCode: "ai_pro_1m",
        durationMonths: 1,
        monthlyCredits: 5_000_000n,
        now: new Date(),
      }),
    ).rejects.toThrow("connection reset");
  });
});

describe("refundAiOrder", () => {
  it("deactivates the AI subscription sourced from the order", async () => {
    mock.__subFindUnique.mockResolvedValueOnce({ id: "sub_1", status: "active" });
    const now = new Date();
    const result = await refundAiOrder(tx, {
      workspaceId: "ws_1",
      orderId: "ord_sub",
      now,
    });
    expect(result.reversed).toBe(true);
    expect(mock.__subUpdate).toHaveBeenCalledTimes(1);
    expect(mock.__subUpdate.mock.calls[0][0].data.status).toBe("canceled");
  });

  it("reverses only the unspent part of a PAYG grant", async () => {
    mock.__subFindUnique.mockResolvedValueOnce(null);
    // grant row exists
    mock.__ledgerFindUnique
      .mockResolvedValueOnce({
        id: "led_g",
        credits: 750_000n,
        createdAt: new Date("2026-08-01T00:00:00Z"),
      }) // grant lookup
      .mockResolvedValueOnce(null); // existing refund lookup
    mock.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: -200_000n } }); // spent

    const result = await refundAiOrder(tx, {
      workspaceId: "ws_1",
      orderId: "ord_payg",
      now: new Date(),
    });

    expect(result.reversed).toBe(true);
    expect(mock.__ledgerCreate).toHaveBeenCalledTimes(1);
    const row = mock.__ledgerCreate.mock.calls[0][0];
    expect(row.data.kind).toBe("refund");
    expect(row.data.credits).toBe(-(750_000n - 200_000n));
    expect(row.data.operationId).toBe("order:ord_payg:refund");
  });

  it("is a no-op when already refunded", async () => {
    mock.__subFindUnique.mockResolvedValueOnce(null);
    mock.__ledgerFindUnique
      .mockResolvedValueOnce({ id: "led_g", credits: 750_000n, createdAt: new Date() })
      .mockResolvedValueOnce({ id: "led_r" }); // refund already exists

    const result = await refundAiOrder(tx, {
      workspaceId: "ws_1",
      orderId: "ord_payg",
      now: new Date(),
    });
    expect(result.reversed).toBe(false);
    expect(mock.__ledgerCreate).not.toHaveBeenCalled();
  });
});
