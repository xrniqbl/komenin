"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/support";

export function AdminTicketControls({
  status,
  priority,
  replyAction,
  statusAction,
  priorityAction,
}: {
  status: SupportStatus;
  priority: SupportPriority;
  replyAction: (body: string) => Promise<{ ok: boolean; error?: string }>;
  statusAction: (to: SupportStatus) => Promise<{ ok: boolean; error?: string }>;
  priorityAction: (to: SupportPriority) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error || "Action failed.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="error">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ticket-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              if (typeof value === "string" && value) {
                run(() => statusAction(value as SupportStatus));
              }
            }}
          >
            <SelectTrigger id="ticket-status" className="w-44 min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {SUPPORT_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ticket-priority">Priority</Label>
          <Select
            value={priority}
            onValueChange={(value) => {
              if (typeof value === "string" && value) {
                run(() => priorityAction(value as SupportPriority));
              }
            }}
          >
            <SelectTrigger id="ticket-priority" className="w-44 min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {SUPPORT_PRIORITIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const body = reply.trim();
          if (!body) return;
          run(async () => {
            const result = await replyAction(body);
            if (result.ok) setReply("");
            return result;
          });
        }}
        className="flex flex-col gap-3 border-t pt-4"
      >
        <Textarea
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Reply to the reporter — sent to their email and shown in the ticket."
        />
        <div>
          <Button variant="electric" type="submit" disabled={pending || reply.trim().length < 2}>
            {pending ? "Sending..." : "Send reply"}
          </Button>
        </div>
      </form>
    </div>
  );
}
