/**
 * Midtrans gross_amount helpers — bind notification amount to order total.
 */

/** Parse Midtrans gross_amount ("2154600.00") into integer IDR. */
export function parseMidtransGrossAmount(value: unknown): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  // Midtrans may send decimals; IDR orders are whole rupiah.
  return Math.round(n);
}

/** True when notification amount matches the order total in IDR. */
export function amountsMatchOrder(grossAmount: unknown, totalIdr: number): boolean {
  const parsed = parseMidtransGrossAmount(grossAmount);
  if (parsed == null) return false;
  return parsed === totalIdr;
}

/**
 * Extract gross_amount from a Midtrans-like payload if present.
 * Returns undefined when the field is absent (free/sim paths).
 */
export function extractGrossAmount(payload: unknown): unknown | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  if (!("gross_amount" in payload)) return undefined;
  return (payload as { gross_amount?: unknown }).gross_amount;
}
