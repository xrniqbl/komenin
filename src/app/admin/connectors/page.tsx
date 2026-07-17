import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

export default async function AdminConnectorsPage() {
  const rows = await listAdminDeliveries();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Connector deliveries</h1>
      <Card className="gap-0 overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No deliveries yet</EmptyTitle>
              <EmptyDescription>Nothing to show yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
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
              {rows.map((row) => (
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
        )}
      </Card>
    </div>
  );
}
