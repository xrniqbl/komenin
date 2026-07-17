import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { platformLabel } from "@/lib/session-routing";
import { listSessions } from "@/server/sessions";

export default async function SessionsPage() {
  const sessions = await listSessions();

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Anti-detect session vault health and reconnect candidates."
      />

      <Card className="gap-0 overflow-hidden py-0">
        {sessions.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No sessions imported yet</EmptyTitle>
              <EmptyDescription>Nothing to show yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>User agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>
                    <Link href={`/app/sessions/${session.id}`} className="font-medium hover:text-primary">
                      @{session.socialAccount.username}
                    </Link>
                  </TableCell>
                  <TableCell>{platformLabel(session.socialAccount.platform)}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {session.userAgent}
                  </TableCell>
                  <TableCell>
                    <StatusPill
                      label={session.isActive ? "active" : "inactive"}
                      color={session.isActive ? "var(--signal-ok)" : "var(--ink-500)"}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {session.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
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

