import { ListPagination, paginateItems } from "@/components/app/list-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminAudit } from "@/server/admin";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const rows = await listAdminAudit(200);
  const { items, window } = paginateItems(rows, params.page, 20);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Platform audit</h1>
      <div className="overflow-hidden rounded-2xl border bg-background">
        {items.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">No audit events yet.</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.action}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.actor?.email || "system"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.workspace?.name || "platform"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.createdAt.toISOString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination pathname="/admin/audit" window={window} />
          </>
        )}
      </div>
    </div>
  );
}
