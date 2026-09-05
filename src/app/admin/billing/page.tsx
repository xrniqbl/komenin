import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPageWindow, ListPagination } from "@/components/app/list-pagination";
import { AdminListFilters } from "@/components/admin/admin-list-filters";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIdr } from "@/lib/billing/catalog";
import {
  adminCancelOrder,
  adminRefundOrder,
  listAdminOrders,
} from "@/server/admin";

const STATUS_OPTIONS = [
  { value: "pending", label: "pending" },
  { value: "paid", label: "paid" },
  { value: "failed", label: "failed" },
  { value: "canceled", label: "canceled" },
  { value: "expired", label: "expired" },
  { value: "refunded", label: "refunded" },
];

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const result = await listAdminOrders({
    q: params.q,
    status: params.status,
    page: Number(params.page) || 1,
  });
  const window = getPageWindow(result.total, result.page, result.perPage);

  async function cancelAction(formData: FormData) {
    "use server";
    await adminCancelOrder(String(formData.get("orderId") || ""));
  }

  async function refundAction(formData: FormData) {
    "use server";
    await adminRefundOrder(
      String(formData.get("orderId") || ""),
      String(formData.get("reason") || ""),
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Billing orders</h1>
        <p className="text-sm text-muted-foreground">
          Cancel hanya untuk order pending. Refund hanya menandai status lokal —
          kirimi dana lewat dashboard Midtrans, lalu catat alasannya di sini.
        </p>
      </div>
      <AdminListFilters
        q={params.q}
        status={params.status}
        statusOptions={STATUS_OPTIONS}
        placeholder="Cari order / workspace…"
      />
      <Card className="gap-0 overflow-hidden py-0">
        {result.rows.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No orders yet</EmptyTitle>
              <EmptyDescription>Nothing to show yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((order) => (
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
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {order.status === "pending" ? (
                          <form action={cancelAction}>
                            <input type="hidden" name="orderId" value={order.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Cancel
                            </Button>
                          </form>
                        ) : null}
                        {order.status === "paid" ? (
                          <form action={refundAction} className="flex items-center gap-2">
                            <input type="hidden" name="orderId" value={order.id} />
                            <Input
                              name="reason"
                              placeholder="Alasan refund"
                              className="max-w-40"
                              required
                            />
                            <Button type="submit" variant="outline" size="sm">
                              Refund
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination
              pathname="/admin/billing"
              searchParams={{ q: params.q, status: params.status }}
              window={window}
            />
          </>
        )}
      </Card>
    </div>
  );
}
