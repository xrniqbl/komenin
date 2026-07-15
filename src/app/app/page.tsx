import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { db } from "@/lib/db";
import { requireActiveWorkspace } from "@/server/active-workspace";

export default async function CommandCenterPage() {
  const { workspace } = await requireActiveWorkspace();

  const [healthyAccounts, proxyCount, sessionCount, pendingApprovals] = await Promise.all([
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
        description="Monitor session health, campaigns, approvals, and skill activity."
      />
      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border bg-background p-4">
            <div className="text-sm text-muted-foreground">{metric.label}</div>
            <div className="mt-2 text-3xl font-semibold">{metric.value}</div>
          </div>
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
          title="Add proxy"
          description="Register residential/mobile endpoints for rotation."
          href="/app/proxies/new"
          actionLabel="Add proxy"
        />
        <EmptyState
          title="Review sessions"
          description="Inspect encrypted session vault health."
          href="/app/sessions"
          actionLabel="Open sessions"
        />
      </div>
      <div className="mt-6 rounded-2xl border border bg-background p-4 text-sm text-muted-foreground">
        Session Routing is live. Next modules: Comment Engine, Agent Intelligence, Skill Execution.{" "}
        <Link href="/app/accounts" className="font-medium text-primary">
          Open multi-tunnel grid
        </Link>
      </div>
    </div>
  );
}
