import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { ContentCalendar } from "@/components/content/content-calendar";
import { ContentCampaignActions } from "@/components/content/content-campaign-actions";
import { ContentDraftCard } from "@/components/content/content-draft-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";
import { getContentCampaign } from "@/server/content-campaigns";

export default async function ContentCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const campaign = await getContentCampaign(campaignId);
  if (!campaign) notFound();
  const mode = getRuntimeModeLabel();
  const pendingCount = campaign.drafts.filter((draft) => draft.status === "pending").length;

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={`${campaign.platform} · every ${campaign.intervalValue} ${campaign.intervalUnit} · ${campaign.mode}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={mode === "simulator" ? "secondary" : "default"}>{mode} publisher</Badge>
            <Button variant="outline" render={<Link href="/app/content" />} nativeButton={false}>
              Back
            </Button>
            <ContentCampaignActions campaignId={campaign.id} pendingCount={pendingCount} />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground lg:col-span-2">
          <div className="font-medium text-foreground">Topic</div>
          <div className="mt-1">{campaign.topic}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{campaign.status}</Badge>
            <Badge variant="outline">
              generated {campaign.generatedCount}/{campaign.postCount}
            </Badge>
            <Badge variant="outline">
              published {campaign.publishedCount}/{campaign.postCount}
            </Badge>
            {campaign.socialAccount ? (
              <Badge variant="outline">@{campaign.socialAccount.username}</Badge>
            ) : (
              <Badge variant="outline">no account assigned</Badge>
            )}
          </div>
          <div className="mt-3 text-xs">
            Publisher: <span className="font-medium text-foreground">{mode}</span>. Live mode uses
            SOCIAL_PUBLISH_WEBHOOK_URL when configured; otherwise fails closed.
          </div>
        </div>
        <div className="lg:col-span-3">
          <ContentCalendar
            title="Schedule"
            items={campaign.drafts.map((draft) => ({
              id: draft.id,
              sequence: draft.sequence,
              title: draft.title,
              status: draft.status,
              scheduledFor: draft.scheduledFor,
              publishedAt: draft.publishedAt,
            }))}
          />
        </div>
      </div>

      <div className="space-y-4">
        {campaign.drafts.length === 0 ? (
          <div className="rounded-2xl border bg-background p-6 text-sm text-muted-foreground">
            No drafts yet. Click regenerate.
          </div>
        ) : (
          campaign.drafts.map((draft) => <ContentDraftCard key={draft.id} draft={draft} />)
        )}
      </div>
    </div>
  );
}
