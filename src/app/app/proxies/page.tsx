import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { checkProxyHealth, listProxies } from "@/server/proxies";

export default async function ProxiesPage() {
  const proxies = await listProxies();

  return (
    <div>
      <PageHeader
        title="Proxies"
        description="Residential/mobile proxy pool with health and assignment visibility."
        action={
          <Button variant="electric" render={<Link href="/app/proxies/new" />} nativeButton={false}>
            Add proxy
          </Button>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        {proxies.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No proxies yet</EmptyTitle>
              <EmptyDescription>Nothing to show yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Assigned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proxies.map((proxy) => (
                <TableRow key={proxy.id}>
                  <TableCell>
                    <Link href={`/app/proxies/${proxy.id}`} className="font-medium hover:text-primary">
                      {proxy.label}
                    </Link>
                    <div className="text-xs text-muted-foreground">{proxy.provider || "custom"}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {proxy.protocol}://{proxy.host}:{proxy.port}
                  </TableCell>
                  <TableCell className="text-xs">
                    {proxy.type} · {proxy.rotationMode}
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={proxy.isHealthy ? "healthy" : "down"}
                      color={proxy.isHealthy ? "var(--signal-ok)" : "var(--signal-danger)"}
                    />
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {proxy.lastIp || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {proxy.assignments.length} accounts
                      </span>
                      <form
                        action={async () => {
                          "use server";
                          await checkProxyHealth(proxy.id);
                          revalidatePath("/app/proxies");
                        }}
                      >
                        <Button type="submit" variant="glass" size="sm">
                          Check
                        </Button>
                      </form>
                    </div>
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
