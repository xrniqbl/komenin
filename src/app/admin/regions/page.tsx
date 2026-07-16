import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminRegions } from "@/server/admin";

export default async function AdminRegionsPage() {
  const rows = await listAdminRegions();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Regions</h1>
      <div className="overflow-hidden rounded-2xl border bg-background">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">No regions configured.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="space-x-2">
                    {row.isDefault ? <Badge variant="secondary">default</Badge> : null}
                    <Badge variant={row.isActive ? "secondary" : "outline"}>
                      {row.isActive ? "active" : "inactive"}
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
