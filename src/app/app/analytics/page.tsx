import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { QuotaMeter } from "@/components/analytics/quota-meter";
import { PlatformMixCard } from "@/components/analytics/platform-mix-card";
import { AnalyticsExportButtons } from "@/components/analytics/analytics-export-buttons";
import { FunnelCard } from "@/components/analytics/funnel-card";
import { CampaignRoiCard } from "@/components/analytics/campaign-roi-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAnalyticsSummary,
  getClientAgencyReport,
  getAiUsageAnalytics,
  getAnalyticsFunnel,
  getCampaignRoiReport,
  exportCommentSendsCsv,
  exportPublishesCsv,
} from "@/server/analytics";
import { getWorkspaceAiBillingStatus } from "@/server/ai-providers";
import { listRateLimitStatus } from "@/server/rate-limits";
import { checkUsageAlerts } from "@/server/usage-alerts";
import { AiUsageCard } from "@/components/analytics/ai-usage-card";
import { messages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/request-locale";

type SectionKey =
  | "summary"
  | "quota"
  | "alerts"
  | "agency"
  | "aiUsage"
  | "aiBalance"
  | "funnel"
  | "roi";

async function settled<T>(key: SectionKey, fn: () => Promise<T>) {
  try {
    return { key, ok: true as const, value: await fn() };
  } catch (error) {
    console.error(`[analytics] section "${key}" failed (partial)`, error);
    return { key, ok: false as const, error };
  }
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const t = messages[locale].analytics;
  const rangeDays = params.range === "7" ? 7 : params.range === "90" ? 90 : 30;

  // Partial-failure resistant: one failing source degrades its own card
  // instead of collapsing the whole page (allSettled semantics).
  const [summaryRes, quotaRes, alertsRes, agencyRes, aiUsageRes, aiBalanceRes, funnelRes, roiRes] =
    await Promise.all([
      settled("summary", () => getAnalyticsSummary(rangeDays)),
      settled("quota", () => listRateLimitStatus()),
      settled("alerts", () => checkUsageAlerts()),
      settled("agency", () => getClientAgencyReport(rangeDays)),
      settled("aiUsage", () => getAiUsageAnalytics(rangeDays)),
      settled("aiBalance", () => getWorkspaceAiBillingStatus()),
      settled("funnel", () => getAnalyticsFunnel(rangeDays)),
      settled("roi", () => getCampaignRoiReport(rangeDays)),
    ]);

  const failedSections = [
    summaryRes,
    quotaRes,
    alertsRes,
    agencyRes,
    aiUsageRes,
    aiBalanceRes,
    funnelRes,
    roiRes,
  ].filter((r) => !r.ok);

  const summary = summaryRes.ok ? summaryRes.value : null;
  const quota = quotaRes.ok ? quotaRes.value : null;
  const alerts = alertsRes.ok ? alertsRes.value : [];
  const agency = agencyRes.ok ? agencyRes.value : null;
  const aiUsage = aiUsageRes.ok ? aiUsageRes.value : null;
  const aiBalance = aiBalanceRes.ok ? aiBalanceRes.value : null;
  const funnel = funnelRes.ok ? funnelRes.value : null;
  const roi = roiRes.ok ? roiRes.value : null;

  const metrics = summary
    ? [
        { label: t.metrics.sends, value: summary.sends },
        { label: t.metrics.failedSends, value: summary.failedSends },
        { label: t.metrics.approvalsPending, value: summary.approvalsPending },
        { label: t.metrics.approvalsDone, value: summary.approvalsDone },
        { label: t.metrics.publishes, value: summary.publishes },
        { label: t.metrics.leadsNew, value: summary.leadsNew },
        { label: t.metrics.leadsWon, value: summary.leadsWon },
        { label: t.metrics.skillRuns, value: summary.skillRuns },
        { label: t.metrics.healthyAccounts, value: summary.healthyAccounts },
        { label: t.metrics.degradedAccounts, value: summary.degradedAccounts },
      ]
    : [];

  function formatBigIntString(value: string | null | undefined): string {
    const digits = (value || "0").replace(/[^0-9]/g, "") || "0";
    const normalized = digits.replace(/^0+(?=\d)/, "");
    return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  const aiRemaining = (() => {
    if (!aiBalance) return "0";
    const monthly = BigInt(aiBalance.monthlyCredits || "0");
    const used = BigInt(aiBalance.usedThisPeriod || "0");
    return (monthly > used ? monthly - used : 0n).toString();
  })();

  const rangeLabel = rangeDays === 7 ? t.range7d : rangeDays === 90 ? t.range90d : t.range30d;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={
          quota
            ? t.rangeDescription
                .replace("{days}", String(summary?.rangeDays ?? rangeDays))
                .replace("{period}", quota.periodKey)
            : t.rangeDescription
                .replace("{days}", String(rangeDays))
                .replace("{period}", "—")
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border">
              {[
                { value: "7", label: rangeDays === 7 ? rangeLabel : "7d" },
                { value: "30", label: rangeDays === 30 ? rangeLabel : "30d" },
                { value: "90", label: rangeDays === 90 ? rangeLabel : "90d" },
              ].map((opt) => (
                <Link
                  key={opt.value}
                  href={`/app/analytics?range=${opt.value}`}
                  className={`px-3 py-1.5 text-sm ${
                    rangeDays === Number(opt.value)
                      ? "bg-electric-500 text-white shadow-[0_0_16px_rgba(46,124,246,0.4)]"
                      : "text-muted-foreground hover:text-foreground"
                  } ${opt.value === "7" ? "rounded-l-md" : ""} ${
                    opt.value === "90" ? "rounded-r-md" : ""
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
            <AnalyticsExportButtons
              rangeDays={rangeDays}
              labels={{ exportCsv: t.exportCsv, exporting: t.exporting }}
            />
            <Button variant="glass" render={<Link href="/app/rate-limits" />} nativeButton={false}>
              {t.rateLimits}
            </Button>
          </div>
        }
      />

      {failedSections.length > 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            {t.partialFailure}{" "}
            {failedSections.map((s) => s.key).join(", ")}
          </AlertDescription>
        </Alert>
      ) : null}

      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <Alert key={i} variant="warning">
              <AlertDescription>{alert}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}

      {quota ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                <span>{t.monthlySends}</span>
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
                <span>{t.monthlyPublishes}</span>
                <Badge variant={quota.workspace.publishesStatus === "ok" ? "secondary" : "destructive"}>{quota.workspace.publishesStatus}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <QuotaMeter used={quota.workspace.publishesUsed} limit={quota.workspace.publishLimit} label="Publishes" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Alert variant="warning">
          <AlertDescription>
            {t.partialFailureDetail.replace("{section}", "Quota")}
          </AlertDescription>
        </Alert>
      )}

      {aiBalance ? (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">{t.aiCreditBalance}</CardTitle>
            <CardDescription>
              Tier {aiBalance.tier} · subscription remaining {formatBigIntString(aiRemaining)} · PAYG{" "}
              {formatBigIntString(aiBalance.paygBalance || "0")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2 p-4 pt-2">
            <Button size="sm" variant="glass" render={<Link href="/app/settings/ai" />} nativeButton={false}>
              Manage AI billing
            </Button>
            <Button size="sm" variant="glass" render={<Link href="/app/checkout" />} nativeButton={false}>
              Top up credits
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {aiUsage ? (
        <AiUsageCard data={aiUsage} />
      ) : (
        <Alert variant="warning">
          <AlertDescription>
            {t.partialFailureDetail.replace("{section}", "AI usage")}
          </AlertDescription>
        </Alert>
      )}

      {funnel ? (
        <FunnelCard
          title={t.funnelTitle}
          description={`${t.funnelDescription} · ${funnel.rangeDays}d`}
          stages={funnel.stages.map((s) => ({
            ...s,
            label:
              s.key === "listeners"
                ? "Active listeners"
                : s.key === "posts"
                  ? "Target posts"
                  : s.key === "drafts"
                    ? "Comment drafts"
                    : s.key === "approvals"
                      ? "Approvals decided"
                      : s.key === "sends"
                        ? t.metrics.sends
                        : t.metrics.publishes,
          }))}
          footer={t.funnelFooter
            .replace("{postsToSends}", formatPct(funnel.endToEnd.postsToSends))
            .replace("{draftsToSends}", formatPct(funnel.endToEnd.draftsToSends))
            .replace("{pending}", String(funnel.approvalsPending))}
          labels={{ conversion: t.funnelConversion, noData: t.funnelEmpty }}
        />
      ) : (
        <Alert variant="warning">
          <AlertDescription>
            {t.partialFailureDetail.replace("{section}", t.funnelTitle)}
          </AlertDescription>
        </Alert>
      )}

      {roi ? (
        <CampaignRoiCard
          title={t.roiTitle}
          description={`Last ${roi.rangeDays} days`}
          totals={roi.totals}
          rows={roi.rows}
          labels={{
            campaign: t.roiCampaign,
            drafts: t.roiDrafts,
            approved: t.roiApproved,
            approvalRate: t.roiApprovalRate,
            sent: t.roiSent,
            leads: t.roiLeads,
            perDay: t.roiPerDay,
            noData: t.roiEmpty,
          }}
        />
      ) : (
        <Alert variant="warning">
          <AlertDescription>
            {t.partialFailureDetail.replace("{section}", t.roiTitle)}
          </AlertDescription>
        </Alert>
      )}

      {summary ? (
        <>
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
              title={t.sendsByPlatform}
              description={`Last ${summary.rangeDays} days`}
              rows={summary.sendsByPlatform}
              exportAction={async () => {
                "use server";
                return exportCommentSendsCsv(rangeDays);
              }}
              exportLabel={t.exportCsv}
            />
            <PlatformMixCard
              title={t.publishesByPlatform}
              description={`Last ${summary.rangeDays} days`}
              rows={summary.publishesByPlatform}
              exportAction={async () => {
                "use server";
                return exportPublishesCsv(rangeDays);
              }}
              exportLabel={t.exportCsv}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.deliveryMix}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {summary.deliveries.length === 0 ? (
                  <div className="text-muted-foreground">{t.noDeliveries}</div>
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
                <CardTitle className="text-base">{t.planUsage}</CardTitle>
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
        </>
      ) : (
        <Alert variant="warning">
          <AlertDescription>
            {t.partialFailureDetail.replace("{section}", "Summary")}
          </AlertDescription>
        </Alert>
      )}

      {agency ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">{t.agencyTitle}</CardTitle>
                <CardDescription>
                  Last {agency.rangeDays} days · {agency.totals.clients} clients ·{" "}
                  {agency.totals.leads} leads · {agency.totals.leadsDue} due follow-ups ·{" "}
                  {agency.totals.sends} sends
                </CardDescription>
              </div>
              <Button variant="glass" render={<Link href="/app/clients" />} nativeButton={false}>
                {t.manageClients}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {agency.rows.length === 0 ? (
              <div className="text-muted-foreground">{t.agencyEmpty}</div>
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
                    Volume: {row.targetPosts} posts · {row.approvals} approvals · {row.drafts} drafts ·{" "}
                    {row.sends} sends
                    {row.sendsByPlatform.length > 0 ? (
                      <span className="block text-xs">
                        {row.sendsByPlatform.map((s) => `${s.platform} ${s.count}`).join(" · ")}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert variant="warning">
          <AlertDescription>
            {t.partialFailureDetail.replace("{section}", t.agencyTitle)}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
