import { ListPagination, paginateItems } from "@/components/app/list-pagination";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/notifications";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const notifications = await listNotifications(100);
  const { items, window } = paginateItems(notifications, params.page, 10);

  async function markAll() {
    "use server";
    await markAllNotificationsRead();
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Workspace alerts for approvals, failures, and health events."
        action={
          <form action={markAll}>
            <Button type="submit" variant="outline">
              Mark all read
            </Button>
          </form>
        }
      />
      <div className="space-y-3">
        {items.length === 0 ? (
          <Card className="gap-0 py-0">
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>No notifications yet</EmptyTitle>
                <EmptyDescription>Worker events will appear here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          <>
            {items.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {item.title} {item.status === "unread" ? "· unread" : ""}
                  </CardTitle>
                  <CardDescription>
                    {item.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-start justify-between gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">{item.body}</div>
                    {item.href ? (
                      <a href={item.href} className="mt-2 inline-block text-primary hover:underline">
                        Open
                      </a>
                    ) : null}
                  </div>
                  {item.status === "unread" ? (
                    <form
                      action={async () => {
                        "use server";
                        await markNotificationRead(item.id);
                      }}
                    >
                      <Button type="submit" variant="outline" size="sm">
                        Mark read
                      </Button>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            ))}
            <Card className="gap-0 overflow-hidden py-0">
              <ListPagination pathname="/app/notifications" window={window} />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
