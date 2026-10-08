"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatPollDate,
  listenerHealthState,
  nextPollAt,
} from "@/lib/listener-health";
import { platformLabel } from "@/lib/session-routing";
import { bulkUpdateListeners, pollListener } from "@/server/listeners";
import { messages, type Locale } from "@/lib/i18n/messages";

export type ListenerRow = {
  id: string;
  query: string;
  platform: string;
  type: string;
  isActive: boolean;
  pollIntervalMinutes: number | null;
  lastPolledAt: Date | null;
  _count: { posts: number };
  posts: Array<{ discoveredAt: Date }>;
};

export function ListenersTable({
  listeners,
  locale,
  preserveParams,
}: {
  listeners: ListenerRow[];
  locale: Locale;
  /** Query string (without leading ?) preserved on row/detail links. */
  preserveParams: string;
}) {
  const t = messages[locale].listeners;
  const copy = t;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();
  const [pollPendingId, setPollPendingId] = useState<string | null>(null);

  const detailHref = (id: string) =>
    preserveParams ? `/app/listeners/${id}?${preserveParams}` : `/app/listeners/${id}`;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === listeners.length ? new Set() : new Set(listeners.map((l) => l.id)),
    );
  };

  const runBulk = (action: "activate" | "pause" | "delete") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      await bulkUpdateListeners({ listenerIds: ids, action });
      setSelected(new Set());
    });
  };

  const runPoll = async (id: string) => {
    setPollPendingId(id);
    try {
      await pollListener(id);
    } finally {
      setPollPendingId(null);
    }
  };

  if (listeners.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyTitle>{copy.emptyFilteredTitle}</EmptyTitle>
          <EmptyDescription>{copy.emptyFilteredDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const allChecked = selected.size === listeners.length && listeners.length > 0;

  return (
    <div>
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {selected.size} {copy.selectedCount}
          </span>
          <Button
            size="sm"
            variant="glass"
            disabled={bulkPending}
            onClick={() => runBulk("activate")}
          >
            {copy.bulkActivate}
          </Button>
          <Button size="sm" variant="glass" disabled={bulkPending} onClick={() => runBulk("pause")}>
            {copy.bulkPause}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={bulkPending}
            onClick={() => runBulk("delete")}
          >
            {copy.bulkDelete}
          </Button>
          {bulkPending ? (
            <span className="text-xs text-muted-foreground">…</span>
          ) : null}
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allChecked}
                onCheckedChange={toggleAll}
                aria-label={copy.selectAll}
              />
            </TableHead>
            <TableHead>{copy.query}</TableHead>
            <TableHead>{copy.platform}</TableHead>
            <TableHead>{copy.type}</TableHead>
            <TableHead>{copy.status}</TableHead>
            <TableHead>{copy.health}</TableHead>
            <TableHead>{copy.posts}</TableHead>
            <TableHead className="text-right">{copy.action}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listeners.map((listener) => {
            const { state } = listenerHealthState({
              lastPolledAt: listener.lastPolledAt,
              latestPostAt: listener.posts[0]?.discoveredAt ?? null,
            });
            const next = nextPollAt({
              pollIntervalMinutes: listener.pollIntervalMinutes,
              lastPolledAt: listener.lastPolledAt,
              isActive: listener.isActive,
            });
            const lastPollLabel = formatPollDate(listener.lastPolledAt);
            return (
              <TableRow key={listener.id}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(listener.id)}
                    onCheckedChange={() => toggle(listener.id)}
                    aria-label={listener.query}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={detailHref(listener.id)} className="text-primary hover:underline">
                    {listener.query}
                  </Link>
                  <div className="text-xs font-normal text-muted-foreground">
                    {lastPollLabel
                      ? `${copy.lastPoll}: ${lastPollLabel} UTC`
                      : copy.neverPolled}
                    {next ? ` · ${copy.nextPoll}: ${formatPollDate(next)} UTC` : null}
                  </div>
                </TableCell>
                <TableCell>{platformLabel(listener.platform as never)}</TableCell>
                <TableCell className="text-muted-foreground">{listener.type}</TableCell>
                <TableCell>
                  <Badge variant={listener.isActive ? "secondary" : "outline"}>
                    {listener.isActive ? copy.statusActive : copy.statusPaused}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={state === "fresh" ? "secondary" : state === "stale" ? "destructive" : "outline"}
                  >
                    {state === "fresh"
                      ? copy.freshBadge
                      : state === "stale"
                        ? copy.staleBadge
                        : copy.neverPolled}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{listener._count.posts}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="glass"
                      size="sm"
                      render={<Link href={detailHref(listener.id)} />}
                      nativeButton={false}
                    >
                      {copy.details}
                    </Button>
                    <Button
                      variant="glass"
                      size="sm"
                      disabled={pollPendingId === listener.id}
                      onClick={() => runPoll(listener.id)}
                    >
                      {copy.pollNow}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
