import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import { checkProxyHealth, listProxies } from "@/server/proxies";

export default async function ProxiesPage() {
  const proxies = await listProxies();

  return (
    <div>
      <PageHeader
        title="Proxies"
        description="Residential/mobile proxy pool with health and assignment visibility."
        action={
          <Button variant="default"  asChild><Link href="/app/proxies/new">Add proxy</Link></Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border bg-background">
        <div className="grid grid-cols-12 gap-2 border-b border bg-muted/30 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div className="col-span-3">Label</div>
          <div className="col-span-3">Endpoint</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Health</div>
          <div className="col-span-2">Assigned</div>
        </div>

        {proxies.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">No proxies yet.</div>
        ) : (
          proxies.map((proxy) => (
            <div key={proxy.id} className="grid grid-cols-12 items-center gap-2 border-b border px-4 py-3 text-sm last:border-b-0">
              <div className="col-span-3">
                <Link href={`/app/proxies/${proxy.id}`} className="font-medium hover:text-primary">
                  {proxy.label}
                </Link>
                <div className="text-xs text-muted-foreground">{proxy.provider || "custom"}</div>
              </div>
              <div className="col-span-3 font-mono text-xs">
                {proxy.protocol}://{proxy.host}:{proxy.port}
              </div>
              <div className="col-span-2 text-xs">
                {proxy.type} · {proxy.rotationMode}
              </div>
              <div className="col-span-2">
                <StatusPill
                  label={proxy.isHealthy ? "healthy" : "down"}
                  color={proxy.isHealthy ? "var(--signal-ok)" : "var(--signal-danger)"}
                />
                <div className="mt-1 font-mono text-xs text-muted-foreground">{proxy.lastIp || "—"}</div>
              </div>
              <div className="col-span-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{proxy.assignments.length} accounts</span>
                <form
                  action={async () => {
                    "use server";
                    await checkProxyHealth(proxy.id);
                  }}
                >
                  <Button type="submit" variant="outline" >
                    Check
                  </Button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
