import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { decideApproval, listApprovals } from "@/server/comment-pipeline";

export default async function ApprovalsPage() {
  const approvals = await listApprovals();

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Human-in-the-loop queue before comments are scheduled to send."
      />

      <div className="space-y-4">
        {approvals.length === 0 ? (
          <div className="rounded-2xl border border bg-background p-6 text-sm text-muted-foreground">
            No pending approvals.
          </div>
        ) : (
          approvals.map((item) => (
            <div key={item.id} className="rounded-2xl border border bg-background p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Target post</div>
                  <div className="mt-2 text-sm text-muted-foreground">@{item.targetPost.authorHandle}</div>
                  <div className="mt-1 text-sm">{item.targetPost.content}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">AI draft</div>
                  <div className="mt-2 text-sm">{item.commentDraft.content}</div>
                  {item.commentDraft.riskFlags.length > 0 ? (
                    <div className="mt-2 text-xs text-[var(--signal-danger)]">
                      Risk: {item.commentDraft.riskFlags.join(", ")}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <form
                  action={async () => {
                    "use server";
                    await decideApproval({ approvalId: item.id, decision: "approved" });
                  }}
                >
                  <Button type="submit" variant="default" >
                    Approve & schedule
                  </Button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await decideApproval({ approvalId: item.id, decision: "rejected", note: "Rejected from queue" });
                  }}
                >
                  <Button type="submit" variant="outline" >
                    Reject
                  </Button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
