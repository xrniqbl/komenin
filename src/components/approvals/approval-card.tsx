"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
};

export function ApprovalCard({ approval, selectable, selected, onToggleSelect }: Props) {
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {selectable && onToggleSelect ? (
              <Checkbox
                checked={!!selected}
                onCheckedChange={(checked) => onToggleSelect(approval.id, checked === true)}
                aria-label={`Select approval ${approval.id}`}
              />
            ) : null}
            <span className="text-sm font-medium">
              {approval.campaign?.name || "Campaign"} · @{approval.targetPost.authorHandle}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{createdLabel}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Target post</div>
            <div className="mt-2 text-sm text-muted-foreground">@{approval.targetPost.authorHandle}</div>
            <div className="mt-1 text-sm">{approval.targetPost.content}</div>
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
                className="min-h-28"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`note-${approval.id}`}>Approval note (optional)</Label>
              <Textarea
                id={`note-${approval.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-16"
                placeholder="Why approve?"
              />
            </div>
            <Button type="button" onClick={handleApprove} disabled={pending}>
              {pending ? "Approving..." : "Approve & schedule"}
            </Button>

            <div className="flex flex-col gap-2 border-t pt-4">
              <Label htmlFor={`reject-note-${approval.id}`}>Reject note (optional)</Label>
              <Textarea
                id={`reject-note-${approval.id}`}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                className="min-h-16"
                placeholder="Reason for rejection"
              />
            </div>
            <Button type="button" variant="outline" onClick={handleReject} disabled={pending}>
              {pending ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}