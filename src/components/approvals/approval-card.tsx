"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CaptureLeadButton } from "@/components/approvals/capture-lead-button";
import { decideApproval } from "@/server/comment-pipeline";

type Props = {
  approval: {
    id: string;
    createdAt: Date | string;
    campaign?: { name: string } | null;
    targetPost: { authorHandle: string; content: string };
    commentDraft: { content: string; riskFlags: string[] };
  };
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string, checked: boolean) => void;
  showLeadCapture?: boolean;
};

export function ApprovalCard({
  approval,
  selectable,
  selected,
  onToggleSelect,
  showLeadCapture = true,
}: Props) {
  const [editedContent, setEditedContent] = useState(approval.commentDraft.content);
  const [note, setNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [pending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      await decideApproval({
        approvalId: approval.id,
        decision: "approved",
        editedContent: editedContent || undefined,
        note: note || undefined,
      });
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      await decideApproval({
        approvalId: approval.id,
        decision: "rejected",
        note: rejectNote || "Rejected from queue",
      });
    });
  };

  const createdLabel =
    typeof approval.createdAt === "string"
      ? approval.createdAt
      : approval.createdAt.toISOString().slice(0, 19).replace("T", " ") + " UTC";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {selectable && onToggleSelect ? (
              <Checkbox
                className="size-5"
                checked={!!selected}
                onCheckedChange={(checked) => onToggleSelect(approval.id, checked === true)}
                aria-label={`Select approval ${approval.id}`}
              />
            ) : null}
            <span className="truncate text-sm font-medium">
              {approval.campaign?.name || "Campaign"} · @{approval.targetPost.authorHandle}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{createdLabel}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Target post</div>
            <div className="mt-2 text-sm text-muted-foreground">@{approval.targetPost.authorHandle}</div>
            <div className="mt-1 text-sm leading-relaxed">{approval.targetPost.content}</div>
            {approval.commentDraft.riskFlags.length > 0 ? (
              <div className="mt-2 text-xs text-destructive">
                Risk: {approval.commentDraft.riskFlags.join(", ")}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`draft-${approval.id}`}>Comment draft</Label>
              <Textarea
                id={`draft-${approval.id}`}
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-28 text-base sm:text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`note-${approval.id}`}>Approval note (optional)</Label>
              <Textarea
                id={`note-${approval.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-16 text-base sm:text-sm"
                placeholder="Why approve?"
              />
            </div>

            <div className="sticky bottom-0 z-10 -mx-6 border-t bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="min-h-11 flex-1 sm:min-h-9"
                  onClick={handleApprove}
                  disabled={pending}
                >
                  {pending ? "Approving..." : "Approve & schedule"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 flex-1 sm:min-h-9"
                  onClick={handleReject}
                  disabled={pending}
                >
                  {pending ? "Rejecting..." : "Reject"}
                </Button>
              </div>
              {showLeadCapture ? (
                <div className="mt-2">
                  <CaptureLeadButton approvalId={approval.id} />
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 border-t pt-4">
              <Label htmlFor={`reject-note-${approval.id}`}>Reject note (optional)</Label>
              <Textarea
                id={`reject-note-${approval.id}`}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                className="min-h-16 text-base sm:text-sm"
                placeholder="Reason for rejection"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}