import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * P0.2 — atomic reservation: balance check + debit happen in one locked
 * transaction so concurrent calls can never overdraw; reservations are
 * released (not charged) when the upstream call fails.
 */

vi.mock("@/lib/db", () => {
  const ledgerFindUnique = vi.fn();
  const ledgerCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "led_x",
    ...data,
  }));
  const ledgerAggregate = vi.fn();
  const subFindUnique = vi.fn();
  const usageFindUnique = vi.fn(async () => null);
  const usageCreate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "evt_x",
    ...data,
  }));
  const balanceUpsert = vi.fn(async () => ({}));
  const executeRaw = vi.fn(async () => 1);

  const tx = {
    aiCreditLedger: {
      findUnique: ledgerFindUnique,
      create: ledgerCreate,
      aggregate: ledgerAggregate,
      findFirst: vi.fn(async () => null),
    },
    aiUsageEvent: { findUnique: usageFindUnique, create: usageCreate },
    workspaceAiSubscription: { findUnique: subFindUnique },
    workspaceAiBalance: { upsert: balanceUpsert },
    $executeRaw: executeRaw,
  };

  return {
    db: {
      ...tx,
      $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
      __ledgerFindUnique: ledgerFindUnique,
      __ledgerCreate: ledgerCreate,
      __ledgerAggregate: ledgerAggregate,
      __subFindUnique: subFindUnique,
      __usageFindUnique: usageFindUnique,
      __usageCreate: usageCreate,
      __executeRaw: executeRaw,
    },
  };
});

import {
  reserveAiCredits,
  releaseAiReservation,
  recordAiUsage,
} from "@/lib/ai/billing";
import { db } from "@/lib/db";

const mock = db as unknown as {
  __ledgerFindUnique: ReturnType<typeof vi.fn>;
  __ledgerCreate: ReturnType<typeof vi.fn>;
  __ledgerAggregate: ReturnType<typeof vi.fn>;
  __subFindUnique: ReturnType<typeof vi.fn>;
  __usageFindUnique: ReturnType<typeof vi.fn>;
  __usageCreate: ReturnType<typeof vi.fn>;
  __executeRaw: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.__ledgerFindUnique.mockResolvedValue(null);
  mock.__usageFindUnique.mockResolvedValue(null);
  mock.__subFindUnique.mockResolvedValue(null);
  mock.__ledgerAggregate.mockResolvedValue({ _sum: { credits: null } });
});

describe("reserveAiCredits", () => {
  it("takes an advisory lock and writes a reservation row when balance suffices", async () => {
    // PAYG balance = 1000
    mock.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: 1_000n } });

    const opId = await reserveAiCredits({
      workspaceId: "ws_1",
      source: "payg",
      amount: 500n,
      requestId: "req_1",
    });

    expect(opId).toBe("rsv:req_1");
    expect(mock.__executeRaw).toHaveBeenCalled(); // pg_advisory_xact_lock
    const row = mock.__ledgerCreate.mock.calls[0][0];
    expect(row.data.kind).toBe("reservation");
    expect(row.data.credits).toBe(-500n);
    expect(row.data.operationId).toBe("rsv:req_1");
  });

  it("returns null when balance is insufficient (fail-closed, no overdraw)", async () => {
    mock.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: 100n } });

    const opId = await reserveAiCredits({
      workspaceId: "ws_1",
      source: "payg",
      amount: 500n,
      requestId: "req_2",
    });

    expect(opId).toBeNull();
    expect(mock.__ledgerCreate).not.toHaveBeenCalled();
  });

  it("is idempotent: a retry returns the existing operationId without re-reserving", async () => {
    mock.__ledgerFindUnique.mockResolvedValueOnce({ operationId: "rsv:req_3" });

    const opId = await reserveAiCredits({
      workspaceId: "ws_1",
      source: "payg",
      amount: 500n,
      requestId: "req_3",
    });

    expect(opId).toBe("rsv:req_3");
    expect(mock.__ledgerCreate).not.toHaveBeenCalled();
    expect(mock.__ledgerAggregate).not.toHaveBeenCalled(); // never re-checked balance
  });

  it("writes the funding bucket (source) on the reservation row", async () => {
    // subscription path: currentSourceBalance reads sub + subscriptionUsed aggregate
    mock.__subFindUnique.mockResolvedValueOnce({
      monthlyCredits: 1_000_000n,
      quotaPeriodStart: new Date("2026-09-01T00:00:00Z"),
    });
    mock.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: -100n } }); // used=100
    await reserveAiCredits({
      workspaceId: "ws_1",
      source: "subscription",
      amount: 1000n,
      requestId: "req_sub",
    });
    const row = mock.__ledgerCreate.mock.calls[0][0];
    expect(row.data.source).toBe("subscription");
  });
});

