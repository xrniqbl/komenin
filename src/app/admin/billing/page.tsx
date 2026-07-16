import { formatIdr } from "@/lib/billing/catalog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminOrders } from "@/server/admin";

export default async function AdminBillingPage() {
  const orders = await listAdminOrders();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Billing orders</h1>
      <div className="overflow-hidden rounded-2xl border bg-background">
        {orders.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">No orders yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="font-medium">{order.orderCode}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.createdAt.toISOString().slice(0, 19)}
                    </div>
                  </TableCell>
                  <TableCell>{order.workspace.name}</TableCell>
                  <TableCell>{order.plan.name}</TableCell>
                  <TableCell>{order.status}</TableCell>
                  <TableCell className="text-right">{formatIdr(order.totalIdr)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
