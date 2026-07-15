import { PageHeader } from "@/components/app/page-header";
import { listInbox } from "@/server/comment-pipeline";

export default async function InboxPage() {
  const posts = await listInbox();

  return (
    <div>
      <PageHeader title="Inbox" description="Discovered posts and latest generated drafts." />
      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="rounded-2xl border border bg-background p-6 text-sm text-muted-foreground">
            Inbox empty. Poll a listener first.
          </div>
        ) : (
          posts.map((post) => {
            const draft = post.drafts[0];
            return (
              <div key={post.id} className="rounded-2xl border border bg-background p-4">
                <div className="text-xs text-muted-foreground">
                  @{post.authorHandle} · {post.platform} · {post.status}
                </div>
                <div className="mt-2 text-sm">{post.content}</div>
                {draft ? (
                  <div className="mt-3 rounded-lg bg-muted/30 p-3 text-sm">
                    <div className="text-xs text-muted-foreground">Draft · {draft.status}</div>
                    <div className="mt-1">{draft.content}</div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
