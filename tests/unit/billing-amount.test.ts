import { describe, expect, it } from "vitest";
import {
  amountsMatchOrder,
  extractGrossAmount,
  parseMidtransGrossAmount,
} from "@/lib/billing/amount";

describe("billing amount binding", () => {
  it("parses Midtrans gross_amount strings to integer IDR", () => {
    expect(parseMidtransGrossAmount("499000.00")).toBe(499000);
    expect(parseMidtransGrossAmount("0")).toBe(0);
    expect(parseMidtransGrossAmount("2154600.00")).toBe(2154600);
    expect(parseMidtransGrossAmount("not-a-number")).toBeNull();
    expect(parseMidtransGrossAmount(undefined)).toBeNull();
  });

  it("matches notification amount to order total", () => {
    expect(amountsMatchOrder("499000.00", 499000)).toBe(true);
    expect(amountsMatchOrder("1.00", 499000)).toBe(false);
    expect(amountsMatchOrder(0, 0)).toBe(true);
    expect(amountsMatchOrder(null, 1000)).toBe(false);
  });

  it("extracts gross_amount from payload when present", () => {
    expect(extractGrossAmount({ gross_amount: "100.00" })).toBe("100.00");
    expect(extractGrossAmount({ free_order: true })).toBeUndefined();
    expect(extractGrossAmount(null)).toBeUndefined();
  });
});
