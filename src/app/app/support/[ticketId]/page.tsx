import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { TicketConversation } from "@/components/support/ticket-conversation";
import {
  getTicketForReporter,
  replyAsReporter,
  setReporterTicketStatus,
} from "@/server/support";
import type { SupportStatus } from "@/lib/support";

const STATUS_VARIANT: Record<SupportStatus, "default" | "secondary" | "outline" | "destructive"> = {
  open: "default",
  in_progress: "secondary",
  resolved: "outline",
  closed: "secondary",
};

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const ticket = await getTicketForReporter(ticketId);
  if (!ticket) notFound();

  async function reply(body: string) {
    "use server";
    return replyAsReporter(ticketId, body);
  }

  async function changeStatus(to: SupportStatus) {
    "use server";
    return setReporterTicketStatus(ticketId, to);
  }

  return (
    <div>
      <PageHeader
        title={ticket.subject}
        description={`Opened ${ticket.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} · ${ticket.category}`}
        action={
          <Button variant="link" render={<Link href="/app/support" />} nativeButton={false}>
            Back to tickets
          </Button>
        }
      />
      <div className="mb-4">
        <Badge variant={STATUS_VARIANT[ticket.status as SupportStatus]}>
          {ticket.status.replace("_", " ")}
        </Badge>
      </div>
      <Card>
        <CardContent className="pt-6">
          <TicketConversation
            status={ticket.status as SupportStatus}
            messages={ticket.messages.map((message) => ({
              id: message.id,
              authorRole: message.authorRole as "reporter" | "cs" | "system",
              authorName: message.authorName,
              body: message.body,
              createdAt: message.createdAt.toISOString(),
            }))}
            replyAction={reply}
            statusAction={changeStatus}
          />
        </CardContent>
      </Card>
    </div>
  );
}
