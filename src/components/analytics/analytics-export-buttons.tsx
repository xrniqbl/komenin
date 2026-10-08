"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const EXPORT_TYPES = [
  { value: "summary", label: "Summary" },
  { value: "clients", label: "Clients" },
  { value: "campaigns", label: "Campaigns" },
] as const;

type ExportType = (typeof EXPORT_TYPES)[number]["value"];

/** Download link for GET /app/analytics/export?type=..&range=.. */
export function AnalyticsExportButtons({
  rangeDays,
  labels,
}: {
  rangeDays: number;
  labels: { exportCsv: string; exporting: string };
}) {
  const [pending, setPending] = useState<ExportType | null>(null);

  async function download(type: ExportType) {
    setPending(type);
    try {
      const res = await fetch(`/app/analytics/export?type=${type}&range=${rangeDays}`);
      if (!res.ok) throw new Error(`export failed: ${res.status}`);
      const csv = await res.text();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `komenin-analytics-${type}.csv`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[analytics] export failed", error);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {EXPORT_TYPES.map((opt) => (
        <Button
          key={opt.value}
          size="sm"
          variant="glass"
          disabled={pending !== null}
          onClick={() => download(opt.value)}
        >
          {pending === opt.value
            ? labels.exporting
            : `${labels.exportCsv} · ${opt.label}`}
        </Button>
      ))}
    </div>
  );
}
