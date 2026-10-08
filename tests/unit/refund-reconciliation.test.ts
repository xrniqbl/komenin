import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: new Map<string, Record<string, any>>(), onLock: null as null | (() => void), audit: vi.fn(), order: { id: "ord", workspaceId: "ws", userId: "user", subscriptionId: null, status: "paid", totalIdr: 1000 }, partial: vi.fn(async (..._args: any[]) => ({ creditsRefunded: 10n })), full: vi.fn(async (..._args: any[]) => ({})) }));
const { rows, partial, full } = state;
const refundRows = () => [...new Set(rows.values())];
vi.mock("@/lib/db", () => {
  const tx = {
    $executeRaw: vi.fn(async () => { state.onLock?.(); return 1; }),
    auditLog: { create: (...args: any[]) => state.audit(...args) },
    refundReconciliation: {
      create: vi.fn(async ({ data }: any) => { if (state.rows.has(data.eventKey)) throw { code: "P2002" }; const row = { id: `r${state.rows.size}`, state: "pending", attemptCount: 0, ...data }; state.rows.set(row.id, row); state.rows.set(data.eventKey, row); return row; }),
      findUnique: vi.fn(async ({ where }: any) => state.rows.get(where.id ?? where.eventKey) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }: any) => state.rows.get(where.id ?? where.eventKey) ?? null),
      findMany: vi.fn(async ({ where }: any) => refundRows().filter((r) => r.orderId === where.orderId && (typeof where.state === "string" ? r.state === where.state : where.state?.in?.includes(r.state)) && (!where.transactionStatus || r.transactionStatus === where.transactionStatus)).map((r) => where.select ? { id: r.id, refundAmountIdr: r.refundAmountIdr } : r)),
      update: vi.fn(async ({ where, data }: any) => { const row = state.rows.get(where.id)!; Object.assign(row, { ...data, attemptCount: row.attemptCount + 1 }); return row; }),
    },
    subscriptionOrder: { findFirst: vi.fn(async () => state.order), findUnique: vi.fn(async () => state.order), findUniqueOrThrow: vi.fn(async () => state.order) },
  };
  return { db: { ...tx, user: { findUnique: async () => ({ id: "admin", platformRole: "superadmin" }) }, $transaction: async (fn: any) => fn(tx) } };
});
vi.mock("@/lib/ai/billing", () => ({ refundAiOrderPartial: (...args: any[]) => partial(...args) }));
vi.mock("@/server/billing", () => ({ refundPaidOrderTx: (...args: any[]) => full(...args) }));
vi.mock("@/lib/auth", () => ({ auth: async () => ({ user: { id: "admin" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { adminReviewRefund } from "@/server/admin";
import { reconcileRefundNotification, replayRefundsAfterSettlement } from "@/server/refund-reconciliation";

const payload = (refund_key: string, amount = "600.00") => ({ order_id: "order-code", gross_amount: "1000.00", transaction_status: "partial_refund", transaction_id: "original-txn", refund_key, refund_amount: amount });

describe("refund reconciliation", () => {
  it("does not resolve a receipt applied after an admin's initial read", async () => {
    rows.clear(); state.audit.mockClear(); state.order.status = "pending";
    const receipt = await reconcileRefundNotification(payload("race"));
    state.onLock = () => { rows.get(receipt.id)!.state = "applied"; state.onLock = null; };
    await expect(adminReviewRefund(receipt.id, "resolve", "Manual review")).rejects.toThrow("Receipt already reviewed");
    expect(rows.get(receipt.id)?.state).toBe("applied");
    expect(state.audit).not.toHaveBeenCalled();
  });
  it("does not overwrite an applied receipt's state or reason during admin retry", async () => {
    rows.clear(); state.audit.mockClear(); state.order.status = "pending";
    const receipt = await reconcileRefundNotification(payload("retry-race"));
    state.order.status = "paid";
    await adminReviewRefund(receipt.id, "retry", "Checked after settlement");
    expect(rows.get(receipt.id)?.state).toBe("applied");
    expect(rows.get(receipt.id)?.reason).toBeNull();
    expect(state.audit).toHaveBeenCalledTimes(1);
  });
  it("replays an early partial refund after settlement exactly once", async () => {
    rows.clear(); partial.mockClear(); state.order.status = "pending";
    const early = await reconcileRefundNotification(payload("early"));
    expect(early.state).toBe("needs_review");
    expect(partial).not.toHaveBeenCalled();
    state.order.status = "paid";
    await replayRefundsAfterSettlement(state.order.id);
    expect(rows.get(early.id)?.state).toBe("applied");
    await replayRefundsAfterSettlement(state.order.id);
    expect(partial).toHaveBeenCalledTimes(1);
  });
  it("persists a receipt and applies an exact replay once", async () => {
    rows.clear(); partial.mockClear(); state.order.status = "paid";
    const first = await reconcileRefundNotification(payload("refund-1"));
    const again = await reconcileRefundNotification(payload("refund-1"));
    expect(first.state).toBe("applied");
    expect(again.state).toBe("applied");
    expect(partial).toHaveBeenCalledTimes(1);
  });
  it("sends cumulative over-refund to review without a second clawback", async () => {
    rows.clear(); partial.mockClear(); state.order.status = "paid";
    await reconcileRefundNotification(payload("refund-1"));
    const result = await reconcileRefundNotification(payload("refund-2"));
    expect(result.state).toBe("needs_review");
    expect(partial).toHaveBeenCalledTimes(1);
  });
  it("full refund after a partial needs an explicit matching remainder and replay does not refund twice", async () => {
    rows.clear(); partial.mockClear(); full.mockClear(); state.order.status = "paid";
    await reconcileRefundNotification(payload("refund-first", "400.00"));
    const fullPayload = { order_id: "order-code", gross_amount: "1000.00", transaction_status: "refund", refund_amount: "600.00", transaction_id: "original-txn" };
    expect((await reconcileRefundNotification(fullPayload)).state).toBe("applied");
    expect((await reconcileRefundNotification(fullPayload)).state).toBe("applied");
    expect(full).toHaveBeenCalledTimes(1);
  });
  it("reviews a full refund after partials when the remaining amount is not supplied", async () => {
    rows.clear(); partial.mockClear(); full.mockClear(); state.order.status = "paid";
    await reconcileRefundNotification(payload("refund-first", "400.00"));
    expect((await reconcileRefundNotification({ order_id: "order-code", gross_amount: "1000.00", transaction_status: "refund" })).state).toBe("needs_review");
    expect(full).not.toHaveBeenCalled();
  });
  it("keeps unidentifiable partial refunds for review without movement", async () => {
    rows.clear(); partial.mockClear(); state.order.status = "paid";
    const { refund_key: _, ...unknown } = payload("refund-1");
    expect((await reconcileRefundNotification(unknown)).state).toBe("needs_review");
    expect(partial).not.toHaveBeenCalled();
  });
});
