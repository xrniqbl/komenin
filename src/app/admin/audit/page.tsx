import { Card } from "@/components/ui/card";
import { getPageWindow, ListPagination } from "@/components/app/list-pagination";
import { AdminListFilters } from "@/components/admin/admin-list-filters";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const result = await listAdminAudit({ q: params.q, page: Number(params.page) || 1 });
  const window = getPageWindow(result.total, result.page, result.perPage);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Platform audit</h1>
      <AdminListFilters q={params.q} placeholder="Filter action (mis. admin.)" />
      <Card className="gap-0 overflow-hidden py-0">
        {result.rows.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No audit events yet</EmptyTitle>
              <EmptyDescription>Nothing to show yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
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
                {result.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.action}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.actor?.email || "system"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.workspace?.name || "platform"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.createdAt.toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination
              pathname="/admin/audit"
              searchParams={{ q: params.q }}
              window={window}
            />
          </>
        )}
      </Card>
    </div>
  );
}
