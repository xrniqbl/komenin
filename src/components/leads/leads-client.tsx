"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createLead,
  exportLeadsCsv,
  updateLeadFollowUp,
  updateLeadStatus,
} from "@/server/leads";

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
  draftSnippet: string | null;
  externalUrl: string | null;
  ownerUserId: string | null;
  followUpAt: string | null;
  createdAt: string;
  client: { id: string; name: string; slug: string } | null;
  campaign: { id: string; name: string } | null;
};

const STATUSES = ["new", "contacted", "qualified", "won", "lost", "archived"] as const;

export function LeadsClient({
  initialLeads,
  clients,
}: {
  initialLeads: LeadRow[];
  clients: Array<{ id: string; name: string }>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [pending, startTransition] = useTransition();
  const [handle, setHandle] = useState("");
  const [intent, setIntent] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [clientId, setClientId] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [dueOnly, setDueOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return initialLeads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (clientFilter === "unassigned" && lead.client) return false;
      if (
        clientFilter !== "all" &&
        clientFilter !== "unassigned" &&
        lead.client?.id !== clientFilter
      ) {
        return false;
      }
      if (dueOnly) {
        if (!lead.followUpAt) return false;
        if (new Date(lead.followUpAt).getTime() > now) return false;
        if (["won", "lost", "archived"].includes(lead.status)) return false;
      }
      if (!q) return true;
      return [
        lead.handle,
        lead.displayName,
        lead.intent,
        lead.notes,
        lead.contactEmail,
        lead.client?.name,
        lead.campaign?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [initialLeads, query, statusFilter, clientFilter, dueOnly]);

  const createManual = () => {
    if (!handle.trim()) return;
    startTransition(async () => {
      await createLead({
        handle,
        intent: intent || undefined,
        notes: notes || undefined,
        contactEmail: email || undefined,
        clientId: clientId || undefined,
        followUpAt: followUpAt || null,
        source: "manual",
      });
      setHandle("");
      setIntent("");
      setNotes("");
      setEmail("");
      setClientId("");
      setFollowUpAt("");
    });
  };

  const downloadCsv = () => {
    startTransition(async () => {
      const result = await exportLeadsCsv({
        status: statusFilter === "all" ? "all" : (statusFilter as (typeof STATUSES)[number]),
        clientId:
          clientFilter !== "all" && clientFilter !== "unassigned" ? clientFilter : undefined,
      });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Capture lead manually</CardTitle>
          <CardDescription>
            Or use “Save as lead” from Inbox / Approvals when reviewing posts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-handle">Handle</Label>
            <Input
              id="lead-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@prospect"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-email">Email (optional)</Label>
            <Input
              id="lead-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="prospect@company.com"
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="lead-intent">Intent</Label>
            <Input
              id="lead-intent"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Asked for pricing / wants demo"
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea
              id="lead-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-20"
            />
          </div>
          {clients.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-client">Client</Label>
              <select
                id="lead-client"
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-followup">Follow-up date</Label>
            <Input
              id="lead-followup"
              type="date"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={createManual} disabled={pending || !handle.trim()}>
              {pending ? "Saving…" : "Save lead"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search handle, intent, notes…"
          className="h-9 max-w-sm"
        />
        <div className="flex flex-wrap gap-1">
          {(["all", ...STATUSES] as const).map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? "default" : "outline"}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </Button>
          ))}
        </div>
        {clients.length > 0 ? (
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            aria-label="Filter by client"
          >
            <option value="all">All clients</option>
            <option value="unassigned">Unassigned</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
        <Button
          size="sm"
          variant={dueOnly ? "default" : "outline"}
          onClick={() => setDueOnly((v) => !v)}
        >
          Due follow-ups
        </Button>
        <Badge variant="secondary">{filtered.length} shown</Badge>
        <Button size="sm" variant="outline" disabled={pending} onClick={downloadCsv}>
          {pending ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No leads yet. Capture from Inbox, Approvals, or the form above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <Card key={lead.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      @{lead.handle}
                      {lead.displayName ? (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {lead.displayName}
                        </span>
                      ) : null}
                    </CardTitle>
                    <CardDescription>
                      {lead.platform || "social"} · {lead.source}
                      {lead.client ? ` · ${lead.client.name}` : ""}
                      {lead.campaign ? ` · ${lead.campaign.name}` : ""}
                    </CardDescription>
                  </div>
                  <Badge variant={lead.status === "new" ? "default" : "secondary"}>
                    {lead.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {lead.intent ? <div className="text-sm">{lead.intent}</div> : null}
                {lead.postSnippet ? (
                  <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    {lead.postSnippet}
                  </div>
                ) : null}
                {lead.notes ? (
                  <div className="text-xs text-muted-foreground">Notes: {lead.notes}</div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Follow-up:{" "}
                    {lead.followUpAt
                      ? new Date(lead.followUpAt).toLocaleDateString()
                      : "not set"}
                  </span>
                  {lead.followUpAt &&
                  new Date(lead.followUpAt).getTime() <= Date.now() &&
                  !["won", "lost", "archived"].includes(lead.status) ? (
                    <Badge variant="destructive">due</Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor={`followup-${lead.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Set follow-up
                    </Label>
                    <Input
                      id={`followup-${lead.id}`}
                      type="date"
                      className="h-8 w-[160px]"
                      defaultValue={
                        lead.followUpAt ? lead.followUpAt.slice(0, 10) : ""
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        startTransition(async () => {
                          await updateLeadFollowUp({
                            leadId: lead.id,
                            followUpAt: value || null,
                          });
                        });
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const next = new Date();
                        next.setDate(next.getDate() + 3);
                        await updateLeadFollowUp({
                          leadId: lead.id,
                          followUpAt: next.toISOString().slice(0, 10),
                          status:
                            lead.status === "new"
                              ? "contacted"
                              : (lead.status as (typeof STATUSES)[number]),
                        });
                      })
                    }
                  >
                    +3 days
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {STATUSES.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={lead.status === status ? "default" : "outline"}
                      disabled={pending || lead.status === status}
                      onClick={() =>
                        startTransition(async () => {
                          await updateLeadStatus({ leadId: lead.id, status });
                        })
                      }
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
