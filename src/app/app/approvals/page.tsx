import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/app/page-header";
import { decideApproval, listApprovals } from "@/server/comment-pipeline";

export default async function ApprovalsPage() {
  const approvals = await listApprovals();

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Human-in-the-loop queue before comments are scheduled to send. Edit the draft, then approve or reject."
      />

      <div className="space-y-4">
        {approvals.length === 0 ? (
          <div className="rounded-2xl border bg-background p-6 text-sm text-muted-foreground">
            No pending approvals.
          </div>
        ) : (
          approvals.map((item) => (
            <div key={item.id} className="rounded-2xl border bg-background p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">
                  {item.campaign?.name || "Campaign"} · @{item.targetPost.authorHandle}
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.createdAt.toISOString().slice(0, 19).replace("T", " ")} UTC
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Target post
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    @{item.targetPost.authorHandle}
                  </div>
                  <div className="mt-1 text-sm">{item.targetPost.content}</div>
                  {item.commentDraft.riskFlags.length > 0 ? (
                    <div className="mt-2 text-xs text-destructive">
                      Risk: {item.commentDraft.riskFlags.join(", ")}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-4">
                  <form
                    action={async (formData) => {
                      "use server";
                      await decideApproval({
                        approvalId: item.id,
                        decision: "approved",
                        editedContent: String(formData.get("editedContent") || ""),
                        note: String(formData.get("note") || "") || undefined,
                      });
                    }}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`draft-${item.id}`}>Comment draft</Label>
                      <Textarea
                        id={`draft-${item.id}`}
                        name="editedContent"
                        defaultValue={item.commentDraft.content}
                        className="min-h-28"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`note-${item.id}`}>Approval note (optional)</Label>
                      <Textarea
                        id={`note-${item.id}`}
                        name="note"
                        className="min-h-16"
                        placeholder="Why approve?"
                      />
                    </div>
                    <Button type="submit">Approve & schedule</Button>
                  </form>

                  <form
                    action={async (formData) => {
                      "use server";
                      await decideApproval({
                        approvalId: item.id,
                        decision: "rejected",
                        note: String(formData.get("note") || "") || "Rejected from queue",
                      });
                    }}
                    className="flex flex-col gap-3 border-t pt-4"
                  >
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`reject-note-${item.id}`}>Reject note (optional)</Label>
                      <Textarea
                        id={`reject-note-${item.id}`}
                        name="note"
                        className="min-h-16"
                        placeholder="Reason for rejection"
                      />
                    </div>
                    <Button type="submit" variant="outline">
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}