"use client";

import { useEffect, useState, useTransition } from "react";
import { CompetitorCard } from "./competitor-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectPopup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCompetitorProfile, getCompetitorMetrics } from "@/server/competitors";
import type { Platform } from "@prisma/client";

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

export function CompetitorsClient({
  initialProfiles,
  ownPosts,
}: {
  initialProfiles: Profile[];
  ownPosts: number;
}) {
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [displayName, setDisplayName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [metricsMap, setMetricsMap] = useState<Record<string, Metrics>>({});

  useEffect(() => {
    // Fetch metrics for all profiles
    initialProfiles.forEach((p) => {
      getCompetitorMetrics(p.id)
        .then((m) => {
          setMetricsMap((prev) => ({ ...prev, [p.id]: m as unknown as Metrics }));
        })
        .catch(() => {});
    });
  }, [initialProfiles]);

  const handleCreate = () => {
    if (!handle.trim()) {
      setError("Handle required");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await createCompetitorProfile({
          handle: handle.trim(),
          platform,
          displayName: displayName.trim() || undefined,
        });
        setHandle("");
        setDisplayName("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add");
      }
    });
  };

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Tracked profiles</div>
            <div className="mt-1 text-2xl font-semibold">{initialProfiles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Your posts (tracked)</div>
            <div className="mt-1 text-2xl font-semibold">{ownPosts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
            <div className="mt-1">
              <Badge variant="secondary">Live discovery</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add form */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Add competitor</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 p-4 pt-0">
          <div className="min-w-[160px] flex-1">
            <Label className="text-xs">Handle</Label>
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@competitor or handle" className="mt-1 h-8 text-sm" />
          </div>
          <div className="w-[140px]">
            <Label className="text-xs">Platform</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="threads">Threads</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
              </SelectPopup>
            </Select>
          </div>
          <div className="min-w-[140px] flex-1">
            <Label className="text-xs">Display name (optional)</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Brand name" className="mt-1 h-8 text-sm" />
          </div>
          <div className="flex items-end">
            <Button size="sm" disabled={pending} onClick={handleCreate}>
              {pending ? "..." : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {initialProfiles.length === 0 ? (
        <div className="rounded-2xl border bg-background p-10 text-center">
          <div className="text-sm font-medium">No competitors tracked yet</div>
          <div className="mt-1 text-xs text-muted-foreground">Add a handle above to start tracking their post volume and keywords.</div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {initialProfiles.map((profile) => (
            <CompetitorCard key={profile.id} profile={profile} metrics={metricsMap[profile.id]} />
          ))}
        </div>
      )}

      {/* Comparison table */}
      {initialProfiles.length > 0 ? (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Comparison: You vs Competitors (30d)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 text-left font-medium">Profile</th>
                    <th className="py-2 text-right font-medium">7d</th>
                    <th className="py-2 text-right font-medium">30d</th>
                    <th className="py-2 text-right font-medium">Avg/day</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-muted/30 font-medium">
                    <td className="py-2">You (campaign posts)</td>
                    <td className="py-2 text-right">{ownPosts}</td>
                    <td className="py-2 text-right">{ownPosts}</td>
                    <td className="py-2 text-right">—</td>
                  </tr>
                  {initialProfiles.map((p) => {
                    const m = metricsMap[p.id];
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">@{p.handle}</td>
                        <td className="py-2 text-right">{m?.count7d ?? "…"}</td>
                        <td className="py-2 text-right">{m?.count30d ?? "…"}</td>
                        <td className="py-2 text-right">{m?.avgPerDay ?? "…"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
