import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIdr } from "@/lib/billing/catalog";
import { getBillingOverview } from "@/server/billing";
import { getWorkspaceAiBillingStatus } from "@/server/ai-providers";

export default async function BillingSettingsPage() {
  const [overview, aiStatus] = await Promise.all([
    getBillingOverview(),
    getWorkspaceAiBillingStatus(),
  ]);
  const sub = overview.subscription;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Midtrans subscription, usage limits, and invoices."
        action={
          <Button render={<Link href="/app/checkout" />} nativeButton={false}>
            Upgrade plan
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Current plan</CardDescription>
            <CardTitle className="text-2xl">{sub?.plan.name || overview.workspace.planCode}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Status: {sub?.status || "none"}</div>
            {sub ? <div>Renews/ends: {sub.endsAt.toISOString().slice(0, 10)}</div> : null}
            <div>
              Sends: {overview.usage?.sends ?? 0} / {overview.workspace.monthlySendLimit}
            </div>
            <div>
              Publishes: {overview.usage?.publishes ?? 0} / {overview.workspace.monthlyPublishLimit}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment provider</CardTitle>
            <CardDescription>
              Checkout uses Midtrans Snap. Notifications are verified server-side and activate plan limits automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/app/checkout" className="inline-flex text-sm text-primary hover:underline">
              Open checkout
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI credits</CardTitle>
            <CardDescription>
              Tier {aiStatus.tier} · subscription remaining{" "}
              {new Intl.NumberFormat("id-ID").format(Number(aiStatus.remainingThisPeriod))} · PAYG{" "}
              {new Intl.NumberFormat("id-ID").format(Number(aiStatus.paygBalance))}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" render={<Link href="/app/settings/ai" />} nativeButton={false}>
              Manage AI billing
            </Button>
            <Button size="sm" variant="outline" render={<Link href="/app/analytics" />} nativeButton={false}>
              View AI usage
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="text-sm">Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {overview.orders.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">No orders yet.</div>
          ) : (
            <div className="divide-y">
              {overview.orders.map((order) => (
                <div key={order.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-4">
                  <div>
                    <div className="font-medium">{order.orderCode}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                    </div>
                  </div>
                  <div>{order.plan.name}</div>
                  <div>{order.status}</div>
                  <div className="md:text-right">
                    {formatIdr(order.totalIdr)}
                    {order.discountIdr > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        disc {formatIdr(order.discountIdr)}
                        {order.voucher ? ` · ${order.voucher.code}` : ""}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}