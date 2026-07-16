import { NextResponse } from "next/server";
import { getMidtransConfig, verifyMidtransSignature } from "@/lib/billing/midtrans";
import { applyPaidOrder } from "@/server/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      order_id?: string;
      status_code?: string;
      gross_amount?: string;
      signature_key?: string;
      transaction_status?: string;
      transaction_id?: string;
      payment_type?: string;
    };

    if (!payload.order_id) {
      return NextResponse.json({ error: "order_id required" }, { status: 400 });
    }

    const config = getMidtransConfig();
    let signatureValid = true;
    if (config.serverKey) {
      signatureValid = verifyMidtransSignature({
        orderId: String(payload.order_id),
        statusCode: String(payload.status_code || ""),
        grossAmount: String(payload.gross_amount || ""),
        signatureKey: String(payload.signature_key || ""),
        serverKey: config.serverKey,
      });
      if (!signatureValid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const result = await applyPaidOrder(String(payload.order_id), {
      transactionId: payload.transaction_id,
      paymentType: payload.payment_type,
      transactionStatus: payload.transaction_status,
      payload,
      signatureValid,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Notification failed" },
      { status: 400 },
    );
  }
}
