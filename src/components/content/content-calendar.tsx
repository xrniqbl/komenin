"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addDays,
  addMonths,
  combineDateAndTime,
  dateKey,
  formatCalTitle,
  getMonthMatrix,
  getWeekDays,
  isSameDay,
  isToday,
  type CalendarView,
} from "@/lib/content-calendar-utils";
import { rescheduleContentDraft } from "@/server/content-campaigns";

type CalItem = {
  id: string;
  sequence: number;
  title?: string | null;
  status: string;
  scheduledFor: Date | string | null;
  publishedAt?: Date | string | null;
};

const WEEK_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "published") return "outline";
  if (status === "failed") return "destructive";
  if (status === "pending") return "secondary";
  return "default";
}

function parseDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  if (d instanceof Date) return d;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function ContentCalendar({
  items,
  title = "Publish calendar",
}: {
  items: CalItem[];
  title?: string;
}) {
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const monthMatrix = useMemo(() => getMonthMatrix(cursor), [cursor]);
  const weekDays = useMemo(() => getWeekDays(cursor), [cursor]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, CalItem[]>();
    for (const item of items) {
      const dt = parseDate(item.scheduledFor) || parseDate(item.publishedAt || null);
      if (!dt) continue;
      const key = dateKey(dt);
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const handleDrop = useCallback(
    (targetDate: Date, draggedId: string) => {
      const original = items.find((i) => i.id === draggedId);
      if (!original) return;
      const parsed = parseDate(original.scheduledFor);
      const newDate = combineDateAndTime(targetDate, parsed);
      startTransition(async () => {
        try {
          await rescheduleContentDraft({ draftId: draggedId, scheduledFor: newDate });
        } catch {
          // ignore
        }
      });
    },
    [items],
  );

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const displayDays = view === "month" ? monthMatrix : [weekDays];
  const weekHeadersForMonth = view === "month" || view === "week";

  const unscheduled = items.filter((i) => {
    return !parseDate(i.scheduledFor) && !parseDate((i as { publishedAt?: unknown }).publishedAt as Date | null);
  });

  return (
    <Card className="gap-0 py-0">
      {/* Header */}
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <Badge variant="outline">{items.length} posts</Badge>
          {pending ? <Badge variant="secondary">Saving...</Badge> : null}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor((c) => (view === "month" ? addMonths(c, -1) : addDays(c, view === "week" ? -7 : -1)))}
          >
            Prev
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor((c) => (view === "month" ? addMonths(c, 1) : addDays(c, view === "week" ? 7 : 1)))}
          >
            Next
          </Button>
        </div>
      
      </CardHeader>

      {/* View toggle + title */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="text-sm font-medium tracking-tight">{formatCalTitle(view, cursor)}</div>
        <div className="flex items-center gap-1 rounded-full border p-0.5">
          {(["month", "week", "day"] as CalendarView[]).map((v) => (
            <Button
              key={v}
              type="button"
              size="xs"
              variant={view === v ? "default" : "ghost"}
              className="rounded-full capitalize"
              onClick={() => setView(v)}
            >
              {v}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid: day view full-width; month/week keep 7 cols via horizontal scroll on mobile */}
      <div className="p-2">
        {view === "day" ? (
          <div
            className={cn(
              "rounded-xl border-2 border-dashed p-2 transition",
              dragOver === dateKey(cursor) ? "border-primary bg-primary/5" : "border-transparent",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(dateKey(cursor));
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id) handleDrop(cursor, id);
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={isToday(cursor) ? "default" : "secondary"}>
                {cursor.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
              </Badge>
            </div>
            <div className="space-y-2">
              {(groupedByDay.get(dateKey(cursor)) || []).map((item) => {
                const dt = parseDate(item.scheduledFor);
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, item.id)}
                    className="flex cursor-grab items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm active:cursor-grabbing"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        #{item.sequence} {item.title ? `· ${item.title}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">{dt ? dt.toLocaleTimeString() : "no time"}</div>
                    </div>
                    <Badge variant={statusVariant(item.status)} className="shrink-0">
                      {item.status}
                    </Badge>
                  </div>
                );
              })}
              {(groupedByDay.get(dateKey(cursor)) || []).length === 0 ? (
                <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
                  Drop posts here to schedule on {cursor.toLocaleDateString()}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {weekHeadersForMonth ? (
                <div className="grid grid-cols-7 gap-px">
                  {WEEK_HEADERS.map((h) => (
                    <div
                      key={h}
                      className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
                    >
                      {h}
                    </div>
                  ))}
                </div>
              ) : null}
              {displayDays.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-px">
              {week.map((day, di) => {
                if (!day) {
                  return <div key={`empty-${wi}-${di}`} className="min-h-[96px] rounded-lg bg-muted/10" />;
                }
                const k = dateKey(day);
                const dayItems = groupedByDay.get(k) || [];
                const isOver = dragOver === k;
                return (
                  <div
                    key={k}
                    className={cn(
                      "group relative flex min-h-[96px] flex-col rounded-lg border p-1 transition",
                      isToday(day) ? "border-primary/50 bg-primary/[0.03]" : "bg-card",
                      isOver ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "",
                    )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(k);
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(null);
                      const id = e.dataTransfer.getData("text/plain");
                      if (id) handleDrop(day, id);
                    }}
                  >
                    <div
                      className={cn(
                        "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium",
                        isToday(day) ? "bg-foreground text-background" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      {day.getDate()}
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      {dayItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => onDragStart(e, item.id)}
                          className="flex cursor-grab items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium hover:opacity-80 active:cursor-grabbing"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                          <span className="truncate">
                            #{item.sequence} {item.title || ""}
                          </span>
                        </div>
                      ))}
                      {dayItems.length > 3 ? (
                        <div className="px-1.5 text-[10px] text-muted-foreground">+{dayItems.length - 3} more</div>
                      ) : null}
                    </div>
                    {/* Hover expand */}
                    {dayItems.length > 0 ? (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 hidden max-h-64 overflow-auto rounded-xl border bg-popover p-2 shadow-lg group-hover:block">
                        {dayItems.map((item) => {
                          const dt = parseDate(item.scheduledFor);
                          return (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={(e) => onDragStart(e, item.id)}
                              className="flex cursor-grab items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted active:cursor-grabbing"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  #{item.sequence} {item.title || "Untitled"}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {dt ? dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "no time"} · {item.status}
                                </div>
                              </div>
                              <Badge variant={statusVariant(item.status)} className="shrink-0 text-[10px]">
                                {item.status.slice(0, 3)}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
            </div>
          </div>
        )}
      </div>

      {/* Unscheduled */}
      {unscheduled.length > 0 ? (
        <div className="border-t px-4 py-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Unscheduled ({unscheduled.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => onDragStart(e, item.id)}
                className="flex cursor-grab items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs hover:border-foreground/20 active:cursor-grabbing"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-foreground" />#{item.sequence} {item.title || "Untitled"}
              </div>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">Drag to a day to schedule</div>
        </div>
      ) : null}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-foreground" /> Scheduled
        </span>
        <span>Drag & drop to reschedule</span>
      </div>
    </Card>
  );
}
