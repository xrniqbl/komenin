"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.platformRole !== "superadmin") redirect("/app");
  return { userId: user.id, user };
}

export async function getAdminOverview() {
  await requireSuperAdmin();
  const [workspaces, users, paidOrders, pendingOrders, activeSubs, vouchers, jobFails] =
    await Promise.all([
      db.workspace.count(),
      db.user.count(),
      db.subscriptionOrder.count({ where: { status: "paid" } }),
      db.subscriptionOrder.count({ where: { status: "pending" } }),
      db.subscription.count({ where: { status: "active" } }),
      db.voucher.count({ where: { isActive: true } }),
      db.jobRun.count({ where: { status: "failed" } }),
    ]);
  const revenue = await db.subscriptionOrder.aggregate({
    where: { status: "paid" },
    _sum: { totalIdr: true },
  });
  return {
    workspaces,
    users,
    paidOrders,
    pendingOrders,
    activeSubs,
    vouchers,
    jobFails,
    revenueIdr: revenue._sum.totalIdr || 0,
  };
}

export async function listAdminWorkspaces() {
  await requireSuperAdmin();
  return db.workspace.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      _count: { select: { memberships: true, socialAccounts: true } },
      subscriptions: {
        where: { status: "active" },
        include: { plan: true },
        take: 1,
      },
    },
  });
}

export async function adminUpdateWorkspace(input: {
  workspaceId: string;
  status?: "active" | "suspended";
  planCode?: string;
  monthlySendLimit?: number;
  monthlyPublishLimit?: number;
  homeRegion?: string;
}) {
  const { userId } = await requireSuperAdmin();
  const data: {
    status?: "active" | "suspended";
    planCode?: string;
    monthlySendLimit?: number;
    monthlyPublishLimit?: number;
    homeRegion?: string;
  } = {};
  if (input.status) data.status = input.status;
  if (input.planCode) data.planCode = input.planCode;
  if (input.monthlySendLimit != null) data.monthlySendLimit = input.monthlySendLimit;
  if (input.monthlyPublishLimit != null) data.monthlyPublishLimit = input.monthlyPublishLimit;
  if (input.homeRegion) data.homeRegion = input.homeRegion;
  const workspace = await db.workspace.update({ where: { id: input.workspaceId }, data });
  await db.auditLog.create({
    data: {
      actorUserId: userId,
      action: "admin.workspace_updated",
      resourceType: "workspace",
      resourceId: workspace.id,
      metadata: data,
    },
  });
  return workspace;
}

export async function listAdminUsers() {
  await requireSuperAdmin();
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { memberships: true } } },
  });
}

export async function adminSetPlatformRole(input: {
  userId: string;
  platformRole: "user" | "superadmin";
}) {
  const { userId } = await requireSuperAdmin();
  const user = await db.user.update({
    where: { id: input.userId },
    data: { platformRole: input.platformRole },
  });
  await db.auditLog.create({
    data: {
      actorUserId: userId,
      action: "admin.user_role_updated",
      resourceType: "user",
      resourceId: user.id,
      metadata: { platformRole: input.platformRole },
    },
  });
  return user;
}

export async function listAdminOrders() {
  await requireSuperAdmin();
  return db.subscriptionOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { plan: true, workspace: true, voucher: true },
  });
}

