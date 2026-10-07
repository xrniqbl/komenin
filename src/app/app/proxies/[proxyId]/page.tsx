import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/workspace-access";
import { checkProxyHealth } from "@/server/proxies";

export default async function ProxyDetailPage({
  params,
}: {
  params: Promise<{ proxyId: string }>;
}) {
  const { proxyId } = await params;
  const { workspace } = await requireActiveWorkspace();
  const proxy = await db.proxyEndpoint.findFirst({
    where: { id: proxyId, workspaceId: workspace.id, deletedAt: null },
    select: {
      id: true,
      label: true,
      protocol: true,
      host: true,
      port: true,
      provider: true,
      type: true,
      rotationMode: true,
      isHealthy: true,
      lastIp: true,
      // usernameEnc / passwordEnc omitted from UI query
      assignments: {
        where: { isActive: true },
        select: {
          id: true,
          socialAccount: {
            select: { id: true, username: true, platform: true, status: true },
          },
        },
      },
      rotationLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          oldIp: true,
          newIp: true,
          reason: true,
          createdAt: true,
        },
      },
    },
  });
  if (!proxy) notFound();

  return (
    <div>
      <PageHeader
        title={proxy.label}
        description={`${proxy.protocol}://${proxy.host}:${proxy.port}`}
        action={
          <Link href="/app/proxies" className="text-sm text-primary">
            Back to proxies
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <StatusPill
              label={proxy.isHealthy ? "healthy" : "down"}
              color={proxy.isHealthy ? "var(--signal-ok)" : "var(--signal-danger)"}
            />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>Type: {proxy.type}</div>
              <div>Rotation: {proxy.rotationMode}</div>
              <div>Provider: {proxy.provider || "—"}</div>
              <div>
                Last IP: <span className="font-mono">{proxy.lastIp || "—"}</span>
              </div>
            </div>
            <form
              action={async () => {
                "use server";
                await checkProxyHealth(proxy.id);
              }}
            >
              <Button type="submit" variant="default">
                Run health check
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigned accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {proxy.assignments.length === 0 ? (
              <div className="text-muted-foreground">None</div>
            ) : (
              proxy.assignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/app/accounts/${assignment.socialAccount.id}`}
                  className="glass block rounded-xl border-white/10 px-3 py-2 hover:border-electric-500/40"
                >
                  @{assignment.socialAccount.username}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Rotation log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {proxy.rotationLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No rotation events.</div>
          ) : (
            proxy.rotationLogs.map((log) => (
              <div key={log.id} className="glass rounded-xl border-white/10 px-3 py-2 text-sm">
                <div className="font-mono text-xs">
                  {log.oldIp || "—"} → {log.newIp || "—"}
                </div>
                <div className="text-xs text-muted-foreground">{log.reason}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}