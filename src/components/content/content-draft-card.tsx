"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideContentDraft, rescheduleContentDraft } from "@/server/content-campaigns";

function toLocalInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  );
}

type Draft = {
  id: string;
  sequence: number;
  title: string | null;
  body: string;
  hashtags: string[];
  status: string;
  scheduledFor: Date | null;
  resultMessage: string | null;
  providerId: string | null;
  model: string | null;
};

export function ContentDraftCard({ draft }: { draft: Draft }) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(draft.title || "");
  const [body, setBody] = useState(draft.body);
  const [schedValue, setSchedValue] = useState(toLocalInputValue(draft.scheduledFor));

  const handleApprove = () => {
    startTransition(async () => {
      await decideContentDraft({
        draftId: draft.id,
        decision: "approved",
        editedTitle: title,
        editedBody: body,
      });
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      await decideContentDraft({ draftId: draft.id, decision: "rejected" });
    });
  };

  const handleReschedule = () => {
    if (!schedValue) return;
    startTransition(async () => {
      await rescheduleContentDraft({
        draftId: draft.id,
        scheduledFor: new Date(schedValue),
      });
    });
  };

  const isPending = draft.status === "pending" || draft.status === "rejected";

  return (
    <div className="rounded-2xl border bg-background p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">
          Post #{draft.sequence}
          {draft.title ? ` · ${draft.title}` : ""}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{draft.status}</Badge>
          {draft.scheduledFor ? (
            <span className="text-xs text-muted-foreground">
              schedule {new Date(draft.scheduledFor).toISOString().slice(0, 16).replace("T", " ")} UTC
            </span>
          ) : null}
        </div>
      </div>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Current draft</div>
            <div className="mt-2 whitespace-pre-wrap text-sm">{draft.body}</div>
            {draft.hashtags.length > 0 ? (
              <div className="mt-2 text-xs text-muted-foreground">
                {draft.hashtags.map((tag) => `#${tag}`).join(" ")}
              </div>
            ) : null}
            {draft.providerId ? (
              <div className="mt-2 text-xs text-muted-foreground">
                via {draft.providerId}/{draft.model}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`title-${draft.id}`}>Title</Label>
              <Textarea
                id={`title-${draft.id}`}
                className="min-h-16"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`body-${draft.id}`}>Body</Label>
              <Textarea
                id={`body-${draft.id}`}
                className="min-h-32"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
            <Button type="button" onClick={handleApprove} disabled={pending}>
              {pending ? "..." : "Approve & schedule"}
            </Button>
            <Button type="button" variant="outline" onClick={handleReject} disabled={pending}>
              {pending ? "..." : "Reject"}
            </Button>
            <div className="flex flex-col gap-2 border-t pt-3">
              <Label htmlFor={`schedule-${draft.id}`}>Reschedule</Label>
              <Input
                id={`schedule-${draft.id}`}
                type="datetime-local"
                value={schedValue}
                onChange={(e) => setSchedValue(e.target.value)}
                required
              />
              <Button type="button" variant="outline" onClick={handleReschedule} disabled={pending}>
                Save schedule
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="whitespace-pre-wrap text-sm">{draft.body}</div>
            {draft.hashtags.length > 0 ? (
              <div className="mt-2 text-xs text-muted-foreground">
                {draft.hashtags.map((tag) => `#${tag}`).join(" ")}
              </div>
            ) : null}
            {draft.resultMessage ? (
              <div className="mt-2 text-xs text-muted-foreground">{draft.resultMessage}</div>
            ) : null}
          </div>
          {draft.status !== "published" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`schedule-ro-${draft.id}`}>Reschedule</Label>
              <Input
                id={`schedule-ro-${draft.id}`}
                type="datetime-local"
                value={schedValue}
                onChange={(e) => setSchedValue(e.target.value)}
                required
              />
              <Button type="button" variant="outline" onClick={handleReschedule} disabled={pending}>
                Save schedule
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
