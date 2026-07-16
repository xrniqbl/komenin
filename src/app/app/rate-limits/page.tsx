import { PageHeader } from "@/components/app/page-header";
import { QuotaMeter } from "@/components/analytics/quota-meter";
import { RateLimitGrid } from "@/components/analytics/rate-limit-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listRateLimitStatus } from "@/server/rate-limits";

export default async function RateLimitsPage() {
  const data = await listRateLimitStatus();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate Limits"
        description={`Monthly period ${data.periodKey} · ${data.throttledCount} throttled account(s).`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Monthly Sends</span>
              <Badge variant={data.workspace.sendsStatus === "ok" ? "secondary" : "destructive"}>{data.workspace.sendsStatus}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <QuotaMeter used={data.workspace.sendsUsed} limit={data.workspace.sendLimit} label="Sends" />
            <div className="mt-2 text-xs text-muted-foreground">Plan: {data.workspace.planCode}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Monthly Publishes</span>
              <Badge variant={data.workspace.publishesStatus === "ok" ? "secondary" : "destructive"}>{data.workspace.publishesStatus}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <QuotaMeter used={data.workspace.publishesUsed} limit={data.workspace.publishLimit} label="Publishes" />
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Account daily quotas</h3>
        <RateLimitGrid accounts={data.accounts} />
      </div>
    </div>
  );
}
