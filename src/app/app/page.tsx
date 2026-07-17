import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";
import { requireActiveWorkspace } from "@/server/workspace-access";

export default async function AppHomePage() {
  const { workspace } = await requireActiveWorkspace();
  const mode = getRuntimeModeLabel();

  const [healthyAccounts, proxyCount, sessionCount, pendingApprovals, recentAudits] =
    await Promise.all([
      db.socialAccount.count({
        where: { workspaceId: workspace.id, deletedAt: null, status: "healthy" },
      }),
      db.proxyEndpoint.count({
        where: { workspaceId: workspace.id, deletedAt: null },
      }),
      db.accountSession.count({
        where: { workspaceId: workspace.id, isActive: true },
      }),
      db.approval.count({
        where: { workspaceId: workspace.id, status: "pending" },
      }),
      db.auditLog.count({
        where: { workspaceId: workspace.id },
      }),
    ]);

  const metrics = [
    { label: "Healthy accounts", value: String(healthyAccounts) },
    { label: "Active proxies", value: String(proxyCount) },
    { label: "Active sessions", value: String(sessionCount) },
    { label: "Pending approvals", value: String(pendingApprovals) },
  ];

  return (
    <div>
      <PageHeader
        title="Command Center"
        description="Monitor session health, campaigns, approvals, and worker activity."
        action={
          <div className="flex items-center gap-2">
            <Badge variant={mode === "simulator" ? "secondary" : "default"}>
              {mode} mode
            </Badge>
            <Button variant="outline" render={<Link href="/app/audit-logs" />} nativeButton={false}>
              Audit trail ({recentAudits})
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl">{metric.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <EmptyState
          title="Connect account"
          description="Add your first Instagram, Threads, or TikTok tunnel."
          href="/app/accounts/new"
          actionLabel="Connect account"
        />
        <EmptyState
          title="Review approvals"
          description="Edit AI drafts and schedule human-approved sends."
          href="/app/approvals"
          actionLabel="Open approvals"
        />
        <EmptyState
          title="Inspect audit logs"
          description="Trace sensitive actions across the workspace."
          href="/app/audit-logs"
          actionLabel="Open audit logs"
        />
      </div>
      <Card className="mt-6">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Runtime is in <span className="font-medium text-foreground">{mode}</span> mode.
          Worker jobs available via <code className="text-xs">POST /api/worker/run</code> or{" "}
          <code className="text-xs">npm run worker</code>.{" "}
          <Link href="/app/activity" className="font-medium text-primary">
            Open activity queue
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}