"use server";

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
  const voucher = await db.voucher.create({
    data: {
      code: input.code.trim().toUpperCase(),
      type: input.type,
      value: input.value,
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
  return voucher;
}

export async function adminToggleVoucher(input: { voucherId: string; isActive: boolean }) {
  await requireSuperAdmin();
  return db.voucher.update({
    where: { id: input.voucherId },
    data: { isActive: input.isActive },
  });
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
  return db.featureFlag.upsert({
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
