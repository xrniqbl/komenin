import { Badge } from "@/components/ui/badge";
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
    <div className="rounded-2xl border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <Badge variant="outline">{items.length} posts</Badge>
      </div>

      {groups.length === 0 ? (
        <div className="text-sm text-muted-foreground">No scheduled posts yet.</div>
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
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2"
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
    </div>
  );
}