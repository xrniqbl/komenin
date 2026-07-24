import { PageHeader } from "@/components/app/page-header";
import { InboxCaptureButton } from "@/components/inbox/inbox-capture-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { FEATURE_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import { listInbox } from "@/server/comment-pipeline";

export default async function InboxPage() {
  const posts = await listInbox();
  const leadCaptureEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.leadCapture);

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Discovered posts and latest generated drafts. Capture promising authors as leads."
      />
      <div className="space-y-3">
        {posts.length === 0 ? (
          <Card className="gap-0 py-0">
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>Inbox empty</EmptyTitle>
                <EmptyDescription>
                  Poll a listener first to discover target posts.
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
                      <CardDescription>
                        @{post.authorHandle} · {post.platform} · {post.status}
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
