import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
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
import { PageHeader } from "@/components/app/page-header";
import { listMyTickets } from "@/server/support";
import type { SupportStatus } from "@/lib/support";

const STATUS_VARIANT: Record<SupportStatus, "default" | "secondary" | "outline" | "destructive"> = {
  open: "default",
  in_progress: "secondary",
  resolved: "outline",
  closed: "secondary",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function SupportPage() {
  const tickets = await listMyTickets();

  return (
    <div>
      <PageHeader
        title="Support"
        description="Report a problem or ask for help — conversations with the Komenin support team, tracked until resolved."
        action={
          <Button render={<Link href="/app/support/new" />} nativeButton={false}>
            New ticket
          </Button>
        }
      />
      <Card className="gap-0 overflow-hidden py-0">
        {tickets.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No tickets yet</EmptyTitle>
              <EmptyDescription>
                Open a ticket when something is not working, you have a billing question, or you
                need a hand with your workspace.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <Link
                      href={`/app/support/${ticket.id}`}
                      className="font-medium hover:underline"
                    >
                      {ticket.subject}
                    </Link>
                  </TableCell>
                  <TableCell className="capitalize">{ticket.category}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[ticket.status as SupportStatus]}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{ticket._count.messages}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(ticket.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
