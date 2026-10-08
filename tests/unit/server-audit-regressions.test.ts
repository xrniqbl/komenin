import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: { user: { id: "user-1", email: "person@example.com", totpGate: false } },
  membership: null as null | { id: string; role: string; status: string; customRoleId?: string | null },
  invite: { id: "invite-1", workspaceId: "ws-1", email: "person@example.com", role: "operator", acceptedAt: null as Date | null, expiresAt: new Date("2099-01-01") },
  order: { id: "order-1", code: "order-1", workspaceId: "ws-1", userId: "user-1", status: "canceled", totalIdr: 1000, voucherId: null, plan: { durationMonths: 1 } },
  created: 0,
  claimed: 0,
  lostClaim: false,
  refunded: 0,
  voucherData: null as null | { expiresAt?: Date | null },
}));
vi.mock("@/lib/auth", () => ({ auth: async () => state.session }));
vi.mock("@/lib/db", () => {
  const membership = {
    findUnique: async () => state.membership,
    create: async () => { state.created++; return {}; },
    update: async ({ data }: { data: { status?: string; role?: string; customRoleId?: null } }) => { state.membership = { ...state.membership!, ...data }; return state.membership; },
  };
  const invite = {
    findUnique: async () => state.invite,
    create: async () => { state.created++; return { id: "invite-2" }; },
    updateMany: async () => { if (state.invite.acceptedAt) return { count: 0 }; state.invite.acceptedAt = new Date(); return { count: 1 }; },
  };
  const subscriptionOrder = {
    findUnique: async () => state.order,
    findUniqueOrThrow: async () => ({ ...state.order, status: state.lostClaim ? "canceled" : state.order.status }),
    findFirst: async () => state.order,
    updateMany: async () => { state.claimed++; return { count: state.lostClaim ? 0 : 1 }; },
    update: async () => ({}),
  };
  const voucher = { create: async ({ data }: { data: { expiresAt?: Date | null } }) => { state.voucherData = data; return { id: "voucher-1", code: "CODE" }; }, findUnique: async () => ({ type: "fixed", value: 100 }), update: async ({ data }: { data: { expiresAt?: Date | null } }) => { state.voucherData = data; return { id: "voucher-1", code: "CODE" }; } };
  const tx = { membership, invite, subscriptionOrder, voucher, workspace: { create: async () => { state.created++; return { id: "ws-2" }; } } };
  return { db: { ...tx, paymentEvent: { create: async () => ({}) }, user: { findUnique: async () => ({ id: "user-1", platformRole: "superadmin" }) }, auditLog: { create: async () => ({}) }, workspace: { findUnique: async () => null }, $transaction: async (fn: (client: unknown) => Promise<unknown>) => {
    const acceptedAt = state.invite.acceptedAt;
    try { return await fn(tx); } catch (error) { state.invite.acceptedAt = acceptedAt; throw error; }
  } } };
});
vi.mock("@/server/audit", () => ({ writeAuditLog: async () => ({}) }));
vi.mock("@/server/memberships", () => ({ requireMembership: async () => ({ userId: "user-1", role: "owner", workspace: { name: "Workspace" } }) }));
vi.mock("@/server/workspace-access", () => ({ requireActiveWorkspace: async () => ({ workspace: { id: "ws-1" } }) }));
vi.mock("@/lib/email", () => ({ sendInviteEmail: async () => ({ delivered: true }) }));
vi.mock("@/lib/rbac", () => ({ assertCanWithCustom: () => {}, assertWorkspacePermission: () => {} }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: () => {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/ai/billing", () => ({ fulfillAiCreditsOrder: async () => {}, fulfillAiSubscriptionOrder: async () => {}, refundAiOrder: async () => {}, refundAiOrderPartial: async () => { state.refunded++; return { creditsRefunded: 1n }; } }));

import { acceptInvite, createInvite } from "@/server/invites";
import { createWorkspace } from "@/server/workspaces";
import { applyPaidOrder } from "@/server/billing";
import { adminCreateVoucher, adminUpdateVoucher } from "@/server/admin";

beforeEach(() => {
  state.session.user.totpGate = false;
  state.membership = null;
  state.invite.acceptedAt = null;
  state.order.status = "canceled";
  state.created = state.claimed = state.refunded = 0;
  state.lostClaim = false;
  state.voucherData = null;
});

describe("server audit regressions", () => {
  it("rejects a new invitation to an existing suspended member", async () => {
    state.membership = { id: "member-1", role: "viewer", status: "suspended" };
    await expect(createInvite({ workspaceId: "ws-1", email: "person@example.com", role: "operator" })).rejects.toThrow(/membership/i);
    expect(state.created).toBe(0);
  });
  it("does not resurrect suspended membership via an old invitation", async () => {
    state.membership = { id: "member-1", role: "viewer", status: "suspended" };
    await expect(acceptInvite("token")).rejects.toThrow();
    expect(state.membership.status).toBe("suspended");
    expect(state.invite.acceptedAt).toBeNull();
  });
  it("consumes an invitation exactly once", async () => {
    await acceptInvite("token");
    await expect(acceptInvite("token")).rejects.toThrow(/invalid or expired/i);
    expect(state.created).toBe(1);
  });
  it("clears a custom role when an active member is elevated by invitation", async () => {
    state.membership = { id: "member-1", role: "viewer", status: "active", customRoleId: "custom-1" };
    await acceptInvite("token");
    expect(state.membership).toMatchObject({ role: "operator", customRoleId: null });
  });
  it("blocks workspace creation while TOTP challenge remains", async () => {
    state.session.user.totpGate = true;
    await expect(createWorkspace({ name: "New workspace" })).rejects.toThrow(/Two-factor/);
  });
  it.each(["canceled", "failed", "expired"])("does not settle a %s order", async (status) => {
    state.order.status = status;
    await expect(applyPaidOrder("order-1", { transactionStatus: "settlement", expectedGrossAmount: 1000 })).rejects.toThrow(status);
    expect(state.claimed).toBe(0);
  });
  it("does not acknowledge a lost paid-transition claim as already paid", async () => {
    state.order.status = "pending";
    state.lostClaim = true;
    await expect(applyPaidOrder("order-1", { transactionStatus: "settlement", expectedGrossAmount: 1000 })).rejects.toThrow(/status/i);
  });
  it("rejects partial refunds without an explicit refunded amount", async () => {
    state.order.status = "paid";
    await expect(applyPaidOrder("order-1", { transactionStatus: "partial_refund", expectedGrossAmount: 1000 })).rejects.toThrow(/refund/i);
    expect(state.refunded).toBe(0);
  });
  it("accepts a valid partial refund amount rather than treating the original gross amount as refunded", async () => {
    state.order.status = "paid";
    await expect(applyPaidOrder("order-1", { transactionStatus: "partial_refund", expectedGrossAmount: 1000, payload: { refund_amount: "200.00" } })).resolves.toMatchObject({ status: "partial_refund" });
    expect(state.refunded).toBe(1);
  });
  it("rejects oversized partial refunds without clawing back credits", async () => {
    state.order.status = "paid";
    await expect(applyPaidOrder("order-1", { transactionStatus: "partial_refund", expectedGrossAmount: 1000, payload: { refund_amount: "1500.00" } })).rejects.toThrow(/refund/i);
    expect(state.refunded).toBe(0);
  });
  it("keeps an updated voucher valid through its UTC calendar day", async () => {
    await adminUpdateVoucher({ voucherId: "voucher-1", expiresAt: "2026-10-08" });
    expect(state.voucherData?.expiresAt?.toISOString()).toBe("2026-10-08T23:59:59.999Z");
  });
  it("keeps a date-only voucher valid through its UTC calendar day", async () => {
    await adminCreateVoucher({ code: "CODE", type: "fixed", value: 100, expiresAt: "2026-10-08" });
    expect(state.voucherData?.expiresAt?.toISOString()).toBe("2026-10-08T23:59:59.999Z");
  });
});
