"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { refundPaidOrderTx } from "@/server/billing";

export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // Admin surface enforces the same 2FA gate as the workspace surface — a
  // superadmin with TOTP enabled must clear /auth/totp-gate before acting.
  if (session.user.totpGate) redirect("/auth/totp-gate");
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.platformRole !== "superadmin") redirect("/app");
  return { userId: user.id, user };
}

export type AdminListQuery = { q?: string; page?: number };
export type AdminListResult<T> = {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

/** DB-level pagination window derived from a total count. */
function listWindow(q: AdminListQuery, total: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(Math.floor(q.page || 1) || 1, 1), totalPages);
  return { skip: (page - 1) * perPage, take: perPage, page, totalPages };
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

export async function listAdminWorkspaces(
  q: AdminListQuery = {},
): Promise<AdminListResult<{
  id: string;
  name: string;
  slug: string;
  status: string;
  planCode: string;
  monthlySendLimit: number;
  monthlyPublishLimit: number;
  homeRegion: string;
  _count: { memberships: number; socialAccounts: number };
  subscriptions: Array<{ plan: { code: string } }>;
}>> {
  await requireSuperAdmin();
  const search = q.q?.trim();
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { slug: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const total = await db.workspace.count({ where });
  const { skip, take, page, totalPages } = listWindow(q, total, 25);
  const rows = await db.workspace.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: {
      _count: { select: { memberships: true, socialAccounts: true } },
      subscriptions: {
        where: { status: "active" },
        include: { plan: true },
        take: 1,
      },
    },
  });
  return { rows, total, page, perPage: take, totalPages };
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

export async function listAdminUsers(
  q: AdminListQuery = {},
): Promise<AdminListResult<{
  id: string;
  name: string | null;
  email: string;
  platformRole: string;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  _count: { memberships: number };
}>> {
  await requireSuperAdmin();
  const search = q.q?.trim();
  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const total = await db.user.count({ where });
  const { skip, take, page, totalPages } = listWindow(q, total, 25);
  const rows = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: { _count: { select: { memberships: true } } },
  });
  return { rows, total, page, perPage: take, totalPages };
}

export async function adminSetPlatformRole(input: {
  userId: string;
  platformRole: "user" | "superadmin";
}) {
  const { userId } = await requireSuperAdmin();
  // Anti-lockout guards: without these an admin can demote themselves (or the
  // only other superadmin) and permanently lose access to /admin.
  if (input.userId === userId && input.platformRole !== "superadmin") {
    throw new Error("Invalid role change: you cannot demote your own account");
  }
  if (input.platformRole !== "superadmin") {
    const remaining = await db.user.count({
      where: { platformRole: "superadmin", id: { not: input.userId } },
    });
    if (remaining === 0) {
      throw new Error("Invalid role change: at least one superadmin must remain");
    }
  }
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

const ORDER_STATUSES = [
  "pending",
  "paid",
  "failed",
  "canceled",
  "expired",
  "refunded",
] as const;

export async function listAdminOrders(q: {
  q?: string;
  page?: number;
  status?: string;
} = {}): Promise<AdminListResult<{
  id: string;
  orderCode: string;
  status: string;
  totalIdr: number;
  createdAt: Date;
  paidAt: Date | null;
  plan: { name: string };
  workspace: { name: string };
  voucher: { code: string } | null;
}>> {
  await requireSuperAdmin();
  const search = q.q?.trim();
  const status = ORDER_STATUSES.find((s) => s === q.status);
  const where: {
    status?: (typeof ORDER_STATUSES)[number];
    OR?: Array<Record<string, unknown>>;
  } = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { orderCode: { contains: search, mode: "insensitive" as const } },
      { midtransOrderId: { contains: search } },
      { workspace: { name: { contains: search, mode: "insensitive" as const } } },
    ];
  }
  const total = await db.subscriptionOrder.count({ where });
  const { skip, take, page, totalPages } = listWindow(q, total, 25);
  const rows = await db.subscriptionOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: { plan: true, workspace: true, voucher: true },
  });
  return { rows, total, page, perPage: take, totalPages };
}

export async function listAdminVouchers(
  q: AdminListQuery = {},
): Promise<AdminListResult<{
  id: string;
  code: string;
  type: string;
  value: number;
  isActive: boolean;
  redeemedCount: number;
  maxRedemptions: number | null;
  perWorkspaceLimit: number;
  minSubtotalIdr: number | null;
  allowedPlanCodes: string[];
  expiresAt: Date | null;
}>> {
  await requireSuperAdmin();
  const search = q.q?.trim();
  const where = search
    ? { code: { contains: search, mode: "insensitive" as const } }
    : {};
  const total = await db.voucher.count({ where });
  const { skip, take, page, totalPages } = listWindow(q, total, 25);
  const rows = await db.voucher.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
  return { rows, total, page, perPage: take, totalPages };
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

const JOB_STATUSES = ["queued", "running", "succeeded", "failed"] as const;

export async function listAdminJobs(q: {
  page?: number;
  status?: string;
} = {}): Promise<AdminListResult<{
  id: string;
  job: string;
  status: string;
  message: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}>> {
  await requireSuperAdmin();
  const status = JOB_STATUSES.find((s) => s === q.status);
  const where = status ? { status } : {};
  const total = await db.jobRun.count({ where });
  const { skip, take, page, totalPages } = listWindow(q, total, 25);
  const rows = await db.jobRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    skip,
    take,
  });
  return { rows, total, page, perPage: take, totalPages };
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

