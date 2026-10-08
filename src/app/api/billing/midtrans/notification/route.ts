import { NextResponse } from "next/server";
import { getMidtransConfig, verifyMidtransSignature } from "@/lib/billing/midtrans";
import { apiError } from "@/lib/api-errors";
import { applyPaidOrder } from "@/server/billing";
import { reconcileRefundNotification } from "@/server/refund-reconciliation";
import { isProductionRuntime } from "@/lib/security";
import { consumeRateLimit, getRequestRateKey } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Unauthenticated-by-design endpoint: parse work and PaymentEvent logging
  // must not be spammable before the signature check. 120/min/IP is far above
  // legitimate notification traffic. failClosed: an Upstash outage must not
  // open an unverified flood window against signature verification CPU.
  const rate = await consumeRateLimit({
    key: getRequestRateKey(request, "api:billing:midtrans:notification"),
    limit: 120,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rate.ok) {
    return apiError("RATE_LIMITED", 429);
  }

  // Malformed JSON can never become valid on retry — acknowledge with 400
  // so Midtrans does not retry it for hours (500 triggers retries).
  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return apiError("INVALID_JSON", 400);
  }
  const payload = rawPayload as {
    order_id?: string;
    status_code?: string;
    gross_amount?: string;
    signature_key?: string;
    transaction_status?: string;
    transaction_id?: string;
    payment_type?: string;
  };

  if (!payload.order_id) {
    return apiError("INVALID_INPUT", 400, "order_id required");
  }

  const config = getMidtransConfig();
  if (!config.serverKey) {
    return apiError("NOT_CONFIGURED", 503, "Midtrans server key is not configured");
  }
  if (isProductionRuntime() && !config.isProduction) {
    return apiError(
      "NOT_CONFIGURED",
      503,
      "MIDTRANS_IS_PRODUCTION must be true in production runtime",
    );
  }

  const signatureValid = verifyMidtransSignature({
    orderId: String(payload.order_id),
    statusCode: String(payload.status_code || ""),
    grossAmount: String(payload.gross_amount || ""),
    signatureKey: String(payload.signature_key || ""),
    serverKey: config.serverKey,
  });
  if (!signatureValid) {
    return apiError("INVALID_SIGNATURE", 401);
  }

  try {
    // Refunds need a durable signed receipt and a review state before we ACK.
    // Settlement's payment-event log does not provide refund-event idempotency.
    if (["refund", "chargeback", "partial_refund"].includes(String(payload.transaction_status).toLowerCase())) {
      const result = await reconcileRefundNotification(payload as Record<string, unknown>);
      return NextResponse.json({ ok: true, result });
    }
    const result = await applyPaidOrder(String(payload.order_id), {
      transactionId: payload.transaction_id,
      paymentType: payload.payment_type,
      transactionStatus: payload.transaction_status,
      payload,
      signatureValid: true,
      // Bind Midtrans gross_amount to order.totalIdr inside applyPaidOrder.
      expectedGrossAmount: payload.gross_amount,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notification failed";
    // Business-rule rejections are acknowledged (200) so Midtrans does not
    // retry them for hours — the payment event / audit log already records
    // them for manual reconciliation. Only true internal errors get 5xx so
    // Midtrans legitimately retries.
    const isDeterministicRejection =
      message.includes("amount mismatch") ||
      message.startsWith("Voucher ") ||
      message === "Order not found" ||
      message === "Payment signature invalid";
    if (isDeterministicRejection) {
      return NextResponse.json({ ok: false, error: message, code: "PAYMENT_REJECTED", acknowledged: true });
    }
    return apiError("INTERNAL_ERROR", 500, "Internal notification failure");
  }
}