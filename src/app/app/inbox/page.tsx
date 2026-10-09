import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ListPagination, getPageWindow } from "@/components/app/list-pagination";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { InboxCaptureButton } from "@/components/inbox/inbox-capture-button";
import { InboxGenerateDraftButton } from "@/components/inbox/inbox-generate-draft-button";
import { AutoRefreshIndicator } from "@/components/app/auto-refresh";
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
import {
  AssigneeBadge,
  AssigneeSelect,
  DraftList,
  RiskBadges,
  TemplateSelect,
} from "@/components/triage/triage-bits";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { messages } from "@/lib/i18n/messages";
import {
  assignTargetPost,
  countInbox,
  listInbox,
  applyInboxTemplate,
  type InboxSort,
} from "@/server/comment-pipeline";
import { listCommentTemplates } from "@/server/templates";
import { listWorkspaceAssignees } from "@/server/triage";

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

function normalizeSort(raw?: string): InboxSort {
  if (raw === "oldest" || raw === "newest" || raw === "risk") return raw;
  return "risk";
}

function inboxHref(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const str = qs.toString();
  return str ? `/app/inbox?${str}` : "/app/inbox";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    platform?: string;
    assignee?: string;
    priority?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const t = messages[locale].triage;
  const status = (params.status || "").trim();
  const platform = (params.platform || "").trim();
  const sort = normalizeSort(params.sort);
  const requestedPage = Math.max(Number(params.page) || 1, 1);
  const baseParams = {
    q: params.q,
    status: params.status,
    platform: params.platform,
    assignee: params.assignee,
    priority: params.priority,
    sort: params.sort,
  };

  const [posts, counts, members, templates] = await Promise.all([
    listInbox({
      status: status || undefined,
      platform: platform || undefined,
      q: params.q,
      assignee: params.assignee || undefined,
      priority: params.priority || undefined,
      sort,
      page: requestedPage,
      pageSize: 50,
    }),
    // Count queries (not a second full findMany) so "All (n)" reflects the
    // real total beyond the first page instead of min(n, 50).
    countInbox({
      platform: platform || undefined,
      q: params.q,
      assignee: params.assignee || undefined,
    }),
    listWorkspaceAssignees(),
    listCommentTemplates({ isActive: true }),
  ]);
  const { total, drafted } = counts;
  const window = getPageWindow(total, requestedPage, 50);
  const leadCaptureEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.leadCapture);

  async function assign(formData: FormData) {
    "use server";
    await assignTargetPost({
      postId: String(formData.get("postId")),
      assigneeId: (formData.get("assigneeId") as string) || null,
    });
    revalidatePath("/app/inbox");
  }

  async function useTemplate(formData: FormData) {
    "use server";
    const templateId = String(formData.get("templateId") || "");
    if (!templateId) return;
    await applyInboxTemplate({
      postId: String(formData.get("postId")),
      templateId,
    });
    revalidatePath("/app/inbox");
  }

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Discovered posts and latest generated drafts. Capture promising authors as leads."
        action={
          <div className="flex items-center gap-3">
            <AutoRefreshIndicator intervalMs={15000} />
            <Button variant="glass" render={<Link href="/app/mentions" />} nativeButton={false}>
              Open mentions
            </Button>
          </div>
        }
      />
      <InboxFilterTabs
        statuses={STATUS_TABS}
        platforms={PLATFORM_TABS}
        activeStatus={status || "all"}
        activePlatform={platform || "all"}
        counts={{ total, drafted, undrafted: total - drafted }}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">{t.assigneeLabel}:</span>
        <Link
          href={inboxHref({ ...baseParams, assignee: undefined })}
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          {t.assigneeAll}
        </Link>
        <Link
          href={inboxHref({ ...baseParams, assignee: "unassigned" })}
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          {t.assigneeUnassignedOnly}
        </Link>
        <span className="text-muted-foreground">{t.priorityLabel}:</span>
        <Link
          href={inboxHref({ ...baseParams, priority: undefined })}
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          {t.priorityAll}
        </Link>
        <Link
          href={inboxHref({ ...baseParams, priority: "high" })}
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          {t.priorityHigh}
        </Link>
        <span className="text-muted-foreground">{t.sortLabel}:</span>
        {(
          [
            ["risk", t.sortRisk],
            ["oldest", t.sortOldest],
            ["newest", t.sortNewest],
          ] as Array<[string, string]>
        ).map(([value, label]) => (
          <Link
            key={value}
            href={inboxHref({ ...baseParams, sort: value === "risk" ? undefined : value })}
            className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {label}
          </Link>
        ))}
      </div>
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
            const hasDrafts = post.drafts.length > 0;
            return (
              <Card key={post.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        <span>@{post.authorHandle} · {post.platform} · {post.status}</span>
                        <Badge variant={hasDrafts ? "default" : "secondary"} className="text-[10px]">
                          {hasDrafts ? "draft ready" : "needs draft"}
                        </Badge>
                        <RiskBadges triage={post.triage} />
                      </CardDescription>
                      <CardTitle className="text-base font-normal leading-relaxed">
                        {post.content}
                      </CardTitle>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <AssigneeBadge assignee={post.assignee} />
                        {post.drafts.length > 1 ? (
                          <span className="text-xs text-muted-foreground">
                            {t.draftsCount.replace("{count}", String(post.drafts.length))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {leadCaptureEnabled ? (
                      <InboxCaptureButton targetPostId={post.id} />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <form action={assign} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="postId" value={post.id} />
                    <AssigneeSelect
                      id={`assignee-${post.id}`}
                      name="assigneeId"
                      defaultValue={post.assigneeId || ""}
                      members={members}
                      unassignedLabel={t.unassigned}
                    />
                    <Button type="submit" size="sm" variant="glass">
                      {t.assignButton}
                    </Button>
                  </form>

                  <DraftList drafts={post.drafts} emptyLabel={t.emptyDrafts} />

                  {hasDrafts ? null : (
                    <div className="flex justify-end">
                      <InboxGenerateDraftButton postId={post.id} />
                    </div>
                  )}
                  {templates.length > 0 ? (
                    <form action={useTemplate} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="postId" value={post.id} />
                      <span className="text-xs text-muted-foreground">{t.savedReplyLabel}</span>
                      <TemplateSelect
                        id={`template-${post.id}`}
                        name="templateId"
                        templates={templates}
                        placeholder={t.savedReplyPlaceholder}
                      />
                      <Button type="submit" size="sm" variant="glass">
                        {t.useTemplateButton}
                      </Button>
                    </form>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t.noTemplates}</p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      <ListPagination
        pathname="/app/inbox"
        searchParams={{
          q: params.q,
          status: params.status,
          platform: params.platform,
          assignee: params.assignee,
          priority: params.priority,
          sort: params.sort,
        }}
        window={window}
      />
    </div>
  );
}
