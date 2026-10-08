import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ListPagination, getPageWindow } from "@/components/app/list-pagination";
import { PageHeader } from "@/components/app/page-header";
import { FilterBar } from "@/components/app/filter-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  archiveNotification,
  listNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/notifications";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
  { value: "archived", label: "Archived" },
];

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const status = (params.status || "").trim();
  const requestedPage = Number(params.page);
  const { items, total } = await listNotificationsPage(requestedPage, 10, {
    status: status || undefined,
    q: params.q,
  });
  const window = getPageWindow(total, params.page, 10);

  const tabHref = (value: string) => {
    const qs = new URLSearchParams();
    if (value) qs.set("status", value);
    if (params.q) qs.set("q", params.q);
    const suffix = qs.toString();
    return suffix ? `/app/notifications?${suffix}` : "/app/notifications";
  };

  async function markAll() {
    "use server";
    await markAllNotificationsRead();
    revalidatePath("/app/notifications");
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Workspace alerts for approvals, failures, and health events."
        action={
          <div className="flex items-center gap-2">
            {status === "unread" && total > 0 ? <Badge variant="secondary">{total} unread</Badge> : null}
            <form action={markAll}>
              <Button type="submit" variant="glass">
                Mark all read
              </Button>
            </form>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Status:</span>
        {STATUS_TABS.map((option) => {
          const active = (option.value === "" && !status) || option.value === status;
          return (
            <Button
              key={option.value || "__all"}
              size="sm"
              variant={active ? "default" : "outline"}
              render={
                <Link
                  href={tabHref(option.value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(active && "pointer-events-none")}
                />
              }
              nativeButton={false}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
      <div className="mb-4">
        <FilterBar placeholder="Search notifications…" defaultQ={params.q || ""} />
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <Card className="gap-0 py-0">
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle>No notifications yet</EmptyTitle>
                <EmptyDescription>
                  {status || params.q
                    ? "No notifications match these filters."
                    : "Worker events will appear here."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          <>
            {items.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <span>{item.title}</span>
                    {item.status === "unread" ? <Badge variant="secondary">unread</Badge> : null}
                    {item.status === "archived" ? <Badge variant="outline">archived</Badge> : null}
                  </CardTitle>
                  <CardDescription>
                    {item.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-muted-foreground">{item.body}</div>
                    {item.href ? (
                      <a href={item.href} className="mt-2 inline-block text-primary hover:underline">
                        Open
                      </a>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.status === "unread" ? (
                      <form
                        action={async () => {
                          "use server";
                          await markNotificationRead(item.id);
                        }}
                      >
                        <Button type="submit" variant="glass" size="sm">
                          Mark read
                        </Button>
                      </form>
                    ) : null}
                    {item.status !== "archived" ? (
                      <form
                        action={async () => {
                          "use server";
                          await archiveNotification(item.id);
                        }}
                      >
                        <Button type="submit" variant="glass" size="sm">
                          Archive
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="gap-0 overflow-hidden py-0">
              <ListPagination pathname="/app/notifications" searchParams={{ status: params.status, q: params.q }} window={window} />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
