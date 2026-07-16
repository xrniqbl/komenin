import { formatIdr } from "@/lib/billing/catalog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminOverview } from "@/server/admin";

export default async function AdminHomePage() {
  const data = await getAdminOverview();
  const cards = [
    ["Workspaces", data.workspaces],
    ["Users", data.users],
    ["Active subs", data.activeSubs],
    ["Paid orders", data.paidOrders],
    ["Pending orders", data.pendingOrders],
    ["Active vouchers", data.vouchers],
    ["Failed jobs", data.jobFails],
    ["Gross paid", formatIdr(data.revenueIdr)],
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin overview</h1>
        <p className="text-sm text-muted-foreground">Platform health and commerce signals.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
