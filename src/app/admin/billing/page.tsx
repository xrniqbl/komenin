import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
      <Card className="gap-0 overflow-hidden py-0">
        {orders.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No orders yet</EmptyTitle>
              <EmptyDescription>Nothing to show yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
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
      </Card>
    </div>
  );
}

