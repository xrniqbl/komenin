import { Badge } from "@/components/ui/badge";
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
import { listAdminDeliveries } from "@/server/admin";

const STATUS_OPTIONS = [
  { value: "ok", label: "ok" },
  { value: "failed", label: "failed" },
];

export default async function AdminConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const result = await listAdminDeliveries({
    status: params.status,
    page: Number(params.page) || 1,
  });
  const window = getPageWindow(result.total, result.page, result.perPage);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Connector deliveries</h1>
      <AdminListFilters status={params.status} statusOptions={STATUS_OPTIONS} />
      <Card className="gap-0 overflow-hidden py-0">
        {result.rows.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No deliveries yet</EmptyTitle>
              <EmptyDescription>Nothing to show yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Connector</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.kind}</TableCell>
                    <TableCell>{row.connector}</TableCell>
                    <TableCell>{row.mode}</TableCell>
                    <TableCell>
                      <Badge variant={row.ok ? "secondary" : "destructive"}>
                        {row.ok ? "ok" : "fail"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {row.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ListPagination
              pathname="/admin/connectors"
              searchParams={{ status: params.status }}
              window={window}
            />
          </>
        )}
      </Card>
    </div>
  );
}
