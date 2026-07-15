import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { platformLabel } from "@/lib/session-routing";
import { listListeners, pollListener } from "@/server/listeners";

export default async function ListenersPage() {
  const listeners = await listListeners();

  return (
    <div>
      <PageHeader
        title="Listeners"
        description="Keyword, competitor, and trend watchers."
        action={<Button variant="default" render={<Link href="/app/listeners/new" />} nativeButton={false}>New listener</Button>}
      />
      <div className="overflow-hidden rounded-2xl border border bg-background">
        {listeners.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">No listeners yet.</div>
        ) : (
          listeners.map((listener) => (
            <div key={listener.id} className="flex items-center justify-between gap-3 border-b border px-4 py-3 text-sm last:border-b-0">
              <div>
                <div className="font-medium">{listener.query}</div>
                <div className="text-xs text-muted-foreground">
                  {platformLabel(listener.platform)} Â· {listener.type} Â· {listener._count.posts} posts
                </div>
              </div>
              <form
                action={async () => {
                  "use server";
                  await pollListener(listener.id);
                }}
              >
                <Button type="submit" variant="outline" >
                  Poll now
                </Button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
