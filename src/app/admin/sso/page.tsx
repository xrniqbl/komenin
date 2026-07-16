import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminSso } from "@/server/admin";

export default async function AdminSsoPage() {
  const rows = await listAdminSso();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">SSO configs</h1>
      <div className="overflow-hidden rounded-2xl border bg-background">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">No SSO configs yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workspace</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.workspace.name}</TableCell>
                  <TableCell>{row.protocol}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{row.issuer}</TableCell>
                  <TableCell>{row.emailDomain || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? "secondary" : "outline"}>
                      {row.isActive ? "active" : "off"}
                    </Badge>
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
