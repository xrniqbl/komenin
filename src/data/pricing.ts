export type BillingPlanId = "1m" | "6m" | "12m";

export type BillingPlan = {
  id: BillingPlanId;
  months: number;
  priceMonthly: number;
  priceTotal: number;
  featured?: boolean;
  href: string;
};

export const billingPlans: BillingPlan[] = [
  {
    id: "1m",
    months: 1,
    priceMonthly: 49,
    priceTotal: 49,
    href: "/signup",
  },
  {
    id: "6m",
    months: 6,
    priceMonthly: 39,
    priceTotal: 234,
    featured: true,
    href: "/signup",
  },
  {
    id: "12m",
    months: 12,
    priceMonthly: 29,
    priceTotal: 348,
    href: "/signup",
  },
];

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}