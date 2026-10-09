import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { OnboardingChecklistCard } from "@/components/app/onboarding-checklist";
import { ActivityChart } from "@/components/app/activity-chart";
import { PageHeader } from "@/components/app/page-header";
import {
  WorkspaceHealthScore,
  type HealthCheckItem,
} from "@/components/app/workspace-health-score";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEntitlementsForPlanCode } from "@/lib/billing/entitlements";
import { db } from "@/lib/db";
import { evaluateLiveReadiness, getRuntimeModeLabel } from "@/lib/runtime-mode";
import { getOnboardingChecklist } from "@/server/onboarding-checklist";
import { getWeeklyActivity } from "@/server/analytics";
import { requireActiveWorkspace } from "@/server/workspace-access";

export default async function AppHomePage() {
  const { workspace } = await requireActiveWorkspace();
  const mode = getRuntimeModeLabel();
  const readiness = evaluateLiveReadiness();
  const entitlements = getEntitlementsForPlanCode(workspace.planCode);
  const checklist = await getOnboardingChecklist();
  const weeklyActivity = await getWeeklyActivity();

  const [healthyAccounts, proxyCount, sessionCount, pendingApprovals, recentAudits, accountCount, campaignCount] =
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
      db.socialAccount.count({
        where: { workspaceId: workspace.id, deletedAt: null },
      }),
      db.campaign.count({
        where: { workspaceId: workspace.id },
      }),
    ]);

  // Build health check items
  const healthItems: HealthCheckItem[] = [
    {
      id: "accounts",
      label: "Social accounts",
      status: accountCount > 0 ? "good" : "critical",
      detail:
        accountCount > 0
          ? `${accountCount} connected`
          : "No accounts connected",
      href: "/app/accounts",
    },
    {
      id: "sessions",
      label: "Active sessions",
      status:
        sessionCount > 0
          ? sessionCount >= accountCount
            ? "good"
            : "warning"
          : "critical",
      detail:
        sessionCount > 0
          ? `${sessionCount} active`
          : "No active sessions",
      href: "/app/sessions",
    },
    {
      id: "proxies",
      label: "Proxy endpoints",
      status:
        proxyCount > 0
          ? "good"
          : accountCount > 0
            ? "warning"
            : "critical",
      detail:
        proxyCount > 0
          ? `${proxyCount} configured`
          : "No proxies configured",
      href: "/app/proxies",
    },
    {
      id: "campaigns",
      label: "Campaigns",
      status: campaignCount > 0 ? "good" : "warning",
      detail:
        campaignCount > 0
          ? `${campaignCount} active`
          : "No campaigns yet",
      href: "/app/campaigns",
    },
    {
      id: "connector",
      label: "Live connector",
      status: readiness.ready ? "good" : mode === "simulator" ? "warning" : "critical",
      detail: readiness.ready
        ? "Ready"
        : mode === "simulator"
          ? "Simulator mode"
          : "Not configured",
      href: "/app/settings/publisher",
    },
  ];

  const metrics = [
    {
      label: "Social accounts",
      value: `${accountCount}/${entitlements.maxSocialAccounts}`,
    },
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

      <OnboardingChecklistCard checklist={checklist} />

      {/* Health score — shows when onboarding is done or partially done */}
      {(checklist.complete || checklist.completedCount > 0) && (
        <WorkspaceHealthScore items={healthItems} />
      )}

      {!readiness.ready ? (
        <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Live connector readiness</CardTitle>
              <Badge variant="secondary">{mode}</Badge>
            </div>
            <CardDescription>
              {mode === "simulator"
                ? "You are in simulator mode. Campaigns and approvals still work end-to-end, but platform delivery is simulated."
                : "Live mode is on, but connector configuration is incomplete."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {[...readiness.blockers, ...readiness.warnings].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-amber-600" />
                <span>{item}</span>
              </div>
            ))}
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                render={<Link href="/app/settings/publisher" />}
                nativeButton={false}
              >
                Open publisher settings
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl">{metric.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <ActivityChart data={weeklyActivity} />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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