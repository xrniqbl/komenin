import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { PageHeader } from "@/components/app/page-header";
import { ContentCalendar } from "@/components/content/content-calendar";
import { ContentPageActions } from "@/components/content/content-page-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getRuntimeModeLabel } from "@/lib/runtime-mode";
import { listContentCampaigns, listContentSchedule } from "@/server/content-campaigns";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "threads", label: "Threads" },
  { value: "tiktok", label: "TikTok" },
];

export default async function ContentCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; platform?: string }>;
}) {
  const params = await searchParams;
  const [campaigns, schedule] = await Promise.all([
    listContentCampaigns({ q: params.q, status: params.status, platform: params.platform }),
    listContentSchedule(120),
  ]);
  const mode = getRuntimeModeLabel();

  return (
    <div>
      <PageHeader
        title="Auto Post Campaigns"
        description="Generate original posts from a topic, then publish on a fixed interval. Drag & drop to reschedule."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant={mode === "simulator" ? "secondary" : "default"}>{mode} publisher</Badge>
            <ContentPageActions />
            <Button render={<Link href="/app/content/new" />} nativeButton={false}>
              New content campaign
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <FilterBar
          placeholder="Search content campaigns..."
          statusOptions={STATUS_OPTIONS}
          platformOptions={PLATFORM_OPTIONS}
          defaultQ={params.q || ""}
          defaultStatus={params.status || ""}
          defaultPlatform={params.platform || ""}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {campaigns.length === 0 ? (
            <EmptyState
              title={params.q || params.status || params.platform ? "No matching campaigns" : "No content campaigns yet"}
              description={
                params.q || params.status || params.platform
                  ? "Try adjusting search or filters."
                  : "Create a topic-based campaign, choose how many posts, and set the interval."
              }
              href="/app/content/new"
              actionLabel="Create campaign"
            />
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/app/content/${campaign.id}`}
                  className="block rounded-2xl border bg-background p-4 transition-colors hover:bg-accent/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-base font-semibold">{campaign.name}</div>
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{campaign.topic}</div>
                    </div>
                    <Badge variant="secondary">{campaign.status}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{campaign.platform}</span>
                    <span>
                      {campaign.postCount} posts · every {campaign.intervalValue} {campaign.intervalUnit}
                    </span>
                    <span>
                      generated {campaign.generatedCount}/{campaign.postCount}
                    </span>
                    <span>
                      published {campaign.publishedCount}/{campaign.postCount}
                    </span>
                    {campaign.socialAccount ? <span>@{campaign.socialAccount.username}</span> : null}
                  </div>
                </Link>
              ))}
              <div className="rounded-2xl border bg-background p-4 text-xs text-muted-foreground">
                Publisher mode: <span className="font-medium text-foreground">{mode}</span>. Simulator records fake
                external IDs. Live mode posts to SOCIAL_PUBLISH_WEBHOOK_URL when configured.
              </div>
            </div>
          )}
        </div>
        <div className="lg:col-span-3">
          <ContentCalendar
            title="Publish calendar"
            items={schedule.map((item) => ({
              id: item.id,
              sequence: item.sequence,
              title: item.title || item.contentCampaign.name,
              status: item.status,
              scheduledFor: item.scheduledFor,
              publishedAt: item.publishedAt,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
