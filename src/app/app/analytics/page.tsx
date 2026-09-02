import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { QuotaMeter } from "@/components/analytics/quota-meter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsSummary, getClientAgencyReport, getAiUsageAnalytics } from "@/server/analytics";
import { listRateLimitStatus } from "@/server/rate-limits";
import { checkUsageAlerts } from "@/server/usage-alerts";
import { AiUsageCard } from "@/components/analytics/ai-usage-card";

export default async function AnalyticsPage() {
  const [summary, quota, alerts, agency, aiUsage] = await Promise.all([
    getAnalyticsSummary(30),
    listRateLimitStatus(),
    checkUsageAlerts(),
    getClientAgencyReport(30),
    getAiUsageAnalytics(30),
  ]);

  const metrics = [
    { label: "Comments sent", value: summary.sends },
    { label: "Send failures", value: summary.failedSends },
    { label: "Pending approvals", value: summary.approvalsPending },
    { label: "Approvals decided", value: summary.approvalsDone },
    { label: "Posts published", value: summary.publishes },
    { label: "Healthy accounts", value: summary.healthyAccounts },
    { label: "Degraded accounts", value: summary.degradedAccounts },
    { label: "Skill runs", value: summary.skillRuns },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`Workspace KPIs for the last ${summary.rangeDays} days. Period ${quota.periodKey}.`}
        action={
          <Button variant="outline" render={<Link href="/app/rate-limits" />} nativeButton={false}>
            Rate limits
          </Button>
        }
      />

      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <Alert key={i} variant="warning">
              <AlertDescription>{alert}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span>Monthly Sends</span>
              <Badge variant={quota.workspace.sendsStatus === "ok" ? "secondary" : "destructive"}>{quota.workspace.sendsStatus}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <QuotaMeter used={quota.workspace.sendsUsed} limit={quota.workspace.sendLimit} label="Sends" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span>Monthly Publishes</span>
              <Badge variant={quota.workspace.publishesStatus === "ok" ? "secondary" : "destructive"}>{quota.workspace.publishesStatus}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <QuotaMeter used={quota.workspace.publishesUsed} limit={quota.workspace.publishLimit} label="Publishes" />
          </CardContent>
        </Card>
      </div>

      <AiUsageCard data={aiUsage} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl">{metric.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery mix</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {summary.deliveries.length === 0 ? (
              <div className="text-muted-foreground">No deliveries yet.</div>
            ) : (
              summary.deliveries.map((row) => (
                <div key={row.kind} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span>{row.kind}</span>
                  <span className="font-medium">{row.count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan usage</CardTitle>
            <CardDescription>Plan {summary.limits.planCode}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Sends this period: {summary.usage?.sends ?? 0} / {summary.limits.monthlySendLimit}</div>
            <div>Publishes this period: {summary.usage?.publishes ?? 0} / {summary.limits.monthlyPublishLimit}</div>
            <div>Generates: {summary.usage?.generates ?? 0}</div>
            <div>Skill runs: {summary.usage?.skillRuns ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Agency report by client</CardTitle>
              <CardDescription>
                Last {agency.rangeDays} days · {agency.totals.clients} clients ·{" "}
                {agency.totals.leads} leads · {agency.totals.leadsDue} due follow-ups
              </CardDescription>
            </div>
            <Button variant="outline" render={<Link href="/app/clients" />} nativeButton={false}>
              Manage clients
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {agency.rows.length === 0 ? (
            <div className="text-muted-foreground">
              No client activity yet. Create clients and assign campaigns/leads.
            </div>
          ) : (
            agency.rows.map((row) => (
              <div
                key={row.clientId || "unassigned"}
                className="grid gap-2 rounded-lg border px-3 py-3 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div>
                  <div className="font-medium">{row.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.active ? "active" : "inactive"} · {row.campaigns} campaigns
                  </div>
                </div>
                <div className="text-muted-foreground">
                  Leads: {row.leadsTotal} · new {row.leadsNew} · won {row.leadsWon}
                </div>
                <div className="text-muted-foreground">
                  Pipeline: {row.leadsQualified} contacted/qualified · due {row.leadsDue}
                </div>
                <div className="text-muted-foreground">
                  Volume: {row.targetPosts} posts · {row.approvals} approvals · {row.drafts} drafts
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
