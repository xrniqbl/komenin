import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
import { listAllSupportTickets } from "@/server/support";
import { cn } from "@/lib/utils";
import { SUPPORT_STATUSES, type SupportStatus } from "@/lib/support";

const STATUS_VARIANT: Record<SupportStatus, "default" | "secondary" | "outline" | "destructive"> = {
  open: "default",
  in_progress: "secondary",
  resolved: "outline",
  closed: "secondary",
};

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = (SUPPORT_STATUSES as readonly string[]).includes(status || "")
    ? (status as SupportStatus)
    : undefined;
  const tickets = await listAllSupportTickets({ status: active });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Support tickets</h1>
        <p className="text-sm text-muted-foreground">
          User-reported problems and questions across all workspaces.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterLink label="All" href="/admin/support" active={!active} />
        {SUPPORT_STATUSES.map((value) => (
          <FilterLink
            key={value}
            label={value.replace("_", " ")}
            href={`/admin/support?status=${value}`}
            active={active === value}
          />
        ))}
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {tickets.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No tickets</EmptyTitle>
              <EmptyDescription>No tickets match this filter.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <Link
                      href={`/admin/support/${ticket.id}`}
                      className="font-medium hover:underline"
                    >
                      {ticket.subject}
                    </Link>
                  </TableCell>
                  <TableCell>{ticket.reporterEmail}</TableCell>
                  <TableCell>{ticket.workspaceName || "—"}</TableCell>
                  <TableCell className="capitalize">{ticket.category}</TableCell>
                  <TableCell className="capitalize">{ticket.priority}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[ticket.status as SupportStatus]}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
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

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-sm capitalize",
        active
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-200 text-neutral-700 hover:bg-neutral-50",
      )}
    >
      {label}
    </Link>
  );
}
