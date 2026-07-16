import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { formatIdr } from "@/lib/billing/catalog";
import { getBillingOverview } from "@/server/billing";

export default async function BillingSettingsPage() {
  const overview = await getBillingOverview();
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-background p-6">
          <div className="text-sm text-muted-foreground">Current plan</div>
          <div className="mt-1 text-2xl font-semibold">
            {sub?.plan.name || overview.workspace.planCode}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Status: {sub?.status || "none"}
          </div>
          {sub ? (
            <div className="mt-1 text-sm text-muted-foreground">
              Renews/ends: {sub.endsAt.toISOString().slice(0, 10)}
            </div>
          ) : null}
          <div className="mt-4 space-y-1 text-sm text-muted-foreground">
            <div>
              Sends: {overview.usage?.sends ?? 0} / {overview.workspace.monthlySendLimit}
            </div>
            <div>
              Publishes: {overview.usage?.publishes ?? 0} / {overview.workspace.monthlyPublishLimit}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-background p-6">
          <div className="text-sm font-medium">Payment provider</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Checkout uses Midtrans Snap. Notifications are verified server-side and activate plan limits automatically.
          </p>
          <Link href="/app/checkout" className="mt-4 inline-flex text-sm text-primary hover:underline">
            Open checkout
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border bg-background">
        <div className="border-b px-4 py-3 text-sm font-semibold">Recent orders</div>
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
      </div>
    </div>
  );
}
