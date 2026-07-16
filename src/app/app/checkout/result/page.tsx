import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { markSimulatedPaid } from "@/server/billing";
import { db } from "@/lib/db";

export default async function CheckoutResultPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string; result?: string; sim?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.order_id || "";
  let note = "Payment status will update after Midtrans notification.";

  if (orderId && params.sim === "1") {
    await markSimulatedPaid(orderId);
    note = "Simulation payment marked as paid.";
  }

  const order = orderId
    ? await db.subscriptionOrder.findFirst({
        where: { OR: [{ orderCode: orderId }, { midtransOrderId: orderId }] },
        include: { plan: true },
      })
    : null;

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
            <Button variant="outline" render={<Link href="/app/checkout" />} nativeButton={false}>
              Back to checkout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
