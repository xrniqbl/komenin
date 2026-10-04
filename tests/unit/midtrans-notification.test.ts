/**
 * Midtrans notification route tests (sandbox-shaped)
 *
 * Exercises the HTTP handler directly with real sandbox-style payloads:
 * valid signature → order applied; invalid signature → 401; deterministic
 * business rejections → 200 acknowledged (no Midtrans retry storm).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

const applyPaidOrderMock = vi.fn();

vi.mock("@/server/billing", () => ({
  applyPaidOrder: (...args: unknown[]) => applyPaidOrderMock(...args),
}));

import { POST } from "@/app/api/billing/midtrans/notification/route";
import { getMidtransConfig } from "@/lib/billing/midtrans";

// Vitest auto-loads .env, which may carry a real MIDTRANS_SERVER_KEY.
// Sign against whatever key the route will actually use.
const SERVER_KEY = getMidtransConfig().serverKey || "SB-Mid-server-FALLBACK";

function sign(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey = SERVER_KEY,
): string {
  return createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");
}

function notificationPayload(over: Record<string, unknown> = {}) {
  const base = {
    order_id: "KMN-TEST-1",
    status_code: "200",
    gross_amount: "499000.00",
    transaction_status: "settlement",
    transaction_id: "txn-123",
    payment_type: "gopay",
  };
  const payload = { ...base, ...over };
  if ("signature_key" in over) {
    // Caller supplied an explicit (possibly invalid) signature — keep it
    return payload;
  }
  return {
    ...payload,
    signature_key: sign(
      String(payload.order_id),
      String(payload.status_code),
      String(payload.gross_amount),
    ),
  };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/billing/midtrans/notification", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("MIDTRANS_SERVER_KEY", SERVER_KEY);
  vi.stubEnv("MIDTRANS_IS_PRODUCTION", "false");
  vi.stubEnv("NODE_ENV", "test");
  applyPaidOrderMock.mockReset();
});afterEach(() => {
  vi.unstubAllEnvs();
});

describe("midtrans notification route", () => {
  it("accepts a correctly signed settlement and applies the order", async () => {
    applyPaidOrderMock.mockResolvedValue({ ok: true, orderCode: "KMN-TEST-1" });

    const res = await POST(request(notificationPayload()));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(applyPaidOrderMock).toHaveBeenCalledTimes(1);
    const [orderCode, context] = applyPaidOrderMock.mock.calls[0];
    expect(orderCode).toBe("KMN-TEST-1");
    expect(context.signatureValid).toBe(true);
    expect(context.transactionStatus).toBe("settlement");
    expect(context.expectedGrossAmount).toBe("499000.00");
  });

  it("rejects an invalid signature with 401 and never touches the order", async () => {
    const payload = notificationPayload({ signature_key: "0".repeat(128) });

    const res = await POST(request(payload));

    expect(res.status).toBe(401);
    expect(applyPaidOrderMock).not.toHaveBeenCalled();
  });

  it("rejects a signature computed with the wrong server key", async () => {
    const payload = notificationPayload({
      signature_key: sign("KMN-TEST-1", "200", "499000.00", "SB-Mid-server-OTHER"),
    });

    const res = await POST(request(payload));

    expect(res.status).toBe(401);
    expect(applyPaidOrderMock).not.toHaveBeenCalled();
  });

  it("returns 400 when order_id is missing", async () => {
    const res = await POST(request({ status_code: "200" }));

    expect(res.status).toBe(400);
    expect(applyPaidOrderMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the server key is not configured", async () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", "");

    const res = await POST(request(notificationPayload()));

    expect(res.status).toBe(503);
    expect(applyPaidOrderMock).not.toHaveBeenCalled();
  });

  it("acknowledges deterministic business rejections with 200 (no retry storm)", async () => {
    applyPaidOrderMock.mockRejectedValue(new Error("amount mismatch"));

    const res = await POST(request(notificationPayload()));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.acknowledged).toBe(true);
    expect(body.error).toMatch(/amount mismatch/);
  });

  it("returns 500 on unexpected failures so Midtrans retries", async () => {
    applyPaidOrderMock.mockRejectedValue(new Error("db connection lost"));

    const res = await POST(request(notificationPayload()));

    expect(res.status).toBe(500);
  });

  it("tampering with gross_amount invalidates the signature", async () => {
    // Attacker changes amount after signing
    const signed = notificationPayload();
    const tampered = { ...signed, gross_amount: "1000.00" };

    const res = await POST(request(tampered));

    expect(res.status).toBe(401);
    expect(applyPaidOrderMock).not.toHaveBeenCalled();
  });
});
