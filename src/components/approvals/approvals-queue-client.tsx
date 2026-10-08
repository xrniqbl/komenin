"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bulkDecideApprovals } from "@/server/comment-pipeline";
import { formatApprovalAge, isApprovalOverdue } from "@/lib/approval-sla";
import { messages, type Locale } from "@/lib/i18n/messages";
import { ApprovalCard } from "./approval-card";

type ApprovalData = {
  id: string;
  campaignId?: string | null;
  createdAt: Date;
  campaign?: { name: string } | null;
  targetPost: { authorHandle: string; content: string };
  commentDraft: { content: string; riskFlags: string[] };
};

type RiskFilter = "all" | "risk" | "clean";

type Props = {
  approvals: ApprovalData[];
  campaigns: { id: string; name: string }[];
  initialStatus: string;
  initialRisk: RiskFilter;
  initialCampaignId: string;
  locale: Locale;
};

export function ApprovalsQueueClient({
  approvals,
  campaigns,
  initialStatus,
  initialRisk,
  initialCampaignId,
  locale,
}: Props) {
  const t = messages[locale].approvals;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();
  const [bulkNote, setBulkNote] = useState("");
  const [query, setQuery] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const riskFilter = initialRisk;
  const statusFilter = initialStatus;
  const campaignFilter = initialCampaignId;

  // Selection survives the 15s auto-refresh: incoming props only prune ids
  // that disappeared (decided/expired), never wipe the whole set.
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const live = new Set(approvals.map((a) => a.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (live.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [approvals]);

  const updateUrlFilter = (key: "status" | "risk" | "campaign", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all" && !(key === "status" && value === "pending")) {
      params.set(key, value);
    } else if (key === "status" && (value === "pending" || value === "all")) {
      // Canonical default stays param-less so bookmarked URLs stay clean.
      params.delete(key);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const clearUrlFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("risk");
    params.delete("campaign");
    const qs = params.toString();
    setQuery("");
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const selectedCampaignName =
    campaignFilter && campaignFilter !== "all"
      ? (campaigns.find((c) => c.id === campaignFilter)?.name ?? null)
      : null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    return approvals
      .filter((item) => {
        const flags = item.commentDraft.riskFlags || [];
        const hasRisk = flags.length > 0;
        if (riskFilter === "risk" && !hasRisk) return false;
        if (riskFilter === "clean" && hasRisk) return false;
        // Server already filters status + campaign, but re-apply the campaign
        // id here so a stale URL param can't show cross-campaign items while
        // the server round-trip is in flight.
        if (campaignFilter && campaignFilter !== "all" && item.campaignId !== campaignFilter) {
          // Fall back to name match when the payload lacks campaignId (older
          // cached props): don't hide items we can't attribute.
          if (item.campaignId !== undefined && item.campaignId !== null) return false;
          if (selectedCampaignName && item.campaign?.name !== selectedCampaignName) return false;
        }
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
      })
      .map((item) => ({
        item,
        overdue: statusFilter !== "approved" && statusFilter !== "rejected"
          ? isApprovalOverdue(item.createdAt, undefined, now)
          : false,
        age: formatApprovalAge(item.createdAt, now),
      }));
  }, [approvals, query, riskFilter, campaignFilter, statusFilter, selectedCampaignName]);

  useEffect(() => {
    if (focusIndex >= filtered.length) {
      setFocusIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, focusIndex]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      if (filtered.length === 0) return;

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setFocusIndex((i) => Math.min(filtered.length - 1, i + 1));
      } else if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setFocusIndex((i) => Math.max(0, i - 1));
      } else if (event.key === "x" || event.key === "X") {
        // Plain `x` toggles selection on the focused item; Shift+X rejects it.
        if (!event.shiftKey) {
          event.preventDefault();
          const current = filtered[focusIndex];
          if (!current) return;
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(current.item.id)) next.delete(current.item.id);
            else next.add(current.item.id);
            return next;
          });
        } else {
          event.preventDefault();
          const current = filtered[focusIndex];
          if (!current || bulkPending) return;
          startBulkTransition(async () => {
            await bulkDecideApprovals({
              approvalIds: [current.item.id],
              decision: "rejected",
              note: bulkNote || "Keyboard reject",
            });
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(current.item.id);
              return next;
            });
            setToast(t.rejectedOne);
          });
        }
      } else if ((event.key === "a" || event.key === "A") && !event.metaKey && !event.ctrlKey) {
        // Plain `a` approves the focused item (no Shift needed).
        event.preventDefault();
        const current = filtered[focusIndex];
        if (!current || bulkPending) return;
        startBulkTransition(async () => {
          await bulkDecideApprovals({
            approvalIds: [current.item.id],
            decision: "approved",
            note: bulkNote || undefined,
          });
          setSelected((prev) => {
            const next = new Set(prev);
            next.delete(current.item.id);
            return next;
          });
          setToast(t.approvedOne);
        });
      } else if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSelected(new Set(filtered.map((f) => f.item.id)));
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
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
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
    if (checked) setSelected(new Set(filtered.map((f) => f.item.id)));
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
      setToast(
        count === 1
          ? t.approvedOne
          : t.approvedToast.replace("{count}", String(count)).replace("{s}", "s"),
      );
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
      setToast(
        count === 1
          ? t.rejectedOne
          : t.rejectedToast.replace("{count}", String(count)).replace("{s}", "s"),
      );
    });
  };

  const visibleOverdue = filtered.filter((f) => f.overdue).length;
  const hasUrlFilters =
    (statusFilter && statusFilter !== "pending") ||
    riskFilter !== "all" ||
    (campaignFilter && campaignFilter !== "all");

  if (approvals.length === 0) {
    return (
      <Card className="gap-0 py-0">
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyTitle>
              {statusFilter === "pending" || !statusFilter ? t.emptyTitle : t.emptyStatusTitle}
            </EmptyTitle>
            <EmptyDescription>
              {statusFilter === "pending" || !statusFilter ? t.emptyBody : t.emptyStatusBody}
            </EmptyDescription>
          </EmptyHeader>
          {hasUrlFilters ? (
            <Button size="sm" variant="glass" onClick={clearUrlFilters}>
              {t.clearFilters}
            </Button>
          ) : null}
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
                    filtered.length > 0 && filtered.every((f) => selected.has(f.item.id))
                  }
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                  aria-label="Select all visible approvals"
                />
                {t.selectVisible}
              </Label>
              {selected.size > 0 ? (
                <Badge variant="secondary">
                  {t.selectedCount.replace("{count}", String(selected.size))}
                </Badge>
              ) : (
                <Badge variant="outline">
                  {t.shownTotal
                    .replace("{shown}", String(filtered.length))
                    .replace("{total}", String(approvals.length))}
                </Badge>
              )}
              {riskCount > 0 ? (
                <Badge variant="destructive">
                  {t.flaggedCount.replace("{count}", String(riskCount))}
                </Badge>
              ) : null}
              {visibleOverdue > 0 ? (
                <Badge variant="destructive">
                  {t.overdueCount.replace("{count}", String(visibleOverdue))}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="h-10 text-base sm:h-8 sm:max-w-sm sm:text-sm"
            />
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  ["all", t.riskAll],
                  ["risk", t.riskOnly],
                  ["clean", t.cleanOnly],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  className="min-h-9"
                  variant={riskFilter === value ? "default" : "outline"}
                  onClick={() => updateUrlFilter("risk", value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Select
              value={statusFilter || "pending"}
              onValueChange={(v) => updateUrlFilter("status", typeof v === "string" ? v : "pending")}
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="pending">{t.statusPending}</SelectItem>
                <SelectItem value="approved">{t.statusApproved}</SelectItem>
                <SelectItem value="rejected">{t.statusRejected}</SelectItem>
                <SelectItem value="all">{t.statusAll}</SelectItem>
              </SelectPopup>
            </Select>
            {campaigns.length > 0 ? (
              <Select
                value={campaignFilter || "all"}
                onValueChange={(v) => updateUrlFilter("campaign", typeof v === "string" ? v : "all")}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t.campaignAll} />
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="all">{t.campaignAll}</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            ) : null}
            {hasUrlFilters || query ? (
              <Button size="sm" variant="glass" className="min-h-9" onClick={clearUrlFilters}>
                {t.clearFilters}
              </Button>
            ) : null}
          </div>

          <p className="hidden text-xs text-muted-foreground sm:block">{t.shortcuts}</p>
          <p className="hidden text-xs text-muted-foreground sm:block">{t.selectionKeptNote}</p>
        </CardContent>
      </Card>

      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 shadow-lg backdrop-blur sm:static sm:z-auto sm:rounded-xl sm:border sm:p-4 sm:shadow-none">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              type="text"
              placeholder={t.bulkNotePlaceholder}
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
                {bulkPending ? "..." : t.approveSelected.replace("{count}", String(selected.size))}
              </Button>
              <Button
                className="min-h-11 sm:min-h-9"
                variant="glass"
                onClick={handleBulkReject}
                disabled={bulkPending}
              >
                {t.rejectSelected.replace("{count}", String(selected.size))}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkPending ? (
        <Alert>
          <AlertTitle>{t.processing}</AlertTitle>
          <AlertDescription>{t.processingDetail}</AlertDescription>
        </Alert>
      ) : null}

      {toast ? (
        <Alert>
          <AlertTitle>{t.done}</AlertTitle>
          <AlertDescription>{toast}</AlertDescription>
        </Alert>
      ) : null}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            {t.noResults}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ item, overdue, age }, index) => (
            <div
              key={item.id}
              className={
                index === focusIndex
                  ? "rounded-xl ring-2 ring-neutral-900 ring-offset-2 ring-offset-background"
                  : undefined
              }
            >
              <div className="mb-1 flex items-center gap-2 px-1">
                {overdue ? (
                  <Badge variant="destructive">{t.overdueBadge}</Badge>
                ) : (
                  <Badge variant="outline">{t.waitingFor.replace("{age}", age)}</Badge>
                )}
                {overdue ? (
                  <span className="text-xs text-muted-foreground">
                    {t.waitingFor.replace("{age}", age)}
                  </span>
                ) : null}
              </div>
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
