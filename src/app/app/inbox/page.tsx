import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { InboxCaptureButton } from "@/components/inbox/inbox-capture-button";
import { InboxFilterTabs } from "@/components/inbox/inbox-filter-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { listInbox } from "@/server/comment-pipeline";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "drafted", label: "Drafted" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "skipped", label: "Skipped" },
  { value: "failed", label: "Failed" },
];

const PLATFORM_TABS = [
  { value: "all", label: "All" },
  { value: "instagram", label: "Instagram" },
  { value: "threads", label: "Threads" },
  { value: "tiktok", label: "TikTok" },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; platform?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status || "").trim();
  const platform = (params.platform || "").trim();
  const posts = await listInbox({
    status: status || undefined,
    platform: platform || undefined,
    q: params.q,
  });
  const leadCaptureEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.leadCapture);

  const drafted = posts.filter((p) => p.drafts.length > 0).length;

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Discovered posts and latest generated drafts. Capture promising authors as leads."
        action={
          <Button variant="outline" render={<Link href="/app/mentions" />} nativeButton={false}>
            Open mentions
          </Button>
        }
      />
      <InboxFilterTabs
        statuses={STATUS_TABS}
        platforms={PLATFORM_TABS}
        activeStatus={status || "all"}
        activePlatform={platform || "all"}
        counts={{ total: posts.length, drafted, undrafted: posts.length - drafted }}
      />
      <div className="mb-4">
        <FilterBar
          placeholder="Search handle or post text…"
          defaultQ={params.q || ""}
        />
      </div>
      <div className="space-y-3">
        {posts.length === 0 ? (
          <Card className="gap-0 py-0">
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>Inbox empty</EmptyTitle>
                <EmptyDescription>
                  {params.q || status || platform
                    ? "No posts match these filters. Clear the search or pick another tab."
                    : "Poll a listener first to discover target posts."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          posts.map((post) => {
            const draft = post.drafts[0];
            return (
              <Card key={post.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        <span>@{post.authorHandle} · {post.platform} · {post.status}</span>
                        <Badge variant={draft ? "default" : "secondary"} className="text-[10px]">
                          {draft ? "draft ready" : "needs draft"}
                        </Badge>
                      </CardDescription>
                      <CardTitle className="text-base font-normal leading-relaxed">
                        {post.content}
                      </CardTitle>
                    </div>
                    {leadCaptureEnabled ? (
                      <InboxCaptureButton targetPostId={post.id} />
                    ) : null}
                  </div>
                </CardHeader>
                {draft ? (
                  <CardContent>
                    <div className="rounded-lg bg-muted/30 p-3 text-sm">
                      <div className="text-xs text-muted-foreground">
                        Draft · {draft.status}
                      </div>
                      <div className="mt-1">{draft.content}</div>
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
