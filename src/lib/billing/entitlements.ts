import { DEFAULT_PLANS, type CatalogPlan, type PlanCode } from "@/lib/billing/catalog";

/**
 * Product entitlements derived from plan codes.
 * Marketing claims (account caps, support tier) live here so checkout,
 * createAccount, and pricing pages share one source of truth.
 */

export type SupportTier = "email" | "chat" | "priority";

export type PlanEntitlements = {
  code: PlanCode;
  marketingId: "1m" | "6m" | "12m";
  maxSocialAccounts: number;
  monthlySendLimit: number;
  monthlyPublishLimit: number;
  supportTier: SupportTier;
  features: {
    proxyRouting: boolean;
    contentCalendar: boolean;
    bulkApprove: boolean;
    auditExport: boolean;
    publisherWebhook: boolean;
    teamSeats: boolean;
    priorityAi: boolean;
  };
};

const ENTITLEMENTS_BY_CODE: Record<string, PlanEntitlements> = {
  starter_1m: {
    code: "starter_1m",
    marketingId: "1m",
    maxSocialAccounts: 10,
    monthlySendLimit: 3_000,
    monthlyPublishLimit: 300,
    supportTier: "email",
    features: {
      proxyRouting: true,
      contentCalendar: true,
      bulkApprove: false,
      auditExport: false,
      publisherWebhook: true,
      teamSeats: true,
      priorityAi: false,
    },
  },
  growth_6m: {
    code: "growth_6m",
    marketingId: "6m",
    maxSocialAccounts: 40,
    monthlySendLimit: 10_000,
    monthlyPublishLimit: 1_000,
    supportTier: "chat",
    features: {
      proxyRouting: true,
      contentCalendar: true,
      bulkApprove: true,
      auditExport: true,
      publisherWebhook: true,
      teamSeats: true,
      priorityAi: true,
    },
  },
  scale_12m: {
    code: "scale_12m",
    marketingId: "12m",
    maxSocialAccounts: 100,
    monthlySendLimit: 30_000,
    monthlyPublishLimit: 3_000,
    supportTier: "priority",
    features: {
      proxyRouting: true,
      contentCalendar: true,
      bulkApprove: true,
      auditExport: true,
      publisherWebhook: true,
      teamSeats: true,
      priorityAi: true,
    },
  },
};

/** Free / default workspace before paid subscription. */
export const FREE_ENTITLEMENTS: PlanEntitlements = {
  code: "free",
  marketingId: "1m",
  maxSocialAccounts: 3,
  monthlySendLimit: 500,
  monthlyPublishLimit: 50,
  supportTier: "email",
  features: {
    proxyRouting: true,
    contentCalendar: true,
    bulkApprove: false,
    auditExport: false,
    publisherWebhook: true,
    teamSeats: true,
    priorityAi: false,
  },
};

const MARKETING_ID_TO_CODE: Record<"1m" | "6m" | "12m", PlanCode> = {
  "1m": "starter_1m",
  "6m": "growth_6m",
  "12m": "scale_12m",
};

export function planCodeFromMarketingId(id: "1m" | "6m" | "12m"): PlanCode {
  return MARKETING_ID_TO_CODE[id];
}

export function marketingIdFromPlanCode(code: string): "1m" | "6m" | "12m" | null {
  const ent = ENTITLEMENTS_BY_CODE[code];
  return ent?.marketingId ?? null;
}

export function getEntitlementsForPlanCode(planCode: string | null | undefined): PlanEntitlements {
  if (!planCode) return FREE_ENTITLEMENTS;
  if (planCode === "free" || planCode === "growth") {
    // Legacy default workspace planCode was "growth" without a paid sub.
    // Treat unpaid/legacy codes as free until a real catalog code is applied.
    if (planCode === "growth" && !ENTITLEMENTS_BY_CODE[planCode]) {
      return FREE_ENTITLEMENTS;
    }
  }
  return ENTITLEMENTS_BY_CODE[planCode] ?? FREE_ENTITLEMENTS;
}

export function getCatalogPlanForMarketingId(id: "1m" | "6m" | "12m"): CatalogPlan {
  const code = planCodeFromMarketingId(id);
  const plan = DEFAULT_PLANS.find((p) => p.code === code);
  if (!plan) throw new Error(`Missing catalog plan for ${id}`);
  return plan;
}

/** Sync catalog limits from entitlements (single source). */
export function entitlementsAlignedCatalog(): CatalogPlan[] {
  return DEFAULT_PLANS.map((plan) => {
    const ent = ENTITLEMENTS_BY_CODE[plan.code];
    if (!ent) return plan;
    return {
      ...plan,
      monthlySendLimit: ent.monthlySendLimit,
      monthlyPublishLimit: ent.monthlyPublishLimit,
    };
  });
}

export function accountLimitMessage(max: number): string {
  return `Social account limit reached (${max}). Upgrade your plan to add more accounts.`;
}
