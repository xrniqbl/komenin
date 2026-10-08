"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { updateLeadFollowUp, updateLeadStatus } from "@/server/leads";

type LeadRow = {
  id: string;
  handle: string;
  displayName: string | null;
  contactEmail: string | null;
  platform: string | null;
  source: string;
  status: string;
  intent: string | null;
  notes: string | null;
  postSnippet: string | null;
  followUpAt: string | null;
  client: { id: string; name: string; slug: string } | null;
  campaign: { id: string; name: string } | null;
};

const KANBAN_COLUMNS = [
  { status: "new", label: "New", hint: "Fresh captures" },
  { status: "contacted", label: "Contacted", hint: "First touch sent" },
  { status: "qualified", label: "Qualified", hint: "Real opportunity" },
  { status: "won", label: "Won", hint: "Converted" },
] as const;

type KanbanStatus = (typeof KANBAN_COLUMNS)[number]["status"];

function isDue(lead: LeadRow): boolean {
  return Boolean(
    lead.followUpAt &&
      new Date(lead.followUpAt).getTime() <= Date.now() &&
      !["won", "lost", "archived"].includes(lead.status),
  );
}

export function LeadsKanban({ leads }: { leads: LeadRow[] }) {
  const [pending, startTransition] = useTransition();

  function move(leadId: string, status: KanbanStatus) {
    startTransition(async () => {
      await updateLeadStatus({ leadId, status });
    });
  }

  function snooze(leadId: string, days: number, fromStatus: string) {
    startTransition(async () => {
      const next = new Date();
      next.setDate(next.getDate() + days);
      await updateLeadFollowUp({
        leadId,
        followUpAt: next.toISOString().slice(0, 10),
        status: (fromStatus === "new" ? "contacted" : fromStatus) as KanbanStatus,
      });
    });
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {KANBAN_COLUMNS.map((column) => {
        const items = leads.filter((lead) => lead.status === column.status);
        const due = items.filter(isDue).length;
        return (
          <div key={column.status} className="flex min-h-48 flex-col rounded-xl border bg-muted/20">
            <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
              <div>
                <div className="text-sm font-semibold">{column.label}</div>
                <div className="text-[11px] text-muted-foreground">{column.hint}</div>
              </div>
              <div className="flex items-center gap-1">
                {due > 0 ? <Badge variant="destructive">{due} due</Badge> : null}
                <Badge variant="secondary">{items.length}</Badge>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {items.length === 0 ? (
                <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  No leads here yet
                </div>
              ) : (
                items.slice(0, 8).map((lead) => (
                  <Card key={lead.id} className="py-0 shadow-none">
                    <CardContent className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">@{lead.handle}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {lead.platform || "social"} · {lead.source}
                            {lead.client ? ` · ${lead.client.name}` : ""}
                          </div>
                        </div>
                        {isDue(lead) ? <Badge variant="destructive">due</Badge> : null}
                      </div>
                      {lead.intent ? (
                        <div className="line-clamp-2 text-xs">{lead.intent}</div>
                      ) : null}
                      <div className="flex flex-wrap gap-1">
                        {KANBAN_COLUMNS.filter((c) => c.status !== lead.status).map((target) => (
                          <Button
                            key={target.status}
                            size="sm"
                            variant="glass"
                            className="h-7 px-2 text-[11px]"
                            disabled={pending}
                            onClick={() => move(lead.id, target.status)}
                          >
                            → {target.label}
                          </Button>
                        ))}
                        <Button
                          size="sm"
                          variant="glass"
                          className="h-7 px-2 text-[11px]"
                          disabled={pending}
                          onClick={() => snooze(lead.id, 3, lead.status)}
                        >
                          +3d
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              {items.length > 8 ? (
                <div className="px-1 text-[11px] text-muted-foreground">
                  +{items.length - 8} more in this stage — use search below.
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
