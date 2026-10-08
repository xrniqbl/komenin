import { revalidatePath } from "next/cache";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
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
import { getRuntimeModeLabel } from "@/lib/runtime-mode";
import { executeDueSends, listActivity } from "@/server/comment-pipeline";

export default async function ActivityPage() {
  const actions = await listActivity();
  const mode = getRuntimeModeLabel();

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Send queue and execution log with human-like delay simulation."
        action={
          <div className="flex items-center gap-2">
            <Badge variant={mode === "simulator" ? "secondary" : "default"}>
              {mode} mode
            </Badge>
            <form
              action={async () => {
                "use server";
                await executeDueSends();
                revalidatePath("/app/activity");
              }}
            >
              <Button variant="electric" type="submit">Execute due sends</Button>
            </form>
          </div>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        {actions.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No actions yet</EmptyTitle>
              <EmptyDescription>Approved comments will appear here once scheduled.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((action) => (
                <TableRow key={action.id}>
                  <TableCell className="font-medium">{action.status}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {action.scheduledFor
                      ? action.scheduledFor.toISOString().slice(0, 19)
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">
                    {action.resultMessage}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    post @{action.targetPost.authorHandle}
                    {action.socialAccount ? ` · via @${action.socialAccount.username}` : ""}
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
