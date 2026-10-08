import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseMidtransGrossAmount } from "@/lib/billing/amount";
import { refundAiOrderPartial } from "@/lib/ai/billing";
import { refundPaidOrderTx } from "@/server/billing";

const REFUND_STATUSES = new Set(["partial_refund", "refund", "chargeback"]);
const REVIEW = "needs_review";

type Payload = Record<string, unknown>;
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function refundAmount(payload: Payload): number | null {
  return parseMidtransGrossAmount(payload.refund_amount);
}
function eventKey(payload: Payload): string {
  const status = text(payload.transaction_status)?.toLowerCase() ?? "unknown";
  const id = text(payload.refund_key) ?? text(payload.refund_id);
  // transaction_id identifies the original charge on some Midtrans notifications,
  // NOT a particular partial refund. Never infer a partial event identity from it.
  const identity = id
    ? `${text(payload.order_id) ?? ""}:${status}:${id}`
    : JSON.stringify(Object.keys(payload).sort().map((key) => [key, payload[key]]));
  return createHash("sha256").update(identity).digest("hex");
}

/** Durable signed receipt first; only then attempt local accounting. A replay reuses the same receipt. */
export async function reconcileRefundNotification(payload: Payload) {
  const status = text(payload.transaction_status)?.toLowerCase() ?? "unknown";
  if (!REFUND_STATUSES.has(status)) throw new Error("Not a refund notification");
  const key = eventKey(payload);
  let receipt = await db.refundReconciliation.findUnique({ where: { eventKey: key } });
  if (!receipt) {
    const orderCode = text(payload.order_id);
    const order = orderCode ? await db.subscriptionOrder.findFirst({
      where: { OR: [{ orderCode }, { midtransOrderId: orderCode }] },
      select: { id: true },
    }) : null;
    try {
      receipt = await db.refundReconciliation.create({ data: {
        eventKey: key,
        orderId: order?.id ?? null,
        transactionStatus: status,
        refundAmountIdr: status === "partial_refund" ? refundAmount(payload) : null,
        payload: payload as Prisma.InputJsonValue,
        state: "pending",
      } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") &&
          !(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error;
      receipt = await db.refundReconciliation.findUniqueOrThrow({ where: { eventKey: key } });
    }
  }
  return processRefundReceipt(receipt.id);
}

/** Revisit receipts delivered before the charge settled, outside the paid transaction.
 * Failures stay durable for admin review; they must never roll back settlement. */
export async function replayRefundsAfterSettlement(orderId: string) {
  try {
    const receipts = await db.refundReconciliation.findMany({
      where: { orderId, state: { in: ["pending", REVIEW] } },
      select: { id: true }, orderBy: { createdAt: "asc" },
    });
    for (const receipt of receipts) {
      try {
        await processRefundReceipt(receipt.id);
      } catch (error) {
        console.error("Refund receipt replay failed; retained for review", receipt.id, error);
      }
    }
  } catch (error) {
    console.error("Refund receipt replay lookup failed; retained for review", orderId, error);
  }
}

/** Retry only accounting for an existing receipt; never initiates a Midtrans refund. */
export async function processRefundReceipt(id: string) {
  return db.$transaction(async (tx) => {
    // Receipt row lock serializes a replay (including the first delivery).
    await tx.$executeRaw`SELECT id FROM "RefundReconciliation" WHERE id = ${id} FOR UPDATE`;
    const receipt = await tx.refundReconciliation.findUniqueOrThrow({ where: { id } });
    if (receipt.state === "applied" || receipt.state === "resolved") return receipt;
    const payload = receipt.payload as Payload;
    const status = receipt.transactionStatus;
    const originalCode = text(payload.order_id);
    const match = originalCode ? await tx.subscriptionOrder.findFirst({
      where: { OR: [{ orderCode: originalCode }, { midtransOrderId: originalCode }] },
      select: { id: true },
    }) : null;
    if (receipt.orderId && (!match || match.id !== receipt.orderId)) {
      return tx.refundReconciliation.update({ where: { id }, data: {
        state: REVIEW, reason: "Receipt order binding does not match", attemptCount: { increment: 1 },
      } });
    }
    const order = receipt.orderId ? await tx.subscriptionOrder.findUnique({ where: { id: receipt.orderId } }) : null;
    const review = async (reason: string) => tx.refundReconciliation.update({
      where: { id }, data: { state: REVIEW, reason, attemptCount: { increment: 1 } },
    });
    if (!order) return review("Order not found");
    // All refund events for one order must see each other's committed totals.
    await tx.$executeRaw`SELECT id FROM "SubscriptionOrder" WHERE id = ${order.id} FOR UPDATE`;
    const current = await tx.subscriptionOrder.findUniqueOrThrow({ where: { id: order.id } });
    if (parseMidtransGrossAmount(payload.gross_amount) !== current.totalIdr) {
      return review("Original charge amount missing or does not match order");
    }
    const previous = await tx.refundReconciliation.findMany({
      where: { orderId: current.id, state: "applied", transactionStatus: "partial_refund" },
      select: { refundAmountIdr: true },
    });
    const refunded = previous.reduce((sum, item) => sum + (item.refundAmountIdr ?? 0), 0);
    if (status === "partial_refund") {
      const amount = receipt.refundAmountIdr;
      if (!text(payload.refund_key) && !text(payload.refund_id)) return review("Missing unique partial refund identifier");
      if (amount == null || amount <= 0) return review("Invalid partial refund amount");
      if (current.status !== "paid") return review(`Cannot partially refund ${current.status} order`);
      if (refunded + amount > current.totalIdr) return review("Cumulative refund exceeds order total");
      await refundAiOrderPartial(tx, {
        workspaceId: current.workspaceId, orderId: current.id,
        refundAmountIdr: amount, orderTotalIdr: current.totalIdr,
        transactionId: text(payload.refund_key) ?? text(payload.refund_id), now: new Date(),
      });
    } else {
      if (current.status !== "paid" && current.status !== "refunded") return review(`Cannot refund ${current.status} order`);
      if (current.status === "paid") {
        // Midtrans full refund after partials represents the remainder. If the
        // gateway reports its amount explicitly, reject contradictory totals.
        const amount = refundAmount(payload);
        if (refunded > 0 && amount === null) return review("Full refund after partials requires explicit remaining amount");
        if (amount !== null && refunded + amount !== current.totalIdr) return review("Full refund amount conflicts with prior partials");
        await refundPaidOrderTx(tx, {
          orderId: current.id,
          paymentType: text(payload.payment_type), midtransTxnId: text(payload.transaction_id),
        });
      }
    }
    return tx.refundReconciliation.update({
      where: { id }, data: { state: "applied", reason: null, attemptCount: { increment: 1 } },
    });
  });
}