export async function listAdminVouchers() {
  await requireSuperAdmin();
  return db.voucher.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function adminCreateVoucher(input: {
  code: string;
  type: "percent" | "fixed";
  value: number;
  maxRedemptions?: number;
  perWorkspaceLimit?: number;
  minSubtotalIdr?: number;
  allowedPlanCodes?: string[];
  expiresAt?: string;
}) {
  const { userId } = await requireSuperAdmin();
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("Voucher code required");
  if (!Number.isFinite(input.value) || input.value <= 0) {
    throw new Error("Voucher value must be greater than 0");
  }
  if (input.type === "percent" && input.value > 100) {
    throw new Error("Percent vouchers cannot exceed 100");
  }

  const voucher = await db.voucher.create({
    data: {
      code,
      type: input.type,
      value: Math.floor(input.value),
      maxRedemptions: input.maxRedemptions,
      perWorkspaceLimit: input.perWorkspaceLimit ?? 1,
      minSubtotalIdr: input.minSubtotalIdr,
      allowedPlanCodes: input.allowedPlanCodes || [],
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      isActive: true,
    },
  });
  await db.auditLog.create({
    data: {
      actorUserId: userId,
      action: "admin.voucher_created",
      resourceType: "voucher",
      resourceId: voucher.id,
      metadata: { code: voucher.code },
    },
  });
  revalidatePath("/admin/vouchers");
  revalidatePath("/admin");
  return voucher;
}

export async function adminToggleVoucher(input: { voucherId: string; isActive: boolean }) {
  const { userId } = await requireSuperAdmin();
  const voucher = await db.voucher.update({
    where: { id: input.voucherId },
    data: { isActive: input.isActive },
  });
  await db.auditLog.create({
    data: {
      actorUserId: userId,
      action: "admin.voucher_toggled",
      resourceType: "voucher",
      resourceId: voucher.id,
      metadata: { isActive: input.isActive, code: voucher.code },
    },
  });
  revalidatePath("/admin/vouchers");
  revalidatePath("/admin");
  return voucher;
}

export async function adminUpdateVoucher(input: {
  voucherId: string;
  value?: number;
  maxRedemptions?: number | null;
  perWorkspaceLimit?: number;
  minSubtotalIdr?: number | null;
  allowedPlanCodes?: string[];
  expiresAt?: string | null;
  isActive?: boolean;
}) {
  const { userId } = await requireSuperAdmin();
  const existing = await db.voucher.findUnique({ where: { id: input.voucherId } });
  if (!existing) throw new Error("Voucher not found");

  const nextValue = input.value != null ? Math.floor(input.value) : existing.value;
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    throw new Error("Voucher value must be greater than 0");
  }
  if (existing.type === "percent" && nextValue > 100) {
    throw new Error("Percent vouchers cannot exceed 100");
  }

  const data: {
    value?: number;
    maxRedemptions?: number | null;
    perWorkspaceLimit?: number;
    minSubtotalIdr?: number | null;
    allowedPlanCodes?: string[];
    expiresAt?: Date | null;
    isActive?: boolean;
  } = {};
  if (input.value != null) data.value = nextValue;
  if (input.maxRedemptions !== undefined) data.maxRedemptions = input.maxRedemptions;
  if (input.perWorkspaceLimit != null) data.perWorkspaceLimit = input.perWorkspaceLimit;
  if (input.minSubtotalIdr !== undefined) data.minSubtotalIdr = input.minSubtotalIdr;
  if (input.allowedPlanCodes) data.allowedPlanCodes = input.allowedPlanCodes;
  if (input.expiresAt !== undefined) {
    data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  }
  if (input.isActive != null) data.isActive = input.isActive;

  const voucher = await db.voucher.update({
    where: { id: input.voucherId },
    data,
  });
  await db.auditLog.create({
    data: {
      actorUserId: userId,
      action: "admin.voucher_updated",
      resourceType: "voucher",
      resourceId: voucher.id,
      metadata: { code: voucher.code, ...data },
    },
  });
  revalidatePath("/admin/vouchers");
  revalidatePath("/admin");
  return voucher;
}

export async function listAdminJobs() {
  await requireSuperAdmin();
  return db.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 100 });
}

export async function listAdminFlags() {
  await requireSuperAdmin();
  return db.featureFlag.findMany({ orderBy: { key: "asc" } });
}

export async function adminUpsertFlag(input: {
  key: string;
  enabled: boolean;
  description?: string;
}) {
  await requireSuperAdmin();
  const row = await db.featureFlag.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      enabled: input.enabled,
      description: input.description,
    },
    update: {
      enabled: input.enabled,
      description: input.description,
    },
  });
  // Keep runtime flag cache coherent after admin writes.
  const { clearFeatureFlagCache } = await import("@/lib/feature-flags");
  clearFeatureFlagCache(input.key);
  return row;
}

export async function listAdminRegions() {
  await requireSuperAdmin();
  return db.region.findMany({ orderBy: { code: "asc" } });
}

