export type PlanCode = "starter_1m" | "growth_6m" | "scale_12m" | string;

export type CatalogPlan = {
  code: PlanCode;
  name: string;
  description: string;
  interval: "month" | "months_6" | "months_12";
  durationMonths: number;
  /** Full commitment price in IDR (what Midtrans charges). */
  priceIdr: number;
  /** Effective monthly rate for marketing display (priceIdr / durationMonths). */
  priceMonthlyIdr: number;
  monthlySendLimit: number;
  monthlyPublishLimit: number;
  maxSocialAccounts: number;
  sortOrder: number;
};

/**
 * Single commercial source of truth for checkout + marketing.
 * Effective monthly rates: Rp499k / Rp399k / Rp299k.
 */
export const DEFAULT_PLANS: CatalogPlan[] = [
  {
    code: "starter_1m",
    name: "Starter 1 Month",
    description: "For teams validating social ops workflows.",
    interval: "month",
    durationMonths: 1,
    priceIdr: 499_000,
    priceMonthlyIdr: 499_000,
    monthlySendLimit: 3_000,
    monthlyPublishLimit: 300,
    maxSocialAccounts: 10,
    sortOrder: 1,
  },
  {
    code: "growth_6m",
    name: "Growth 6 Months",
    description: "Lower monthly rate for growing operators.",
    interval: "months_6",
    durationMonths: 6,
    priceIdr: 2_394_000,
    priceMonthlyIdr: 399_000,
    monthlySendLimit: 10_000,
    monthlyPublishLimit: 1_000,
    maxSocialAccounts: 40,
    sortOrder: 2,
  },
  {
    code: "scale_12m",
    name: "Scale 12 Months",
    description: "Best value for enterprise-scale automation.",
    interval: "months_12",
    durationMonths: 12,
    priceIdr: 3_588_000,
    priceMonthlyIdr: 299_000,
    monthlySendLimit: 30_000,
    monthlyPublishLimit: 3_000,
    maxSocialAccounts: 100,
    sortOrder: 3,
  },
];

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function computeVoucherDiscount(input: {
  subtotalIdr: number;
  type: "percent" | "fixed";
  value: number;
}): number {
  if (input.subtotalIdr <= 0) return 0;
  if (input.type === "percent") {
    const raw = Math.floor((input.subtotalIdr * Math.min(Math.max(input.value, 0), 100)) / 100);
    return Math.min(raw, input.subtotalIdr);
  }
  return Math.min(Math.max(input.value, 0), input.subtotalIdr);
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}
