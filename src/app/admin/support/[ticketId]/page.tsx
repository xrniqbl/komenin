import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminTicketControls } from "@/components/support/admin-ticket-controls";
import {
  getTicketAsAdmin,
  replyAsCs,
  setTicketPriorityAsCs,
  setTicketStatusAsCs,
} from "@/server/support";
import type { SupportPriority, SupportStatus } from "@/lib/support";

const STATUS_VARIANT: Record<SupportStatus, "default" | "secondary" | "outline" | "destructive"> = {
  open: "default",
  in_progress: "secondary",
  resolved: "outline",
  closed: "secondary",
};

export default async function AdminSupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const ticket = await getTicketAsAdmin(ticketId);
  if (!ticket) notFound();

  async function reply(body: string) {
    "use server";
    return replyAsCs(ticketId, body);
  }

  async function changeStatus(to: SupportStatus) {
    "use server";
    return setTicketStatusAsCs(ticketId, to);
  }

  async function changePriority(to: SupportPriority) {
    "use server";
    return setTicketPriorityAsCs(ticketId, to);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <Button variant="link" render={<Link href="/admin/support" />} nativeButton={false}
          className="self-start px-0">
          ← All tickets
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
        <p className="text-sm text-muted-foreground">
          {ticket.reporterName || "Unknown"} · {ticket.reporterEmail} ·{" "}
          {ticket.workspaceName || "no workspace"} · opened{" "}
          {ticket.createdAt.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={STATUS_VARIANT[ticket.status as SupportStatus]}>
          {ticket.status.replace("_", " ")}
        </Badge>
        <Badge variant="outline" className="capitalize">{ticket.priority}</Badge>
        <Badge variant="outline" className="capitalize">{ticket.category}</Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          {ticket.messages.map((message) => (
            <div
              key={message.id}
              className={
                "rounded-lg border p-4 " +
                (message.authorRole === "cs" ? "border-primary/30 bg-primary/5" : "")
              }
            >
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {message.authorRole === "cs"
                    ? "Support"
                    : message.authorRole === "reporter"
                      ? message.authorName || ticket.reporterEmail
                      : "System"}
                </span>
                <span className="text-muted-foreground">
                  {message.createdAt.toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <AdminTicketControls
            status={ticket.status as SupportStatus}
            priority={ticket.priority as SupportPriority}
            replyAction={reply}
            statusAction={changeStatus}
            priorityAction={changePriority}
          />
        </CardContent>
      </Card>
    </div>
  );
}
