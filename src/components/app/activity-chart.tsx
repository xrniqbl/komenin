"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DayData = {
  date: string;
  label: string;
  sends: number;
  drafts: number;
};

export function ActivityChart({ data }: { data: DayData[] }) {
  const max = Math.max(...data.map((d) => Math.max(d.sends, d.drafts)), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Activity — last 7 days</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end justify-between gap-2">
          {data.map((day) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end justify-center gap-1">
                <div
                  className="w-full max-w-6 rounded-sm bg-electric-500"
                  style={{ height: `${(day.sends / max) * 100}%`, minHeight: day.sends > 0 ? 4 : 0 }}
                  title={`${day.sends} sent`}
                />
                <div
                  className="w-full max-w-6 rounded-sm bg-electric-500/30"
                  style={{ height: `${(day.drafts / max) * 100}%`, minHeight: day.drafts > 0 ? 4 : 0 }}
                  title={`${day.drafts} drafts`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{day.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-electric-500" /> Sent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-electric-500/30" /> Drafts
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
