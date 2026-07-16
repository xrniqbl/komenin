import { createHash } from "node:crypto";

export type MidtransConfig = {
  isProduction: boolean;
  serverKey: string;
  clientKey: string;
  merchantId?: string;
};

export function getMidtransConfig(): MidtransConfig {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim() || "";
  const clientKey = process.env.MIDTRANS_CLIENT_KEY?.trim() || "";
  return {
    isProduction,
    serverKey,
    clientKey,
    merchantId: process.env.MIDTRANS_MERCHANT_ID?.trim() || undefined,
  };
}

export function midtransApiBase(isProduction: boolean): string {
  return isProduction
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
}

export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
  serverKey: string;
}): boolean {
  const payload = `${input.orderId}${input.statusCode}${input.grossAmount}${input.serverKey}`;
  const digest = createHash("sha512").update(payload).digest("hex");
  return digest === input.signatureKey;
}

export async function createMidtransSnapTransaction(input: {
  orderId: string;
  grossAmount: number;
  customer: { name?: string | null; email?: string | null };
  itemName: string;
  callbacksFinishUrl: string;
}): Promise<{ token: string; redirect_url: string }> {
  const config = getMidtransConfig();
  if (!config.serverKey) {
    // Sandbox-local fallback for development without Midtrans keys.
    return {
      token: `sim-snap-${input.orderId}`,
      redirect_url: `${input.callbacksFinishUrl}?order_id=${encodeURIComponent(input.orderId)}&sim=1`,
    };
  }

  const auth = Buffer.from(`${config.serverKey}:`).toString("base64");
  const response = await fetch(`${midtransApiBase(config.isProduction)}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: input.orderId,
        gross_amount: input.grossAmount,
      },
      item_details: [
        {
          id: input.orderId,
          price: input.grossAmount,
          quantity: 1,
          name: input.itemName.slice(0, 50),
        },
      ],
      customer_details: {
        first_name: input.customer.name || "Aether",
        email: input.customer.email || undefined,
      },
      callbacks: {
        finish: input.callbacksFinishUrl,
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    token?: string;
    redirect_url?: string;
    error_messages?: string[];
    status_message?: string;
  };

  if (!response.ok || !payload.token || !payload.redirect_url) {
    throw new Error(
      payload.error_messages?.join(", ") ||
        payload.status_message ||
        `Midtrans Snap failed (${response.status})`,
    );
  }

  return { token: payload.token, redirect_url: payload.redirect_url };
}
