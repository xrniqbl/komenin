"use client";

import { cn } from "@/lib/utils";
import { getThresholdStatus, type QuotaStatus } from "@/lib/quota";
import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";

type Props = {
  used: number;
  limit: number;
  label: string;
  className?: string;
};

const STATUS_INDICATOR: Record<QuotaStatus, string> = {
  ok: "bg-foreground",
  warning: "bg-amber-500",
  critical: "bg-destructive",
};

const STATUS_TRACK: Record<QuotaStatus, string> = {
  ok: "bg-muted",
  warning: "bg-amber-500/20",
  critical: "bg-destructive/20",
};

export function QuotaMeter({ used, limit, label, className }: Props) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const status = getThresholdStatus(used, limit);

  return (
    <Progress value={pct} className={cn("gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <ProgressLabel className="text-xs font-medium">{label}</ProgressLabel>
        <ProgressValue className="text-xs text-muted-foreground">
          {() => `${used.toLocaleString()} / ${limit.toLocaleString()} (${pct}%)`}
        </ProgressValue>
      </div>
      <ProgressTrack className={cn("h-2", STATUS_TRACK[status])}>
        <ProgressIndicator className={STATUS_INDICATOR[status]} />
      </ProgressTrack>
    </Progress>
  );
}
