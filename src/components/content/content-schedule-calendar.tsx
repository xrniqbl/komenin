import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { groupScheduleByDay, type ScheduleItem } from "@/lib/content-schedule";

export function ContentScheduleCalendar({
  items,
  title = "Publish schedule",
}: {
  items: ScheduleItem[];
  title?: string;
}) {
  const groups = groupScheduleByDay(items);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm tracking-tight">{title}</CardTitle>
          <Badge variant="outline">{items.length} posts</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyTitle>No scheduled posts yet</EmptyTitle>
              <EmptyDescription>Approved drafts will appear here once scheduled.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.key}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          #{item.sequence}
                          {item.title ? ` · ${item.title}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.scheduledFor
                            ? item.scheduledFor.toISOString().slice(11, 16) + " UTC"
                            : "no time"}
                        </div>
                      </div>
                      <Badge variant="secondary">{item.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}