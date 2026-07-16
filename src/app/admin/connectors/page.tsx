import { Badge } from "@/components/ui/badge";
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
      <div className="overflow-hidden rounded-2xl border bg-background">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">No deliveries yet.</div>
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
      </div>
    </div>
  );
}
