"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { bulkDecideApprovals } from "@/server/comment-pipeline";
import { ApprovalCard } from "./approval-card";

type ApprovalData = {
  id: string;
  createdAt: Date;
  campaign?: { name: string } | null;
  targetPost: { authorHandle: string; content: string };
  commentDraft: { content: string; riskFlags: string[] };
};

type RiskFilter = "all" | "risk" | "clean";

export function ApprovalsQueueClient({ approvals }: { approvals: ApprovalData[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();
  const [bulkNote, setBulkNote] = useState("");
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [focusIndex, setFocusIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return approvals.filter((item) => {
      const flags = item.commentDraft.riskFlags || [];
      const hasRisk = flags.length > 0;
      if (riskFilter === "risk" && !hasRisk) return false;
      if (riskFilter === "clean" && hasRisk) return false;
      if (!q) return true;
      const haystack = [
        item.campaign?.name || "",
        item.targetPost.authorHandle,
        item.targetPost.content,
        item.commentDraft.content,
        flags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [approvals, query, riskFilter]);

  useEffect(() => {
    if (focusIndex >= filtered.length) {
      setFocusIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, focusIndex]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (filtered.length === 0) return;

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setFocusIndex((i) => Math.min(filtered.length - 1, i + 1));
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setFocusIndex((i) => Math.max(0, i - 1));
      } else if (event.key === "x" || event.key === " ") {
        event.preventDefault();
        const current = filtered[focusIndex];
        if (!current) return;
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(current.id)) next.delete(current.id);
          else next.add(current.id);
          return next;
        });
      } else if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSelected(new Set(filtered.map((a) => a.id)));
      } else if (event.key === "A" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        const current = filtered[focusIndex];
        if (!current || bulkPending) return;
        startBulkTransition(async () => {
          await bulkDecideApprovals({
            approvalIds: [current.id],
            decision: "approved",
            note: bulkNote || undefined,
          });
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(current.id);
            return next;
          });
          setToast("Approved 1 draft");
        });
      } else if (event.key === "R" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        const current = filtered[focusIndex];
        if (!current || bulkPending) return;
        startBulkTransition(async () => {
          await bulkDecideApprovals({
            approvalIds: [current.id],
            decision: "rejected",
            note: bulkNote || "Keyboard reject",
          });
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(current.id);
            return next;
          });
          setToast("Rejected 1 draft");
        });
      } else if (event.key === "Enter" && selected.size > 0 && !bulkPending) {
        event.preventDefault();
        handleBulkApprove();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, focusIndex, bulkPending, bulkNote, selected.size]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map((a) => a.id)));
    else setSelected(new Set());
  };

  const handleBulkApprove = () => {
    if (selected.size === 0) return;
    startBulkTransition(async () => {
      const count = selected.size;
      await bulkDecideApprovals({
        approvalIds: Array.from(selected),
        decision: "approved",
        note: bulkNote || undefined,
      });
      setSelected(new Set());
      setToast(`Approved ${count} draft${count === 1 ? "" : "s"}`);
    });
  };

  const handleBulkReject = () => {
    if (selected.size === 0) return;
    startBulkTransition(async () => {
      const count = selected.size;
      await bulkDecideApprovals({
        approvalIds: Array.from(selected),
        decision: "rejected",
        note: bulkNote || "Bulk rejected",
      });
      setSelected(new Set());
      setToast(`Rejected ${count} draft${count === 1 ? "" : "s"}`);
    });
  };

  if (approvals.length === 0) {
    return (
      <Card className="gap-0 py-0">
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyTitle>No pending approvals</EmptyTitle>
            <EmptyDescription>
              New drafts will appear here once campaigns discover target posts.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    );
  }

  const riskCount = approvals.filter((a) => (a.commentDraft.riskFlags || []).length > 0).length;

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      <Card className="bg-muted/30">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  className="size-5"
                  checked={
                    filtered.length > 0 && filtered.every((a) => selected.has(a.id))
                  }
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Select all visible approvals"
                />
                Select visible
              </Label>
              {selected.size > 0 ? (
                <Badge variant="secondary">{selected.size} selected</Badge>
              ) : (
                <Badge variant="outline">{filtered.length} shown · {approvals.length} total</Badge>
              )}
              {riskCount > 0 ? (
                <Badge variant="destructive">{riskCount} flagged</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by campaign, handle, draft…"
              className="h-10 text-base sm:h-8 sm:max-w-sm sm:text-sm"
            />
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  ["all", "All"],
                  ["risk", "Risk only"],
                  ["clean", "Clean only"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  className="min-h-9"
                  variant={riskFilter === value ? "default" : "outline"}
                  onClick={() => setRiskFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <p className="hidden text-xs text-muted-foreground sm:block">
            Shortcuts: <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>x</kbd> select ·{" "}
            <kbd>Shift+A</kbd> approve focused · <kbd>Shift+R</kbd> reject focused ·{" "}
            <kbd>Enter</kbd> bulk approve selected · <kbd>Ctrl+A</kbd> select visible
          </p>
        </CardContent>
      </Card>

      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 shadow-lg backdrop-blur sm:static sm:z-auto sm:rounded-xl sm:border sm:p-4 sm:shadow-none">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              type="text"
              placeholder="Bulk note (optional)"
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              className="h-10 text-base sm:h-8 sm:min-w-[160px] sm:flex-1 sm:text-sm"
            />
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                className="min-h-11 sm:min-h-9"
                onClick={handleBulkApprove}
                disabled={bulkPending}
              >
                {bulkPending ? "..." : `Approve ${selected.size}`}
              </Button>
              <Button
                className="min-h-11 sm:min-h-9"
                variant="outline"
                onClick={handleBulkReject}
                disabled={bulkPending}
              >
                Reject {selected.size}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkPending ? (
        <Alert>
          <AlertTitle>Processing bulk action</AlertTitle>
          <AlertDescription>Applying decision…</AlertDescription>
        </Alert>
      ) : null}

      {toast ? (
        <Alert>
          <AlertTitle>Done</AlertTitle>
          <AlertDescription>{toast}</AlertDescription>
        </Alert>
      ) : null}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No approvals match this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((item, index) => (
            <div
              key={item.id}
              className={
                index === focusIndex
                  ? "rounded-xl ring-2 ring-neutral-900 ring-offset-2 ring-offset-background"
                  : undefined
              }
            >
              <ApprovalCard
                approval={item}
                selectable
                selected={selected.has(item.id)}
                onToggleSelect={toggleOne}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
