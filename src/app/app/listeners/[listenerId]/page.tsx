import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSelect } from "@/components/ui/form-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/app/page-header";
import { StatusPill } from "@/components/session-routing/status-pill";
import { getRequestLocale } from "@/lib/i18n/request-locale";
import { messages } from "@/lib/i18n/messages";
import {
  formatPollDate,
  listenerHealthState,
  nextPollAt,
} from "@/lib/listener-health";
import { platformLabel } from "@/lib/session-routing";
import { listCampaigns } from "@/server/campaigns";
import {
  deleteListener,
  getListener,
  pollListener,
  setListenerActive,
  updateListener,
} from "@/server/listeners";
import type { ListenerType, Platform } from "@prisma/client";

export default async function ListenerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listenerId: string }>;
  searchParams: Promise<{ confirm?: string }>;
}) {
  const { listenerId } = await params;
  const { confirm } = await searchParams;
  const locale = await getRequestLocale();
  const t = messages[locale].listeners;
  const listener = await getListener(listenerId);
  if (!listener) notFound();
  // Extracted for server-action closures (narrowing doesn't cross closures).
  const isActive = listener.isActive;
  const campaigns = await listCampaigns();

  const { state: health } = listenerHealthState({
    lastPolledAt: listener.lastPolledAt,
    latestPostAt: listener.posts[0]?.discoveredAt ?? null,
  });
  const next = nextPollAt({
    pollIntervalMinutes: listener.pollIntervalMinutes,
    lastPolledAt: listener.lastPolledAt,
    isActive: listener.isActive,
  });
  const lastPollLabel = formatPollDate(listener.lastPolledAt);
  const nextPollLabel = next ? formatPollDate(next) : null;

  async function save(formData: FormData) {
    "use server";
    await updateListener(listenerId, {
      platform: String(formData.get("platform") || "instagram") as Platform,
      type: String(formData.get("type") || "keyword") as ListenerType,
      query: String(formData.get("query") || ""),
      campaignId: String(formData.get("campaignId") || "") || null,
      pollIntervalMinutes: String(formData.get("pollIntervalMinutes") || "") || null,
      isActive: formData.get("isActive") === "on",
    });
    redirect(`/app/listeners/${listenerId}`);
  }

  async function toggleActive() {
    "use server";
    await setListenerActive(listenerId, !isActive);
    redirect(`/app/listeners/${listenerId}`);
  }

  async function remove() {
    "use server";
    await deleteListener(listenerId);
    redirect("/app/listeners?notice=Listener+deleted");
  }

  async function poll() {
    "use server";
    await pollListener(listenerId);
    redirect(`/app/listeners/${listenerId}`);
  }

  return (
    <div>
      <PageHeader
        title={listener.query}
        description={`${platformLabel(listener.platform)} · ${listener.type} listener`}
        action={
          <Button variant="link" render={<Link href="/app/listeners" />} nativeButton={false}>
            {t.back}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill label={listener.isActive ? "active" : "paused"} />
              <Badge
                variant={health === "fresh" ? "secondary" : health === "stale" ? "destructive" : "outline"}
              >
                {health === "fresh" ? t.freshBadge : health === "stale" ? t.staleBadge : t.neverPolled}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {listener._count.posts} {t.posts.toLowerCase()} ·{" "}
                {lastPollLabel ? `${t.lastPoll}: ${lastPollLabel} UTC` : t.neverPolled}
              </span>
            </div>
            {listener.pollIntervalMinutes ? (
              <div className="text-sm text-muted-foreground">
                {t.pollInterval}: {listener.pollIntervalMinutes} ·{" "}
                {nextPollLabel ? `${t.nextPoll}: ${nextPollLabel} UTC` : t.manualOnly}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {t.pollInterval}: {t.manualOnly}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{t.query}</div>
                <div className="mt-1 font-medium">{listener.query}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{t.platform}</div>
                <div className="mt-1">{platformLabel(listener.platform)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{t.type}</div>
                <div className="mt-1">{listener.type}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Campaign</div>
                <div className="mt-1">
                  {listener.campaign ? (
                    <Link
                      href={`/app/campaigns/${listener.campaign.id}`}
                      className="text-primary hover:underline"
                    >
                      {listener.campaign.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <form action={poll}>
                <Button variant="glass" type="submit">
                  {t.pollNow}
                </Button>
              </form>
              <form action={toggleActive}>
                <Button variant="glass" type="submit">
                  {listener.isActive ? t.pause : t.resume}
                </Button>
              </form>
              {confirm === "delete" ? (
                <form action={remove}>
                  <Button variant="destructive" type="submit">
                    {t.confirmDelete}
                  </Button>
                </form>
              ) : (
                <Button
                  variant="destructive"
                  render={<Link href={`/app/listeners/${listener.id}?confirm=delete`} />}
                  nativeButton={false}
                >
                  {t.delete}
                </Button>
              )}
              {confirm === "delete" ? (
                <Button
                  variant="link"
                  render={<Link href={`/app/listeners/${listener.id}`} />}
                  nativeButton={false}
                >
                  {t.cancel}
                </Button>
              ) : null}
            </div>
            {confirm === "delete" ? (
              <p className="text-sm text-muted-foreground">
                Deleting removes this watcher. Already-discovered posts are kept.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit listener</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={save} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="query">{t.query}</Label>
                <Input id="query" name="query" required defaultValue={listener.query} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="platform">{t.platform}</Label>
                  <FormSelect
                    id="platform"
                    name="platform"
                    defaultValue={listener.platform}
                    required
                    options={[
                      { value: "instagram", label: "Instagram" },
                      { value: "threads", label: "Threads" },
                      { value: "tiktok", label: "TikTok" },
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="type">{t.type}</Label>
                  <FormSelect
                    id="type"
                    name="type"
                    defaultValue={listener.type}
                    required
                    options={[
                      { value: "keyword", label: "Keyword" },
                      { value: "competitor", label: "Competitor" },
                      { value: "trend", label: "Trend" },
                    ]}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="campaignId">Campaign</Label>
                <FormSelect
                  id="campaignId"
                  name="campaignId"
                  defaultValue={listener.campaignId || ""}
                  placeholder="None"
                  options={[
                    { value: "", label: "None" },
                    ...campaigns.map((campaign) => ({
                      value: campaign.id,
                      label: campaign.name,
                    })),
                  ]}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pollIntervalMinutes">{t.pollInterval}</Label>
                <Input
                  id="pollIntervalMinutes"
                  name="pollIntervalMinutes"
                  type="number"
                  min={15}
                  max={10080}
                  placeholder={t.manualOnly}
                  defaultValue={listener.pollIntervalMinutes ?? ""}
                />
                <p className="text-xs text-muted-foreground">{t.pollIntervalHint}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="isActive" defaultChecked={listener.isActive} />
                Active (uncheck to pause)
              </label>
              <Button variant="electric" type="submit">{t.saveChanges}</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Recent polls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {listener.posts.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No posts discovered yet. Run a poll to fetch the latest.
            </div>
          ) : (
            listener.posts.map((post) => (
              <div key={post.id} className="rounded-lg border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">@{post.authorHandle}</span>
                  <span className="text-xs text-muted-foreground">
                    {post.discoveredAt.toISOString().slice(0, 19).replace("T", " ")} UTC ·{" "}
                    {post.status}
                  </span>
                </div>
                <div className="mt-1 line-clamp-2 text-muted-foreground">{post.content}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