export async function listAdminAudit(q: AdminListQuery = {}): Promise<AdminListResult<{
  id: string;
  action: string;
  createdAt: Date;
  actor: { email: string | null } | null;
  workspace: { name: string } | null;
}>> {
  await requireSuperAdmin();
  const search = q.q?.trim();
  const where = search
    ? { action: { contains: search, mode: "insensitive" as const } }
    : {};
  const total = await db.auditLog.count({ where });
  const { skip, take, page, totalPages } = listWindow(q, total, 20);
  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: { actor: true, workspace: true },
  });
  return { rows, total, page, perPage: take, totalPages };
}

export async function listAdminDeliveries(q: {
  page?: number;
  status?: string;
} = {}): Promise<AdminListResult<{
  id: string;
  kind: string;
  connector: string;
  mode: string;
  ok: boolean;
  message: string | null;
  createdAt: Date;
}>> {
  await requireSuperAdmin();
  const okFilter =
    q.status === "failed" ? false : q.status === "ok" ? true : undefined;
  const where = okFilter === undefined ? {} : { ok: okFilter };
  const total = await db.deliveryLog.count({ where });
  const { skip, take, page, totalPages } = listWindow(q, total, 25);
  const rows = await db.deliveryLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
  return { rows, total, page, perPage: take, totalPages };
}

/**
 * Manually trigger a whitelisted worker job (retry a failure or force a run).
 * Runs inline through the same runWorkerJob entry the cron uses, so the
 * re-entrancy guard and per-workspace limits still apply.
 */
export async function adminRunJobNow(job: string) {
  const { userId } = await requireSuperAdmin();
  const { runWorkerJob, WORKER_JOBS } = await import("@/server/worker-jobs");
  const jobName = WORKER_JOBS.find((name) => name === job);
  if (!jobName) {
    throw new Error(`Invalid job name: ${job}`);
  }
  const result = await runWorkerJob(jobName);
  await db.auditLog.create({
    data: {
      actorUserId: userId,
      action: "admin.job_triggered",
      resourceType: "job_run",
      metadata: { job: jobName, ok: result.ok, message: result.message },
    },
  });
  revalidatePath("/admin/jobs");
  revalidatePath("/admin");
  return result;
}

/**
 * Cancel a pending order (local status flip — no charge exists yet).
 * Paid orders must go through adminRefundOrder instead.
 */
export async function adminCancelOrder(orderId: string) {
  const { userId } = await requireSuperAdmin();
  const result = await db.subscriptionOrder.updateMany({
    where: { id: orderId, status: "pending" },
    data: { status: "canceled" },
  });
  if (result.count === 0) {
    throw new Error("Order not found or not pending");
  }
  await db.auditLog.create({
    data: {
      actorUserId: userId,
      action: "admin.order_canceled",
      resourceType: "subscription_order",
      resourceId: orderId,
    },
  });
  revalidatePath("/admin/billing");
  revalidatePath("/admin");
}

/**
 * Mark a paid order as refunded after the money has been returned via the
 * Midtrans dashboard. Uses the same reversal transaction as the webhook path:
 * AI credits/subscription are reversed and the workspace drops to free when no
 * other paid period remains — an admin refund never leaves paid entitlements
 * live. This reconciles the local ledger only — it never calls Midtrans — so
 * the reason is required for the audit trail.
 */
export async function adminRefundOrder(orderId: string, reason: string) {
  const { userId } = await requireSuperAdmin();
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error("Order refund requires a reason");
  }
  const claimed = await db.subscriptionOrder.updateMany({
    where: { id: orderId, status: "paid" },
    data: { status: "refunded" },
  });
  if (claimed.count === 0) {
    throw new Error("Order not found or not paid");
  }
  try {
    await db.$transaction(async (tx) => {
      await refundPaidOrderTx(tx, { orderId });
    });
  } catch (error) {
    // Reversal failed — restore the paid status so the admin can retry the
    // whole operation instead of an order stuck refunded with live entitlements.
    await db.subscriptionOrder.updateMany({
      where: { id: orderId, status: "refunded" },
      data: { status: "paid" },
    });
    throw error;
  }
  await db.auditLog.create({
    data: {
      actorUserId: userId,
      action: "admin.order_refunded",
      resourceType: "subscription_order",
      resourceId: orderId,
      metadata: {
        reason: trimmed.slice(0, 500),
        entitlementsRevoked: true,
      },
    },
  });
  revalidatePath("/admin/billing");
  revalidatePath("/admin");
}

/** Suspend or reinstate a user account. Suspension blocks new logins and ends existing sessions within ~1 minute. */
export async function adminSetUserSuspended(input: {
  userId: string;
  suspended: boolean;
  reason?: string;
}) {
  const { userId } = await requireSuperAdmin();
  if (input.userId === userId) {
    throw new Error("Invalid action: you cannot suspend your own account");
  }
  const data = input.suspended
    ? {
        suspendedAt: new Date(),
        suspendedReason: input.reason?.trim().slice(0, 500) || null,
      }
    : { suspendedAt: null, suspendedReason: null };
  const user = await db.user.update({
    where: { id: input.userId },
    data,
  });
  await db.auditLog.create({
    data: {
      actorUserId: userId,
      action: input.suspended ? "admin.user_suspended" : "admin.user_reinstated",
      resourceType: "user",
      resourceId: user.id,
      metadata: { reason: data.suspendedReason },
    },
  });
  revalidatePath("/admin/users");
  return user;
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
