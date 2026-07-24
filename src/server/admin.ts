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
