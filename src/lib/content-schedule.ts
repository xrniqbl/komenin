export type ScheduleItem = {
  id: string;
  sequence: number;
  title?: string | null;
  status: string;
  scheduledFor: Date | null;
  publishedAt?: Date | null;
};

export type ScheduleDayGroup = {
  key: string;
  label: string;
  items: ScheduleItem[];
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function groupScheduleByDay(items: ScheduleItem[]): ScheduleDayGroup[] {
  const map = new Map<string, ScheduleDayGroup>();

  for (const item of items) {
    const date = item.scheduledFor || item.publishedAt || new Date(0);
    const key = dayKey(date);
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: date.getTime() === 0 ? "Unscheduled" : dayLabel(date),
        items: [],
      });
    }
    map.get(key)!.items.push(item);
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => {
        const at = a.scheduledFor?.getTime() || 0;
        const bt = b.scheduledFor?.getTime() || 0;
        return at - bt || a.sequence - b.sequence;
      }),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}