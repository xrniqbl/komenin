"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Row = { platform: string; count: number };

function barWidth(count: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(4, Math.round((count / max) * 100));
}

export function PlatformMixCard({
  title,
  description,
  rows,
  exportAction,
  exportLabel,
}: {
  title: string;
  description: string;
  rows: Row[];
  exportAction: () => Promise<{ filename: string; csv: string }>;
  exportLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  function download() {
    startTransition(async () => {
      const result = await exportAction();
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>
              {description} · {total} total in range
            </CardDescription>
          </div>
          <Button size="sm" variant="glass" disabled={pending} onClick={download}>
            {pending ? "Exporting…" : exportLabel}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.length === 0 ? (
          <div className="text-muted-foreground">No activity in this range yet.</div>
        ) : (
          rows.map((row) => (
            <div key={row.platform} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium capitalize">{row.platform}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${barWidth(row.count, max)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
