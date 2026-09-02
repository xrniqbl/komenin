export type PlanCode = "starter_1m" | "growth_6m" | "scale_12m" | string;

export type CatalogPlanKind =
  /** Paket sosial (send/publish) — existing plans. */
  | "social"
  /** Langganan Komenin AI (tier + kuota kredit bulanan). */
  | "ai_subscription"
  /** Kredit pay-as-you-go prabayar. */
  | "ai_credits";

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
  /** Persisted plan discriminator — always explicit. */
  kind: CatalogPlanKind;
  /** AI credits included per period (ai_subscription) or granted once (ai_credits). */
  aiCredits?: bigint;
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
    kind: "social",
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
    kind: "social",
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
    kind: "social",
  },
];

/**
 * Komenin AI add-on SKUs (owner-locked pricing 2026-08-27):
 * Starter Rp50k / Pro Rp150k / Pro Max Rp250k per month; 12-month
 * commitments get 10% off. PAYG credit packs never expire for 12 months.
 */
export const AI_PLANS: CatalogPlan[] = [
  {
    code: "ai_starter_1m",
    name: "Komenin AI Starter",
    description: "1 juta kredit AI/bulan. Model ekonomis untuk tim kecil.",
    interval: "month",
    durationMonths: 1,
    priceIdr: 50_000,
    priceMonthlyIdr: 50_000,
    monthlySendLimit: 0,
    monthlyPublishLimit: 0,
    maxSocialAccounts: 0,
    sortOrder: 11,
    kind: "ai_subscription",
    aiCredits: 1_000_000n,
  },
  {
    code: "ai_starter_12m",
    name: "Komenin AI Starter (12 bulan)",
    description: "1 juta kredit AI/bulan, hemat 10% dengan komitmen setahun.",
    interval: "months_12",
    durationMonths: 12,
    priceIdr: 540_000, // 50.000 × 12 × 0.9
    priceMonthlyIdr: 45_000,
    monthlySendLimit: 0,
    monthlyPublishLimit: 0,
    maxSocialAccounts: 0,
    sortOrder: 12,
    kind: "ai_subscription",
    aiCredits: 1_000_000n,
  },
  {
    code: "ai_pro_1m",
    name: "Komenin AI Pro",
    description: "5 juta kredit AI/bulan + model standar + priority queue.",
    interval: "month",
    durationMonths: 1,
    priceIdr: 150_000,
    priceMonthlyIdr: 150_000,
    monthlySendLimit: 0,
    monthlyPublishLimit: 0,
    maxSocialAccounts: 0,
    sortOrder: 13,
    kind: "ai_subscription",
    aiCredits: 5_000_000n,
  },
  {
    code: "ai_pro_12m",
    name: "Komenin AI Pro (12 bulan)",
    description: "5 juta kredit AI/bulan, hemat 10% dengan komitmen setahun.",
    interval: "months_12",
    durationMonths: 12,
    priceIdr: 1_620_000, // 150.000 × 12 × 0.9
    priceMonthlyIdr: 135_000,
    monthlySendLimit: 0,
    monthlyPublishLimit: 0,
    maxSocialAccounts: 0,
    sortOrder: 14,
    kind: "ai_subscription",
    aiCredits: 5_000_000n,
  },
  {
    code: "ai_pro_max_1m",
    name: "Komenin AI Pro Max",
    description: "25 juta kredit AI/bulan, semua model premium, lanjut otomatis ke PAYG.",
    interval: "month",
    durationMonths: 1,
    priceIdr: 250_000,
    priceMonthlyIdr: 250_000,
    monthlySendLimit: 0,
    monthlyPublishLimit: 0,
    maxSocialAccounts: 0,
    sortOrder: 15,
    kind: "ai_subscription",
    aiCredits: 25_000_000n,
  },
  {
    code: "ai_pro_max_12m",
    name: "Komenin AI Pro Max (12 bulan)",
    description: "25 juta kredit AI/bulan, hemat 10% dengan komitmen setahun.",
    interval: "months_12",
    durationMonths: 12,
    priceIdr: 2_700_000, // 250.000 × 12 × 0.9
    priceMonthlyIdr: 225_000,
    monthlySendLimit: 0,
    monthlyPublishLimit: 0,
    maxSocialAccounts: 0,
    sortOrder: 16,
    kind: "ai_subscription",
    aiCredits: 25_000_000n,
  },
  {
    code: "ai_credits_s",
    name: "Kredit AI Pay-as-you-go S",
    description: "750.000 kredit AI prabayar, tanpa komitmen.",
    interval: "month", // one-time purchase; interval unused for credits
    durationMonths: 1,
    priceIdr: 50_000,
    priceMonthlyIdr: 50_000,
    monthlySendLimit: 0,
    monthlyPublishLimit: 0,
    maxSocialAccounts: 0,
    sortOrder: 21,
    kind: "ai_credits",
    aiCredits: 750_000n,
  },
  {
    code: "ai_credits_m",
    name: "Kredit AI Pay-as-you-go M",
    description: "2,5 juta kredit AI prabayar + bonus 5%.",
    interval: "month",
    durationMonths: 1,
    priceIdr: 150_000,
    priceMonthlyIdr: 150_000,
    monthlySendLimit: 0,
    monthlyPublishLimit: 0,
    maxSocialAccounts: 0,
    sortOrder: 22,
    kind: "ai_credits",
    aiCredits: 2_500_000n,
  },
  {
    code: "ai_credits_l",
    name: "Kredit AI Pay-as-you-go L",
    description: "9 juta kredit AI prabayar + bonus 15%.",
    interval: "month",
    durationMonths: 1,
    priceIdr: 500_000,
    priceMonthlyIdr: 500_000,
    monthlySendLimit: 0,
    monthlyPublishLimit: 0,
    maxSocialAccounts: 0,
    sortOrder: 23,
    kind: "ai_credits",
    aiCredits: 9_000_000n,
  },
];

/** All purchasable SKUs (social + AI). */
export const ALL_PLANS: CatalogPlan[] = [...DEFAULT_PLANS, ...AI_PLANS];

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