export async function listAdminSso() {
  await requireSuperAdmin();
  return db.ssoConfig.findMany({
    include: { workspace: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function listAdminAudit(limit = 100) {
  await requireSuperAdmin();
  return db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: true, workspace: true },
  });
}

export async function listAdminDeliveries() {
  await requireSuperAdmin();
  return db.deliveryLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

/**
 * Admin AI revenue / usage / margin summary (spec Fase 4 #16 + risk #1).
 * Revenue comes from paid AI orders; cost is estimated per model from the
 * upstream cost table. Margin = revenue allocated vs upstream cost.
 */
export async function getAdminAiMonetization(rangeDays = 30) {
  await requireSuperAdmin();
  // Clamp the window to bound the orders/usage scans.
  const days = Math.min(Math.max(Math.floor(rangeDays) || 30, 1), 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [paidAiOrders, usageEvents, tierCounts] = await Promise.all([
    db.subscriptionOrder.findMany({
      where: {
        status: "paid",
        paidAt: { gte: since },
        plan: { kind: { in: ["ai_subscription", "ai_credits"] } },
      },
      select: { totalIdr: true, plan: { select: { code: true, kind: true, aiCredits: true } } },
    }),
    db.aiUsageEvent.findMany({
      where: { createdAt: { gte: since }, billedTo: { in: ["subscription", "payg"] } },
      select: { model: true, creditsUsed: true, billedTo: true },
    }),
    db.workspaceAiSubscription.groupBy({
      by: ["tier", "status"],
      _count: { _all: true },
    }),
  ]);

  // Revenue split by SKU kind.
  let revenueSubscriptionIdr = 0;
  let revenuePaygIdr = 0;
  let creditsSold = 0n;
  for (const order of paidAiOrders) {
    if (order.plan.kind === "ai_subscription") revenueSubscriptionIdr += order.totalIdr;
    else revenuePaygIdr += order.totalIdr;
    creditsSold += order.plan.aiCredits ?? 0n;
  }
  const revenueTotalIdr = revenueSubscriptionIdr + revenuePaygIdr;

  // Upstream cost per model.
  const { estimateCostIdr } = await import("@/lib/ai/cost");
  const byModel = new Map<string, { credits: bigint; costIdr: number }>();
  let totalCreditsUsed = 0n;
  let totalCostIdr = 0;
  for (const e of usageEvents) {
    totalCreditsUsed += e.creditsUsed;
    const cost = estimateCostIdr(e.model, e.creditsUsed);
    totalCostIdr += cost;
    const m = byModel.get(e.model) ?? { credits: 0n, costIdr: 0 };
    m.credits += e.creditsUsed;
    m.costIdr += cost;
    byModel.set(e.model, m);
  }

  const modelMargins = Array.from(byModel.entries())
    .map(([model, v]) => ({
      model,
      credits: v.credits.toString(),
      costIdr: Math.round(v.costIdr),
    }))
    .sort((a, b) => b.costIdr - a.costIdr)
    .slice(0, 10);

  // Blended revenue per credit sold vs blended cost per credit used.
  const creditsSoldNum = Number(creditsSold);
  const revenuePerCredit = creditsSoldNum > 0 ? revenueTotalIdr / creditsSoldNum : 0;
  const creditsUsedNum = Number(totalCreditsUsed);
  const costPerCredit = creditsUsedNum > 0 ? totalCostIdr / creditsUsedNum : 0;
  // Margin risk flag (spec §6): alert when blended cost > 60% of blended price.
  const marginRatio = revenuePerCredit > 0 ? costPerCredit / revenuePerCredit : 0;
  const marginAtRisk = revenuePerCredit > 0 && marginRatio > 0.6;

  return {
    rangeDays: days,
    revenue: {
      totalIdr: revenueTotalIdr,
      subscriptionIdr: revenueSubscriptionIdr,
      paygIdr: revenuePaygIdr,
      orderCount: paidAiOrders.length,
      creditsSold: creditsSold.toString(),
    },
    usage: {
      creditsUsed: totalCreditsUsed.toString(),
      costIdr: Math.round(totalCostIdr),
      costPerCreditIdr: Number(costPerCredit.toFixed(4)),
      revenuePerCreditIdr: Number(revenuePerCredit.toFixed(4)),
      marginRatio: Number(marginRatio.toFixed(3)),
      marginAtRisk,
    },
    tiers: tierCounts.map((t) => ({
      tier: t.tier,
      status: t.status,
      count: t._count._all,
    })),
    modelMargins,
  };
}
