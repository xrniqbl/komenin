"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmAction } from "@/components/ui-patterns/confirm-action";
import { toastManager } from "@/components/ui/toast";
import { deleteCompetitorProfile } from "@/server/competitors";
import { platformLabel } from "@/lib/session-routing";

type Profile = {
  id: string;
  handle: string;
  platform: string;
  displayName?: string | null;
  isActive: boolean;
  createdAt: Date | string;
};

type Metrics = {
  count7d: number;
  count30d: number;
  avgPerDay: number;
  dailyBuckets: { date: string; count: number }[];
  topKeywords: { word: string; count: number }[];
};

export function CompetitorCard({
  profile,
  metrics,
}: {
  profile: Profile;
  metrics?: Metrics;
}) {
  const [pending] = useTransition();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 p-4 pb-2">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span>@{profile.handle}</span>
            {profile.displayName ? (
              <span className="text-xs font-normal text-muted-foreground">{profile.displayName}</span>
            ) : null}
          </CardTitle>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {platformLabel(profile.platform as never)}
            </Badge>
            <Badge variant={profile.isActive ? "secondary" : "outline"} className="text-[10px]">
              {profile.isActive ? "active" : "inactive"}
            </Badge>
          </div>
        </div>
        <ConfirmAction
          title={`Remove @${profile.handle}?`}
          description="This competitor will be removed from radar tracking."
          confirmLabel="Remove"
          destructive
          disabled={pending}
          trigger={
            <Button size="sm" variant="ghost" className="h-7 text-xs">
              Remove
            </Button>
          }
          onConfirm={async () => {
            await deleteCompetitorProfile(profile.id);
            toastManager.add({ title: "Competitor removed", type: "success" });
          }}
        />
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {metrics ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Card className="bg-muted/30 py-0 shadow-none">
                <CardContent className="p-2">
                  <div className="text-lg font-semibold leading-none">{metrics.count7d}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">7d posts</div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 py-0 shadow-none">
                <CardContent className="p-2">
                  <div className="text-lg font-semibold leading-none">{metrics.count30d}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">30d posts</div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 py-0 shadow-none">
                <CardContent className="p-2">
                  <div className="text-lg font-semibold leading-none">{metrics.avgPerDay}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">avg / day</div>
                </CardContent>
              </Card>
            </div>

            <Card className="py-0 shadow-none">
              <CardContent className="p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Last 14 days
                </div>
                <div className="flex h-12 items-end gap-0.5">
                  {metrics.dailyBuckets.map((b) => {
                    const max = Math.max(1, ...metrics.dailyBuckets.map((x) => x.count));
                    const h = max > 0 ? Math.round((b.count / max) * 100) : 0;
                    return (
                      <div key={b.date} className="flex flex-1 flex-col items-center gap-0.5">
                        <div
                          className="w-full rounded-sm bg-foreground transition-all"
                          style={{ height: `${Math.max(2, h)}%` }}
                          title={`${b.date}: ${b.count} posts`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>{metrics.dailyBuckets[0]?.date}</span>
                  <span>{metrics.dailyBuckets[metrics.dailyBuckets.length - 1]?.date}</span>
                </div>
              </CardContent>
            </Card>

            {metrics.topKeywords.length > 0 ? (
              <Card className="py-0 shadow-none">
                <CardContent className="p-3">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Top keywords (30d)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {metrics.topKeywords.map((k) => (
                      <Badge key={k.word} variant="outline" className="text-[10px]">
                        {k.word} <span className="ml-1 text-[9px] text-muted-foreground">x{k.count}</span>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : (
          <div className="text-xs text-muted-foreground">Loading metrics...</div>
        )}
      </CardContent>
    </Card>
  );
}