describe("bucket scoping (double-count regression)", () => {
  it("payg balance sum excludes subscription-bucket reservations", async () => {
    // The aggregate for a PAYG reservation must filter to source payg-or-null
    // so a subscription reservation can't reduce the PAYG balance. We assert
    // the query shape that currentSourceBalance → paygBalance issues.
    // (PAYG path never reads the subscription row — no need to mock it, and
    // mocking it would leak a stale Once into the next test.)
    mock.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: 1_000n } });

    await reserveAiCredits({
      workspaceId: "ws_1",
      source: "payg",
      amount: 100n,
      requestId: "req_scope",
    });

    const arg = mock.__ledgerAggregate.mock.calls[0][0];
    // bucket filter present: source is null (grants) OR payg
    expect(JSON.stringify(arg.where)).toContain('"payg"');
    expect(arg.where.OR).toEqual([{ source: null }, { source: "payg" }]);
  });

  it("subscription usage sum is scoped to source=subscription", async () => {
    mock.__subFindUnique.mockResolvedValueOnce({
      monthlyCredits: 1_000_000n,
      quotaPeriodStart: new Date("2026-09-01T00:00:00Z"),
    });
    mock.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: -100n } });

    await reserveAiCredits({
      workspaceId: "ws_1",
      source: "subscription",
      amount: 100n,
      requestId: "req_scope2",
    });

    const arg = mock.__ledgerAggregate.mock.calls[0][0];
    expect(arg.where.source).toBe("subscription");
  });
});

describe("releaseAiReservation", () => {
  it("adds back the reserved amount as a reservation_release", async () => {
    mock.__ledgerFindUnique
      .mockResolvedValueOnce({ credits: -500n }) // reservation
      .mockResolvedValueOnce(null); // no existing release

    await releaseAiReservation({ workspaceId: "ws_1", requestId: "req_1" });

    const row = mock.__ledgerCreate.mock.calls[0][0];
    expect(row.data.kind).toBe("reservation_release");
    expect(row.data.credits).toBe(500n);
    expect(row.data.operationId).toBe("rls:req_1");
  });

  it("does nothing when there is no reservation", async () => {
    mock.__ledgerFindUnique.mockResolvedValueOnce(null);
    await releaseAiReservation({ workspaceId: "ws_1", requestId: "req_none" });
    expect(mock.__ledgerCreate).not.toHaveBeenCalled();
  });
});

describe("recordAiUsage settles the reservation", () => {
  it("releases the reservation then debits actual usage", async () => {
    // Settlement clamp reads paygBalance → ample balance (covers the 150 charge).
    mock.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: 1_000n } });
    // reservation exists
    mock.__ledgerFindUnique
      .mockResolvedValueOnce({ credits: -800n, source: "payg" }) // rsv lookup
      .mockResolvedValueOnce(null); // rls lookup

    await recordAiUsage({
      workspaceId: "ws_1",
      source: "payg",
      model: "gpt-4o",
      inputTokens: 100,
      outputTokens: 50,
      requestId: "req_1",
    });

    const kinds = mock.__ledgerCreate.mock.calls.map((c) => c[0].data.kind);
    expect(kinds).toContain("reservation_release");
    expect(kinds).toContain("payg_use");
    const release = mock.__ledgerCreate.mock.calls.find(
      (c) => c[0].data.kind === "reservation_release",
    )![0];
    expect(release.data.credits).toBe(800n); // add back the full reservation
    const use = mock.__ledgerCreate.mock.calls.find((c) => c[0].data.kind === "payg_use")![0];
    expect(use.data.credits).toBe(-150n); // actual cost only
  });

  it("charges held credits plus unreserved balance without undercharging", async () => {
    // 100 granted, 80 reserved: current available balance is only 20.
    mock.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: 20n } });
    mock.__ledgerFindUnique
      .mockResolvedValueOnce({ credits: -80n, source: "payg" })
      .mockResolvedValueOnce(null);

    const result = await recordAiUsage({
      workspaceId: "ws_1", source: "payg", model: "gpt-4o",
      inputTokens: 70, outputTokens: 20, requestId: "req_reserved",
    });

    expect(result.creditsUsed).toBe(90n);
    expect(mock.__usageCreate.mock.calls[0][0].data.creditsUsed).toBe(90n);
    expect(mock.__ledgerCreate.mock.calls.find((c) => c[0].data.kind === "payg_use")![0].data.credits).toBe(-90n);
  });

  it("is a no-op on a retried call with the same requestId", async () => {
    mock.__usageFindUnique.mockResolvedValueOnce({ id: "evt_existing" });

    await recordAiUsage({
      workspaceId: "ws_1",
      source: "payg",
      model: "gpt-4o",
      inputTokens: 100,
      outputTokens: 50,
      requestId: "req_dup",
    });

    expect(mock.__usageCreate).not.toHaveBeenCalled();
    expect(mock.__ledgerCreate).not.toHaveBeenCalled();
  });

  it("CLAMPS the debit to the available balance when actual tokens exceed it (never goes negative)", async () => {
    // Balance only 80 but actual usage is 150 — charge must clamp to 80.
    mock.__ledgerAggregate.mockResolvedValueOnce({ _sum: { credits: 80n } });
    mock.__ledgerFindUnique.mockResolvedValue(null); // no reservation rows

    const result = await recordAiUsage({
      workspaceId: "ws_1",
      source: "payg",
      model: "gpt-4o",
      inputTokens: 100,
      outputTokens: 50,
      requestId: "req_clamp",
    });

    const use = mock.__ledgerCreate.mock.calls.find((c) => c[0].data.kind === "payg_use")![0];
    expect(use.data.credits).toBe(-80n); // clamped, not -150
    expect(result.creditsUsed).toBe(80n);
    // The usage event still records true tokens (analytics), but charged credits clamp.
    const evt = mock.__usageCreate.mock.calls[0][0];
    expect(evt.data.inputTokens).toBe(100);
    expect(evt.data.creditsUsed).toBe(80n);
  });
});
