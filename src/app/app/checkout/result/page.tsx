import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { markSimulatedPaid } from "@/server/billing";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { db } from "@/lib/db";
import { isProductionRuntime } from "@/lib/security";

export default async function CheckoutResultPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string; result?: string; sim?: string }>;
}) {
  const { workspace } = await requireActiveWorkspace();
  const params = await searchParams;
  const orderId = params.order_id || "";

  // Ownership-scoped lookup FIRST: the simulated-payment path below must only
  // ever fulfil an order that belongs to the caller's workspace.
  const order = orderId
    ? await db.subscriptionOrder.findFirst({
        where: {
          workspaceId: workspace.id,
          OR: [{ orderCode: orderId }, { midtransOrderId: orderId }],
        },
        include: { plan: true },
      })
    : null;

  let note = "Payment status will update after Midtrans notification.";

  if (orderId && params.sim === "1") {
    if (isProductionRuntime() || process.env.MIDTRANS_SERVER_KEY?.trim()) {
      note = "Simulation payment is disabled for this environment.";
    } else if (!order) {
      note = "Missing or unknown order.";
    } else {
      try {
        await markSimulatedPaid(orderId);
        note = "Simulation payment marked as paid.";
      } catch (error) {
        note = error instanceof Error ? error.message : "Unable to mark simulation payment.";
      }
    }
  }

  return (
    <div>
      <PageHeader title="Checkout result" description="Midtrans return page." />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">
            {order ? `Order ${order.orderCode}` : "No order id"}
          </CardTitle>
          <CardDescription>{note}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {order ? (
            <>
              <div>Plan: {order.plan.name}</div>
              <div>Status: {order.status}</div>
              <div>Total: Rp {order.totalIdr.toLocaleString("id-ID")}</div>
            </>
          ) : (
            <div className="text-muted-foreground">Missing or unknown order.</div>
          )}
          <div className="flex gap-2">
            <Button render={<Link href="/app/settings/billing" />} nativeButton={false}>
              Billing settings
            </Button>
            <Button variant="glass" render={<Link href="/app/checkout" />} nativeButton={false}>
              Back to checkout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}