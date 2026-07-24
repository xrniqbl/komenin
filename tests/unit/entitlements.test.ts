import { describe, expect, it } from "vitest";
import {
  FREE_ENTITLEMENTS,
  getEntitlementsForPlanCode,
  marketingIdFromPlanCode,
  planCodeFromMarketingId,
} from "@/lib/billing/entitlements";
import { DEFAULT_PLANS } from "@/lib/billing/catalog";
import { billingPlans } from "@/data/pricing";

describe("plan entitlements", () => {
  it("maps marketing ids to catalog codes", () => {
    expect(planCodeFromMarketingId("1m")).toBe("starter_1m");
    expect(planCodeFromMarketingId("6m")).toBe("growth_6m");
    expect(planCodeFromMarketingId("12m")).toBe("scale_12m");
  });

  it("returns free entitlements for legacy growth without paid code", () => {
    expect(getEntitlementsForPlanCode("growth").maxSocialAccounts).toBe(
      FREE_ENTITLEMENTS.maxSocialAccounts,
    );
    expect(getEntitlementsForPlanCode(null).code).toBe("free");
  });

  it("aligns catalog send/publish limits with entitlements", () => {
    for (const plan of DEFAULT_PLANS) {
      const ent = getEntitlementsForPlanCode(plan.code);
      expect(plan.monthlySendLimit).toBe(ent.monthlySendLimit);
      expect(plan.monthlyPublishLimit).toBe(ent.monthlyPublishLimit);
      expect(plan.maxSocialAccounts).toBe(ent.maxSocialAccounts);
    }
  });

  it("exposes IDR marketing plans matching Midtrans catalog totals", () => {
    expect(billingPlans).toHaveLength(3);
    expect(billingPlans.every((p) => p.currency === "IDR")).toBe(true);
    expect(billingPlans.map((p) => p.priceTotal)).toEqual([
      499_000,
      2_394_000,
      3_588_000,
    ]);
    expect(billingPlans.map((p) => p.priceMonthly)).toEqual([
      499_000,
      399_000,
      299_000,
    ]);
    expect(marketingIdFromPlanCode("starter_1m")).toBe("1m");
  });
});
