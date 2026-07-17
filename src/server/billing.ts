import { revalidatePath } from "next/cache";
import { assertCan } from "@/lib/rbac";
import {
  DEFAULT_PLANS,
  addMonths,
  computeVoucherDiscount,
  formatIdr,
} from "@/lib/billing/catalog";
import { createMidtransSnapTransaction } from "@/lib/billing/midtrans";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { writeAuditLog } from "@/server/audit";
import { isProductionRuntime } from "@/lib/security";

function appUrl() {
  return process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

export async function ensureBillingCatalog() {
  for (const plan of DEFAULT_PLANS) {
    await db.plan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        interval: plan.interval,
        durationMonths: plan.durationMonths,
        priceIdr: plan.priceIdr,
        monthlySendLimit: plan.monthlySendLimit,
        monthlyPublishLimit: plan.monthlyPublishLimit,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      update: {
        name: plan.name,
        description: plan.description,
        interval: plan.interval,
        durationMonths: plan.durationMonths,
        priceIdr: plan.priceIdr,
        monthlySendLimit: plan.monthlySendLimit,
        monthlyPublishLimit: plan.monthlyPublishLimit,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
    });
  }

  const regions = [
    { code: "ap-southeast-1", name: "Asia Pacific (Singapore)", isDefault: true },
    { code: "us-east-1", name: "US East (N. Virginia)", isDefault: false },
    { code: "eu-west-1", name: "EU West (Ireland)", isDefault: false },
  ];
  for (const region of regions) {
    await db.region.upsert({
      where: { code: region.code },
      create: { ...region, isActive: true },
      update: { name: region.name, isDefault: region.isDefault, isActive: true },
    });
  }
}

