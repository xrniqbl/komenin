"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { reporterCanTransition, type SupportStatus } from "@/lib/support";

export type TicketMessageView = {
  id: string;
  authorRole: "reporter" | "cs" | "system";
  authorName: string | null;
  body: string;
  createdAt: string;
};

const ROLE_LABEL: Record<TicketMessageView["authorRole"], string> = {
  reporter: "You",
  cs: "Komenin Support",
  system: "System",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketConversation({
  status,
  messages,
  replyAction,
  statusAction,
}: {
  status: SupportStatus;
  messages: TicketMessageView[];
  replyAction: (body: string) => Promise<{ ok: boolean; error?: string }>;
  statusAction: (to: SupportStatus) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canReply = status !== "closed";
  const canClose = reporterCanTransition(status, "closed");
  const canReopen = reporterCanTransition(status, "open");

  const submitReply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = reply.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const result = await replyAction(body);
      if (result.ok) {
        setReply("");
      } else {
        setError(result.error || "Failed to send the reply.");
      }
    });
  };

  const moveStatus = (to: SupportStatus) => {
    setError(null);
    startTransition(async () => {
      const result = await statusAction(to);
      if (!result.ok) setError(result.error || "Failed to update the ticket.");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="error">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              "rounded-lg border p-4 " +
              (message.authorRole === "cs" ? "border-primary/30 bg-primary/5" : "")
            }
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{ROLE_LABEL[message.authorRole]}</span>
              <span className="text-muted-foreground">{formatDate(message.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
          </div>
        ))}
      </div>

      {canReply ? (
        <form onSubmit={submitReply} className="flex flex-col gap-3 border-t pt-4">
          <Textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Add more details or answer the support team..."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="electric" type="submit" disabled={pending || reply.trim().length < 2}>
              {pending ? "Sending..." : "Send reply"}
            </Button>
            {canClose ? (
              <Button
                type="button"
                variant="glass"
                disabled={pending}
                onClick={() => moveStatus("closed")}
              >
                Close ticket
              </Button>
            ) : null}
            {canReopen ? (
              <Button
                type="button"
                variant="glass"
                disabled={pending}
                onClick={() => moveStatus("open")}
              >
                Reopen ticket
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="border-t pt-4 text-sm text-muted-foreground">
          This ticket is closed. Reopen it to continue the conversation.
        </p>
      )}
    </div>
  );
}
