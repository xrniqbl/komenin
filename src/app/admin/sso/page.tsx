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
import { listAdminSso } from "@/server/admin";
import { evaluateSsoReadiness } from "@/lib/sso-readiness";

export default async function AdminSsoPage() {
  const rows = await listAdminSso();
  const readiness = evaluateSsoReadiness();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">SSO configs</h1>
      {!readiness.readyForProductionLogin && (
        <Card className="border-amber-500/40 bg-amber-500/10 p-4">
          <p className="font-medium">SAML SSO is not production-ready yet</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
            {readiness.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="gap-0 overflow-hidden py-0">
        {rows.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No SSO configs yet</EmptyTitle>
              <EmptyDescription>Nothing to show yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
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
      </Card>
    </div>
  );
}
