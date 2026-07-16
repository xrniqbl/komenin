"use client";

import { useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { bulkDecideApprovals } from "@/server/comment-pipeline";
import { ApprovalCard } from "./approval-card";

type ApprovalData = {
  id: string;
  createdAt: Date;
  campaign?: { name: string } | null;
  targetPost: { authorHandle: string; content: string };
  commentDraft: { content: string; riskFlags: string[] };
};

export function ApprovalsQueueClient({ approvals }: { approvals: ApprovalData[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();
  const [bulkNote, setBulkNote] = useState("");

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(approvals.map((a) => a.id)));
    else setSelected(new Set());
  };

  const handleBulkApprove = () => {
    if (selected.size === 0) return;
    startBulkTransition(async () => {
      await bulkDecideApprovals({
        approvalIds: Array.from(selected),
        decision: "approved",
        note: bulkNote || undefined,
      });
      setSelected(new Set());
    });
  };

  const handleBulkReject = () => {
    if (selected.size === 0) return;
    startBulkTransition(async () => {
      await bulkDecideApprovals({
        approvalIds: Array.from(selected),
        decision: "rejected",
        note: bulkNote || "Bulk rejected",
      });
      setSelected(new Set());
    });
  };

  if (approvals.length === 0) {
    return (
      <div className="rounded-2xl border bg-background p-8 text-center">
        <div className="text-sm font-medium">No pending approvals</div>
        <div className="mt-1 text-xs text-muted-foreground">
          New drafts will appear here once campaigns discover target posts.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={selected.size === approvals.length && approvals.length > 0}
              onCheckedChange={(checked) => toggleAll(checked === true)}
              aria-label="Select all approvals"
            />
            Select all
          </label>
          {selected.size > 0 ? (
            <Badge variant="secondary">{selected.size} selected</Badge>
          ) : (
            <Badge variant="outline">{approvals.length} pending</Badge>
          )}
        </div>

        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="text"
              placeholder="Bulk note (optional)"
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              className="h-8 min-w-[160px]"
            />
            <Button
              size="sm"
              onClick={handleBulkApprove}
              disabled={bulkPending}
            >
              {bulkPending ? "..." : `Approve ${selected.size}`}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkReject}
              disabled={bulkPending}
            >
              Reject {selected.size}
            </Button>
          </div>
        ) : null}
      </div>

      {bulkPending ? (
        <Alert>
          <AlertTitle>Processing bulk action</AlertTitle>
          <AlertDescription>Applying decision to {selected.size} approvals...</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        {approvals.map((item) => (
          <ApprovalCard
            key={item.id}
            approval={item}
            selectable
            selected={selected.has(item.id)}
            onToggleSelect={toggleOne}
          />
        ))}
      </div>
    </div>
  );
}