export async function listCheckoutPlans() {
  await ensureBillingCatalog();
  return db.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getBillingOverview() {
  const { workspace } = await requireActiveWorkspace();
  await ensureBillingCatalog();

  const [subscription, orders, usage] = await Promise.all([
    db.subscription.findFirst({
      where: { workspaceId: workspace.id, status: { in: ["active", "trialing", "past_due"] } },
      include: { plan: true },
      orderBy: { endsAt: "desc" },
    }),
    db.subscriptionOrder.findMany({
      where: { workspaceId: workspace.id },
      include: { plan: true, voucher: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.usageCounter.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    workspace,
    subscription,
    orders,
    usage,
    formatIdr,
  };
}

export async function validateVoucherCode(input: {
  code: string;
  planCode: string;
  subtotalIdr: number;
}) {
  const { workspace } = await requireActiveWorkspace();
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("Voucher code required");

  const voucher = await db.voucher.findUnique({ where: { code } });
  if (!voucher || !voucher.isActive) throw new Error("Voucher not found");
  const now = new Date();
  if (voucher.startsAt && voucher.startsAt > now) throw new Error("Voucher not started");
  if (voucher.expiresAt && voucher.expiresAt < now) throw new Error("Voucher expired");
  if (voucher.maxRedemptions != null && voucher.redeemedCount >= voucher.maxRedemptions) {
    throw new Error("Voucher fully redeemed");
  }
  if (voucher.minSubtotalIdr != null && input.subtotalIdr < voucher.minSubtotalIdr) {
    throw new Error(`Minimum subtotal is ${formatIdr(voucher.minSubtotalIdr)}`);
  }
  if (
    voucher.allowedPlanCodes.length > 0 &&
    !voucher.allowedPlanCodes.includes(input.planCode)
  ) {
    throw new Error("Voucher not valid for this plan");
  }

  const workspaceRedeems = await db.voucherRedemption.count({
    where: { voucherId: voucher.id, workspaceId: workspace.id },
  });
  if (workspaceRedeems >= voucher.perWorkspaceLimit) {
    throw new Error("Voucher already used by this workspace");
  }

  const discountIdr = computeVoucherDiscount({
    subtotalIdr: input.subtotalIdr,
    type: voucher.type,
    value: voucher.value,
  });

  return {
    voucherId: voucher.id,
    code: voucher.code,
    type: voucher.type,
    value: voucher.value,
    discountIdr,
    totalIdr: Math.max(input.subtotalIdr - discountIdr, 0),
  };
}

export async function createCheckoutSnap(input: {
  planCode: string;
  voucherCode?: string;
}) {
  const { userId, workspace } = await requireActiveWorkspace();
  assertCan(workspace.role, "billing.manage");
  await ensureBillingCatalog();

  const plan = await db.plan.findFirst({
    where: { code: input.planCode, isActive: true },
  });
  if (!plan) throw new Error("Plan not found");

  let voucherId: string | null = null;
  let discountIdr = 0;
  if (input.voucherCode?.trim()) {
    const validated = await validateVoucherCode({
      code: input.voucherCode,
      planCode: plan.code,
      subtotalIdr: plan.priceIdr,
    });
    voucherId = validated.voucherId;
    discountIdr = validated.discountIdr;
  }

  const totalIdr = Math.max(plan.priceIdr - discountIdr, 0);
  const orderCode = `AETH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Midtrans rejects gross_amount of 0 — if fully discounted, skip Snap and mark paid directly.
  const isFreeOrder = totalIdr === 0;

  const order = await db.subscriptionOrder.create({
    data: {
      workspaceId: workspace.id,
      planId: plan.id,
      userId,
      voucherId,
      orderCode,
      status: isFreeOrder ? "paid" : "pending",
      subtotalIdr: plan.priceIdr,
      discountIdr,
      totalIdr,
      midtransOrderId: orderCode,
      ...(isFreeOrder ? { paidAt: new Date() } : {}),
    },
  });

  if (isFreeOrder) {
    // Apply free order immediately without calling Midtrans
    return applyPaidOrder(orderCode, {
      transactionStatus: "settlement",
      paymentType: "voucher_free",
      transactionId: `free_${orderCode}`,
      signatureValid: true,
      payload: { free_order: true, discountIdr },
    });
  }

  const snap = await createMidtransSnapTransaction({
    orderId: orderCode,
    grossAmount: totalIdr,
    customer: { name: workspace.name, email: workspace.billingEmail },
    itemName: plan.name,
    callbacksFinishUrl: `${appUrl()}/app/checkout/result`,
  });

  await db.subscriptionOrder.update({
    where: { id: order.id },
    data: {
      snapToken: snap.token,
      snapRedirectUrl: snap.redirect_url,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    actorUserId: userId,
    action: "billing.checkout_created",
    resourceType: "subscription_order",
    resourceId: order.id,
    metadata: {
      planCode: plan.code,
      totalIdr,
      discountIdr,
      voucherId,
    },
  });

  revalidatePath("/app/settings/billing");
  revalidatePath("/app/checkout");

  return {
    orderId: order.id,
    orderCode,
    token: snap.token,
    redirectUrl: snap.redirect_url,
    totalIdr,
    discountIdr,
    subtotalIdr: plan.priceIdr,
    clientKey: process.env.MIDTRANS_CLIENT_KEY || "",
    isSimulation: !process.env.MIDTRANS_SERVER_KEY,
  };
}

export async function applyPaidOrder(orderCode: string, payment?: {
  transactionId?: string;
  paymentType?: string;
  transactionStatus?: string;
  payload?: unknown;
  signatureValid?: boolean;
}) {
  const order = await db.subscriptionOrder.findFirst({
    where: {
      OR: [{ orderCode }, { midtransOrderId: orderCode }],
    },
    include: { plan: true, voucher: true },
  });
  if (!order) throw new Error("Order not found");

  if (payment && payment.signatureValid === false) {
    throw new Error("Payment signature invalid");
  }

  if (payment?.payload) {
    await db.paymentEvent.create({
      data: {
        orderId: order.id,
        eventType: payment.transactionStatus || "notification",
        transactionStatus: payment.transactionStatus,
        payload: payment.payload as object,
        signatureValid: Boolean(payment.signatureValid),
      },
    });
  }

  if (order.status === "paid") {
    return { ok: true, alreadyPaid: true, orderId: order.id };
  }

  const status = (payment?.transactionStatus || "settlement").toLowerCase();
  if (["pending", "authorize"].includes(status)) {
    await db.subscriptionOrder.update({
      where: { id: order.id },
      data: { status: "pending", paymentType: payment?.paymentType },
    });
    return { ok: true, pending: true, orderId: order.id };
  }

  if (["deny", "cancel", "expire", "failure", "failed"].includes(status)) {
    await db.subscriptionOrder.update({
      where: { id: order.id },
      data: {
        status: status === "expire" ? "expired" : status === "cancel" ? "canceled" : "failed",
        paymentType: payment?.paymentType,
        midtransTxnId: payment?.transactionId,
      },
    });
    return { ok: false, orderId: order.id, status };
  }

  // settlement / capture / success / simulation
  const now = new Date();
  const endsAt = addMonths(now, order.plan.durationMonths);

  const result = await db.$transaction(async (tx) => {
    const paid = await tx.subscriptionOrder.update({
      where: { id: order.id },
      data: {
        status: "paid",
        paidAt: now,
        paymentType: payment?.paymentType || "midtrans",
        midtransTxnId: payment?.transactionId,
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        workspaceId: order.workspaceId,
        planId: order.planId,
        status: "active",
        startsAt: now,
        endsAt,
      },
    });

    await tx.subscriptionOrder.update({
      where: { id: order.id },
      data: { subscriptionId: subscription.id },
    });

    await tx.workspace.update({
      where: { id: order.workspaceId },
      data: {
        planCode: order.plan.code,
        monthlySendLimit: order.plan.monthlySendLimit,
        monthlyPublishLimit: order.plan.monthlyPublishLimit,
      },
    });

    if (order.voucherId) {
      await tx.voucherRedemption.create({
        data: {
          voucherId: order.voucherId,
          workspaceId: order.workspaceId,
          userId: order.userId,
          orderId: order.id,
          discountIdr: order.discountIdr,
        },
      });
      await tx.voucher.update({
        where: { id: order.voucherId },
        data: { redeemedCount: { increment: 1 } },
      });
    }

    return { paid, subscription };
  });

  await writeAuditLog({
    workspaceId: order.workspaceId,
    actorUserId: order.userId,
    action: "billing.order_paid",
    resourceType: "subscription_order",
    resourceId: order.id,
    metadata: {
      subscriptionId: result.subscription.id,
      planCode: order.plan.code,
      totalIdr: order.totalIdr,
    },
  });

  revalidatePath("/app/settings/billing");
  revalidatePath("/app/checkout");
  revalidatePath("/admin/billing");

  return { ok: true, orderId: order.id, subscriptionId: result.subscription.id };
}

export async function markSimulatedPaid(orderCode: string) {
  if (isProductionRuntime()) {
    throw new Error("Simulated payments are disabled in production");
  }
  if (process.env.MIDTRANS_SERVER_KEY?.trim()) {
    throw new Error("Simulated payments are disabled when Midtrans is configured");
  }
  // Local/dev only when Midtrans keys are absent.
  return applyPaidOrder(orderCode, {
    transactionStatus: "settlement",
    paymentType: "simulation",
    transactionId: `sim_${Date.now()}`,
    signatureValid: true,
    payload: { simulated: true },
  });
}
