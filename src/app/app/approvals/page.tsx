import { PageHeader } from "@/components/app/page-header";
import { ApprovalsQueueClient } from "@/components/approvals/approvals-queue-client";
import { AutoRefreshIndicator } from "@/components/app/auto-refresh";
import { isApprovalOverdue } from "@/lib/approval-sla";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { messages } from "@/lib/i18n/messages";
import { listApprovalCampaigns, listApprovals } from "@/server/comment-pipeline";
import { Badge } from "@/components/ui/badge";

function normalizeRisk(raw?: string): "all" | "risk" | "clean" {
  if (raw === "risk" || raw === "clean") return raw;
  return "all";
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; risk?: string; campaign?: string }>;
}) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const t = messages[locale].approvals;
  const risk = normalizeRisk(params.risk);
  const status = params.status || "pending";
  const campaignId = params.campaign?.trim() || "";

  const [approvals, campaigns] = await Promise.all([
    listApprovals({ status, campaignId: campaignId || undefined }),
    listApprovalCampaigns(),
  ]);

  // Overdue counts only apply to the pending backlog (decided items have left
  // the SLA window). The full-quarter summary is computed server-side so the
  // header number stays correct even when client search/risk filters narrow
  // the visible list.
  const overdueCount =
    status === "pending" || !params.status
      ? approvals.filter((a) => isApprovalOverdue(a.createdAt)).length
      : 0;

  return (
    <div>
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <div className="flex items-center gap-2">
            {overdueCount > 0 ? (
              <Badge variant="destructive">
                {t.overdueCount.replace("{count}", String(overdueCount))}
              </Badge>
            ) : null}
            <AutoRefreshIndicator intervalMs={15000} />
          </div>
        }
      />
      <ApprovalsQueueClient
        approvals={approvals}
        campaigns={campaigns}
        initialStatus={status}
        initialRisk={risk}
        initialCampaignId={campaignId}
        locale={locale}
      />
    </div>
  );
}
