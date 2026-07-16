import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import {
  Empty,
  EmptyContent,
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
import { platformLabel } from "@/lib/session-routing";
import { listListeners, pollListener } from "@/server/listeners";

export default async function ListenersPage() {
  const listeners = await listListeners();

  return (
    <div>
      <PageHeader
        title="Listeners"
        description="Keyword, competitor, and trend watchers."
        action={
          <Button variant="default" render={<Link href="/app/listeners/new" />} nativeButton={false}>
            New listener
          </Button>
        }
      />
      <div className="overflow-hidden rounded-2xl border bg-background">
        {listeners.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>No listeners yet</EmptyTitle>
              <EmptyDescription>Create a watcher to discover posts automatically.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button render={<Link href="/app/listeners/new" />} nativeButton={false}>
                New listener
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Query</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Posts</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listeners.map((listener) => (
                <TableRow key={listener.id}>
                  <TableCell className="font-medium">{listener.query}</TableCell>
                  <TableCell>{platformLabel(listener.platform)}</TableCell>
                  <TableCell className="text-muted-foreground">{listener.type}</TableCell>
                  <TableCell className="text-muted-foreground">{listener._count.posts}</TableCell>
                  <TableCell className="text-right">
                    <form
                      action={async () => {
                        "use server";
                        await pollListener(listener.id);
                      }}
                    >
                      <Button type="submit" variant="outline" size="sm">
                        Poll now
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
