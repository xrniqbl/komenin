import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const subFindMany = vi.fn();
  const subUpdateMany = vi.fn();
  const ledgerFindMany = vi.fn();
  const ledgerFindUnique = vi.fn();
  const ledgerAggregate = vi.fn();
  const ledgerCreate = vi.fn();
  return {
    db: {
      workspaceAiSubscription: {
        findMany: subFindMany,
        updateMany: subUpdateMany,
      },
      aiCreditLedger: {
        findMany: ledgerFindMany,
        findUnique: ledgerFindUnique,
        aggregate: ledgerAggregate,
        create: ledgerCreate,
      },
      workspaceAiBalance: {
        upsert: vi.fn(async () => ({})),
        findUnique: vi.fn(async () => null),
      },
      __subFindMany: subFindMany,
      __subUpdateMany: subUpdateMany,
      __ledgerFindMany: ledgerFindMany,
      __ledgerFindUnique: ledgerFindUnique,
      __ledgerAggregate: ledgerAggregate,
      __ledgerCreate: ledgerCreate,
    },
  };
});

import { runAiExpiryAndRenewal } from "@/lib/ai/billing";
import { db } from "@/lib/db";

const mock = db as unknown as {
  __subFindMany: ReturnType<typeof vi.fn>;
  __subUpdateMany: ReturnType<typeof vi.fn>;
  __ledgerFindMany: ReturnType<typeof vi.fn>;
  __ledgerFindUnique: ReturnType<typeof vi.fn>;
  __ledgerAggregate: ReturnType<typeof vi.fn>;
  __ledgerCreate: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.__subFindMany.mockResolvedValue([]);
  mock.__subUpdateMany.mockResolvedValue({ count: 1 });
  mock.__ledgerFindMany.mockResolvedValue([]);
  mock.__ledgerFindUnique.mockResolvedValue(null);
  mock.__ledgerAggregate.mockResolvedValue({ _sum: { credits: null } });
  mock.__ledgerCreate.mockResolvedValue({ id: "led_new" });
});

describe("runAiExpiryAndRenewal", () => {
  it("expires subscriptions whose term ended (idempotent via claim)", async () => {
    // First findMany (term expiry) returns a row; second (quota roll) empty.
    mock.__subFindMany
      .mockResolvedValueOnce([{ id: "sub_1" }]) // termEnd due
      .mockResolvedValueOnce([]); // quota roll due
    mock.__subUpdateMany.mockResolvedValueOnce({ count: 1 });

    const result = await runAiExpiryAndRenewal(new Date("2026-09-02T00:00:00Z"));
    expect(result.subExpired).toBe(1);
    expect(mock.__subUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "sub_1", status: "active" }),
        data: { status: "expired" },
      }),
    );
  });

  it("rolls the monthly quota window for active subs past quotaPeriodEnd", async () => {
    const now = new Date("2026-09-02T00:00:00Z");
    mock.__subFindMany
      .mockResolvedValueOnce([]) // no term expiry
      .mockResolvedValueOnce([
        {
          id: "sub_roll",
          quotaPeriodStart: new Date("2026-08-01T00:00:00Z"),
          quotaPeriodEnd: new Date("2026-09-01T00:00:00Z"),
          pendingTier: null,
          pendingMonthlyCredits: null,
        },
      ]);

    const result = await runAiExpiryAndRenewal(now);
    expect(result.quotaRenewed).toBe(1);
    const call = mock.__subUpdateMany.mock.calls[0][0];
    expect(call.data.quotaPeriodStart).toEqual(new Date("2026-09-01T00:00:00Z"));
    // quota window advances ~1 month forward
    expect(call.data.quotaPeriodEnd.getTime()).toBeGreaterThan(
      new Date("2026-09-01T00:00:00Z").getTime(),
    );
  });

  it("applies a queued tier change at the quota boundary (no proration)", async () => {
    mock.__subFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "sub_pending",
          quotaPeriodStart: new Date("2026-08-01T00:00:00Z"),
          quotaPeriodEnd: new Date("2026-09-01T00:00:00Z"),
          pendingTier: "pro",
          pendingMonthlyCredits: 5_000_000n,
        },
      ]);

    await runAiExpiryAndRenewal(new Date("2026-09-02T00:00:00Z"));
    const call = mock.__subUpdateMany.mock.calls[0][0];
    expect(call.data.tier).toBe("pro");
    expect(call.data.monthlyCredits).toBe(5_000_000n);
    expect(call.data.pendingTier).toBeNull();
  });

  it("materializes PAYG grant expiry for the unspent portion only", async () => {
    mock.__subFindMany.mockResolvedValue([]);
    mock.__ledgerFindMany.mockResolvedValueOnce([
      {
        id: "grant_1",
        workspaceId: "ws_1",
        credits: 750_000n,
        createdAt: new Date("2025-08-01T00:00:00Z"),
        expiresAt: new Date("2026-08-01T00:00:00Z"),
      },
    ]);
    mock.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: -300_000n } }); // spent

    const result = await runAiExpiryAndRenewal(new Date("2026-09-02T00:00:00Z"));
    expect(result.paygExpired).toBe(1);
    const row = mock.__ledgerCreate.mock.calls[0][0];
    expect(row.data.kind).toBe("expire");
    expect(row.data.credits).toBe(-(750_000n - 300_000n));
    expect(row.data.operationId).toBe("expire:grant_1");
  });

  it("skips PAYG expiry already processed (operationId dedup)", async () => {
    mock.__subFindMany.mockResolvedValue([]);
    mock.__ledgerFindMany.mockResolvedValueOnce([
      {
        id: "grant_done",
        workspaceId: "ws_1",
        credits: 750_000n,
        createdAt: new Date(),
        expiresAt: new Date("2026-08-01T00:00:00Z"),
      },
    ]);
    mock.__ledgerFindUnique.mockResolvedValueOnce({ id: "existing_expire" });

    const result = await runAiExpiryAndRenewal(new Date("2026-09-02T00:00:00Z"));
    expect(result.paygExpired).toBe(0);
    expect(mock.__ledgerCreate).not.toHaveBeenCalled();
  });
});
