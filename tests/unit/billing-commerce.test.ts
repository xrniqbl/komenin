import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { computeVoucherDiscount, formatIdr } from "@/lib/billing/catalog";
import { verifyMidtransSignature } from "@/lib/billing/midtrans";

describe("billing commerce", () => {
  it("computes percent and fixed voucher discounts", () => {
    expect(computeVoucherDiscount({ subtotalIdr: 100000, type: "percent", value: 10 })).toBe(10000);
    expect(computeVoucherDiscount({ subtotalIdr: 100000, type: "fixed", value: 25000 })).toBe(25000);
    expect(computeVoucherDiscount({ subtotalIdr: 100000, type: "fixed", value: 250000 })).toBe(100000);
  });

  it("formats IDR", () => {
    expect(formatIdr(499000)).toMatch(/499/);
  });

  it("verifies midtrans signature", () => {
    const orderId = "KMN-1";
    const statusCode = "200";
    const grossAmount = "499000.00";
    const serverKey = "SB-Mid-server-xxx";
    const signatureKey = createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest("hex");
    expect(
      verifyMidtransSignature({
        orderId,
        statusCode,
        grossAmount,
        signatureKey,
        serverKey,
      }),
    ).toBe(true);
  });

  it("rejects invalid midtrans signatures", () => {
    expect(
      verifyMidtransSignature({
        orderId: "KMN-1",
        statusCode: "200",
        grossAmount: "499000.00",
        signatureKey: "deadbeef",
        serverKey: "SB-Mid-server-xxx",
      }),
    ).toBe(false);
  });
});
