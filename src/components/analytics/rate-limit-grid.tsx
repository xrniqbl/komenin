"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { platformLabel } from "@/lib/session-routing";
import { QuotaMeter } from "./quota-meter";

type AccountStatus = {
  id: string;
  username: string;
  platform: string;
  status: string;
  dailyQuota: number;
  actionsToday: number;
  pct: number;
  throttled: boolean;
  effectiveCap?: number;
  effectiveUsed?: number;
  sentInLastHour?: number;
  hourlyCap?: number;
  hourlyThrottled?: boolean;
  limitSummary?: string;
};

export function RateLimitGrid({ accounts }: { accounts: AccountStatus[] }) {
  if (accounts.length === 0) {
    return (
      <Card className="gap-0 py-0"><Empty className="py-10">
        <EmptyHeader>
          <EmptyTitle>No accounts</EmptyTitle>
          <EmptyDescription>Connect accounts to monitor daily quotas.</EmptyDescription>
        </EmptyHeader>
      </Empty></Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((acc) => (
        <Card key={acc.id} className={acc.throttled ? "border-destructive/50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">@{acc.username}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {platformLabel(acc.platform as never)}
                  </Badge>
                  <Badge
                    variant={acc.status === "healthy" ? "secondary" : "destructive"}
                    className="text-[10px]"
                  >
                    {acc.status}
                  </Badge>
                </div>
              </div>
              {acc.throttled ? (
                <Badge variant="destructive" className="text-[10px]">
                  throttled
                </Badge>
              ) : null}
            </div>
            <div className="mt-3">
              <QuotaMeter used={acc.effectiveUsed ?? acc.actionsToday} limit={acc.effectiveCap ?? acc.dailyQuota} label="Batas aman harian" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>Tempo/jam: {acc.sentInLastHour ?? 0}/{acc.hourlyCap ?? "—"}</span>
              {acc.limitSummary ? <span>· {acc.limitSummary}</span> : null}
              {acc.hourlyThrottled ? (
                <Badge variant="destructive" className="text-[10px]">jeda/jam</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}