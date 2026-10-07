import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { QuotaMeter } from "@/components/analytics/quota-meter";
import { PlatformMixCard } from "@/components/analytics/platform-mix-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsSummary, getClientAgencyReport, getAiUsageAnalytics, exportCommentSendsCsv, exportPublishesCsv } from "@/server/analytics";
import { getWorkspaceAiBillingStatus } from "@/server/ai-providers";
import { listRateLimitStatus } from "@/server/rate-limits";
import { checkUsageAlerts } from "@/server/usage-alerts";
import { AiUsageCard } from "@/components/analytics/ai-usage-card";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const rangeDays = params.range === "7" ? 7 : params.range === "90" ? 90 : 30;
  const [summary, quota, alerts, agency, aiUsage, aiBalance] = await Promise.all([
    getAnalyticsSummary(rangeDays),
    listRateLimitStatus(),
    checkUsageAlerts(),
    getClientAgencyReport(rangeDays),
    getAiUsageAnalytics(rangeDays),
    getWorkspaceAiBillingStatus(),
  ]);

  const metrics = [
    { label: "Comments sent", value: summary.sends },
    { label: "Send failures", value: summary.failedSends },
    { label: "Pending approvals", value: summary.approvalsPending },
    { label: "Approvals decided", value: summary.approvalsDone },
    { label: "Posts published", value: summary.publishes },
    { label: "New leads", value: summary.leadsNew },
    { label: "Leads won", value: summary.leadsWon },
    { label: "Skill runs", value: summary.skillRuns },
    { label: "Healthy accounts", value: summary.healthyAccounts },
    { label: "Degraded accounts", value: summary.degradedAccounts },
  ];

  const aiRemaining = (() => {
    const monthly = BigInt(aiBalance.monthlyCredits || "0");
    const used = BigInt(aiBalance.usedThisPeriod || "0");
    return (monthly > used ? monthly - used : 0n).toString();
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description={`Workspace KPIs for the last ${summary.rangeDays} days. Period ${quota.periodKey}.`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border">
              {[
                { value: "7", label: "7d" },
                { value: "30", label: "30d" },
                { value: "90", label: "90d" },
              ].map((opt) => (
                <Link
                  key={opt.value}
                  href={`/app/analytics?range=${opt.value}`}
                  className={`px-3 py-1.5 text-sm ${
                    rangeDays === Number(opt.value)
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  } ${opt.value === "7" ? "rounded-l-md" : ""} ${
                    opt.value === "90" ? "rounded-r-md" : ""
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
            <Button variant="outline" render={<Link href="/app/rate-limits" />} nativeButton={false}>
              Rate limits
            </Button>
          </div>
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

      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">AI credit balance</CardTitle>
          <CardDescription>
            Tier {aiBalance.tier} · subscription remaining {new Intl.NumberFormat("id-ID").format(Number(aiRemaining))} · PAYG{" "}
            {new Intl.NumberFormat("id-ID").format(Number(aiBalance.paygBalance || "0"))}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 p-4 pt-2">
          <Button size="sm" variant="outline" render={<Link href="/app/settings/ai" />} nativeButton={false}>
            Manage AI billing
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/app/checkout" />} nativeButton={false}>
            Top up credits
          </Button>
        </CardContent>
      </Card>

      <AiUsageCard data={aiUsage} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
        <PlatformMixCard
          title="Comment sends by platform"
          description={`Last ${summary.rangeDays} days`}
          rows={summary.sendsByPlatform}
          exportAction={async () => {
            "use server";
            return exportCommentSendsCsv(rangeDays);
          }}
          exportLabel="Export CSV"
        />
        <PlatformMixCard
          title="Publishes by platform"
          description={`Last ${summary.rangeDays} days`}
          rows={summary.publishesByPlatform}
          exportAction={async () => {
            "use server";
            return exportPublishesCsv(rangeDays);
          }}
          exportLabel="Export CSV"
        />
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
                <div key={row.kind} className="flex items-center justify-between glass rounded-xl border-white/10 px-3 py-2">
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
                className="grid gap-2 glass rounded-xl border-white/10 px-3 py-3 sm:grid-cols-2 lg:grid-cols-4"
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
