import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { executeDueSends, listActivity } from "@/server/comment-pipeline";

export default async function ActivityPage() {
  const actions = await listActivity();

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Send queue and execution log with human-like delay simulation."
        action={
          <form
            action={async () => {
              "use server";
              await executeDueSends();
            }}
          >
            <Button type="submit" variant="default" >
              Execute due sends
            </Button>
          </form>
        }
      />

      <div className="overflow-hidden rounded-2xl border border bg-background">
        {actions.length === 0 ? (
          <div className="px-4 py-10 text-sm text-muted-foreground">No actions yet.</div>
        ) : (
          actions.map((action) => (
            <div key={action.id} className="border-b border px-4 py-3 text-sm last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{action.status}</div>
                <div className="text-xs text-muted-foreground">
                  {action.scheduledFor ? `scheduled ${action.scheduledFor.toISOString().slice(0, 19)}` : "—"}
                </div>
              </div>
              <div className="mt-1 text-muted-foreground">{action.resultMessage}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                post @{action.targetPost.authorHandle}
                {action.socialAccount ? ` · via @${action.socialAccount.username}` : ""}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
