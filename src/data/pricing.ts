import {
  DEFAULT_PLANS,
  formatIdr,
  type CatalogPlan,
} from "@/lib/billing/catalog";
import {
  getEntitlementsForPlanCode,
  type PlanEntitlements,
} from "@/lib/billing/entitlements";

export type BillingPlanId = "1m" | "6m" | "12m";

export type BillingPlan = {
  id: BillingPlanId;
  planCode: string;
  months: number;
  /** Effective monthly rate in IDR (total / months). */
  priceMonthly: number;
  /** Full commitment price charged at checkout (IDR). */
  priceTotal: number;
  currency: "IDR";
  monthlySendLimit: number;
  monthlyPublishLimit: number;
  maxSocialAccounts: number;
  featured?: boolean;
  href: string;
  entitlements: PlanEntitlements;
};

function toBillingPlan(plan: CatalogPlan, featured?: boolean): BillingPlan {
  const entitlements = getEntitlementsForPlanCode(plan.code);
  const marketingId = entitlements.marketingId;
  return {
    id: marketingId,
    planCode: plan.code,
    months: plan.durationMonths,
    priceMonthly: plan.priceMonthlyIdr ?? Math.round(plan.priceIdr / plan.durationMonths),
    priceTotal: plan.priceIdr,
    currency: "IDR",
    monthlySendLimit: entitlements.monthlySendLimit,
    monthlyPublishLimit: entitlements.monthlyPublishLimit,
    maxSocialAccounts: entitlements.maxSocialAccounts,
    featured,
    // Checkout requires auth + workspace; signup is the public entry.
    href: `/signup?plan=${marketingId}`,
    entitlements,
  };
}

export const billingPlans: BillingPlan[] = [
  toBillingPlan(DEFAULT_PLANS[0]!),
  toBillingPlan(DEFAULT_PLANS[1]!, true),
  toBillingPlan(DEFAULT_PLANS[2]!),
];

export function formatPrice(amount: number, currency: "IDR" | "USD" = "IDR"): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return formatIdr(amount);
}

/** @deprecated Use formatPrice — marketing is IDR to match Midtrans checkout. */
export function formatUsd(amount: number): string {
  return formatPrice(amount, "IDR");
}

export { formatIdr };
